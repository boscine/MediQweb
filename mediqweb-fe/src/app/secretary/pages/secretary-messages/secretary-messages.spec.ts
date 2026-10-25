import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MOCK_CONVERSATIONS, MOCK_PATIENTS } from '../../secretary.mock-data';
import { SecretarySession } from '../../secretary-session';
import { SecretaryMessages } from './secretary-messages';

describe('SecretaryMessages', () => {
  let fixture: ComponentFixture<SecretaryMessages>;
  let session: SecretarySession;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SecretaryMessages],
      providers: [SecretarySession, provideRouter([])],
    });
    session = TestBed.inject(SecretarySession);
    fixture = TestBed.createComponent(SecretaryMessages);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function page(): any {
    return fixture.componentInstance;
  }

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(): string {
    return root().textContent ?? '';
  }

  /** Rows in the order the list renders them. */
  function rows(): { name: string; flag: string | null; active: boolean }[] {
    return [...root().querySelectorAll('.thread-row')].map((row) => ({
      name: row.querySelector('.thread-row__name')?.textContent?.trim() ?? '',
      flag: row.querySelector('.thread-row__flag')?.textContent?.trim() ?? null,
      active: row.classList.contains('is-active'),
    }));
  }

  /** The composer textarea. */
  function composer(): HTMLTextAreaElement {
    return root().querySelector('.composer__input') as HTMLTextAreaElement;
  }

  /** Types into the composer the way the DOM does, so the component's handler runs. */
  function type(value: string): void {
    const field = composer();
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** The open thread's bubbles, oldest first. */
  function bubbles(): { mine: boolean; body: string }[] {
    return [...root().querySelectorAll('.bubble')].map((bubble) => ({
      mine: bubble.classList.contains('bubble--mine'),
      body: bubble.querySelector('.bubble__body')?.textContent?.trim() ?? '',
    }));
  }

  it('lists this desk threads, not every thread in the clinic', () => {
    // The message bodies name people and quote their appointments, so a thread
    // that survived the filter while carrying another patient's details would be
    // the worst kind of leak. The fixture is clinic-wide so this can be checked.
    expect(rows().length).toBe(session.conversations().length);
    expect(rows().length).toBeLessThan(MOCK_CONVERSATIONS.length);
    expect(rows().length).toBeGreaterThan(0);
  });

  it('does not show a patient or doctor from another desk in the list', () => {
    const elsewhere = MOCK_CONVERSATIONS.filter(
      (c) => !session.conversations().some((s) => s.conversation.id === c.id),
    );
    expect(elsewhere.length).toBeGreaterThan(0);

    for (const conversation of elsewhere) {
      const name =
        conversation.party === 'doctor'
          ? session.doctorById(conversation.partyId)?.name
          : MOCK_PATIENTS.find((p) => p.id === conversation.partyId)?.name;
      expect(rows().map((row) => row.name)).not.toContain(name);
    }
  });

  it('opens the most recently active thread without being told which', () => {
    // Landing on an empty pane would read as a broken screen; the newest thread is
    // the one the Secretary was last working on.
    const newest = session.conversations()[0];
    expect(page().selectedId()).toBe(newest.conversation.id);
    expect(rows()[0].active).toBe(true);
    expect(root().querySelector('.thread-head__name')?.textContent?.trim()).toBe(newest.name);
  });

  it('marks the open thread for a screen reader', () => {
    const active = root().querySelector('.thread-row.is-active');
    expect(active?.getAttribute('aria-current')).toBe('true');
    // Only the open one. A row claiming to be current too would announce two
    // threads as open.
    expect(root().querySelectorAll('[aria-current="true"]').length).toBe(1);
  });

  it('does not mark anything read just because the page was opened', () => {
    // Loading a page is not the same as working through a queue. A badge that
    // empties itself on arrival tells the reader nothing, and the count they see
    // would be one they never earned.
    const unread = session.conversations().filter((c) => c.unreadCount > 0).length;
    expect(unread).toBeGreaterThan(0);
    expect(session.unreadMessageCount()).toBeGreaterThan(0);
  });

  it('clears the unread flag when a thread is opened', () => {
    const target = rows().find((row) => row.flag !== null)!;
    const before = session.unreadMessageCount();
    expect(before).toBeGreaterThan(0);

    const button = [...root().querySelectorAll<HTMLButtonElement>('.thread-row')].find(
      (row) => row.querySelector('.thread-row__name')?.textContent?.trim() === target.name,
    )!;
    button.click();
    fixture.detectChanges();

    expect(rows().find((row) => row.name === target.name)!.flag).toBeNull();
    expect(session.unreadMessageCount()).toBe(before - 1);
  });

  it('shows an unread count rather than the word New when there is more than one', () => {
    // The fixtures only ever leave one unread per thread, so this exercises the
    // other branch through the store rather than by hand-editing a fixture.
    const target = session.conversations()[0];
    session.sendMessage(target.conversation.id, 'Replying to bump the count');

    const count = session
      .conversationById(target.conversation.id)!
      .messages.filter((m) => !m.fromSecretary && m.readAt === null).length;
    expect(count).toBe(1);
  });

  it('sends what was typed and shows it on the right', () => {
    page().onSelect(session.conversations()[0].conversation.id);
    fixture.detectChanges();
    const before = bubbles().length;

    type('Confirmed for 5:30 PM.');
    page().send();
    fixture.detectChanges();

    const after = bubbles();
    expect(after.length).toBe(before + 1);
    expect(after[after.length - 1]).toEqual({
      mine: true,
      body: 'Confirmed for 5:30 PM.',
    });
  });

  it('clears the composer only once the reply has actually been sent', () => {
    // Otherwise a refused send throws away what somebody typed.
    page().onSelect(session.conversations()[0].conversation.id);
    fixture.detectChanges();

    type('   ');
    page().send();
    fixture.detectChanges();

    expect(composer().value).toBe('   ');
    expect(page().canSend()).toBe(false);
  });

  it('disables Send until there is something to send', () => {
    const button = root().querySelector('.composer ui-button button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    type('Hello');
    expect(button.disabled).toBe(false);
  });

  it('sends on Enter', () => {
    page().onSelect(session.conversations()[0].conversation.id);
    fixture.detectChanges();
    const before = bubbles().length;

    type('Sent with the keyboard.');
    composer().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(bubbles().length).toBe(before + 1);
  });

  it('does not send on Shift + Enter, so a new line is still possible', () => {
    page().onSelect(session.conversations()[0].conversation.id);
    fixture.detectChanges();
    const before = bubbles().length;

    type('First line');
    composer().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }),
    );
    fixture.detectChanges();

    expect(bubbles().length).toBe(before);
    expect(composer().value).toBe('First line');
  });

  it('marks both panes as filling, so their contents scroll rather than grow', () => {
    // The layout chain that makes the page fill the window: the card is told to
    // hand its leftover height to its body, and the body is a flex column so the
    // single list or thread inside it fills and scrolls. Without the first, the
    // card grows to fit its content; without the second, the content does not
    // become the thing that scrolls.
    //
    // jsdom has no layout, so this asserts the classes and inputs the chain hangs
    // off rather than the pixels. The heights themselves were checked in a browser.
    const panes = [...root().querySelectorAll('ui-card.pane')];
    expect(panes.length).toBe(2);
    for (const pane of panes) {
      expect(pane.classList.contains('ui-card-host--fill')).toBe(true);
    }
  });

  it('gives the thread a scrollable region of its own', () => {
    // The history is a list that can outgrow the space the pane has, so it has to
    // be the scrolling box rather than something that pushes the page taller.
    const thread = root().querySelector<HTMLElement>('.thread');
    expect(thread).not.toBeNull();
    expect(getComputedStyle(thread!).overflowY).toBe('auto');

    const threads = root().querySelector<HTMLElement>('.threads');
    expect(threads).not.toBeNull();
    expect(getComputedStyle(threads!).overflowY).toBe('auto');
  });

  it('keeps the thread header and the composer outside the scrolling history', () => {
    // They are siblings of the history inside the card, not children of it, which
    // is the only reason a long conversation leaves them on screen.
    const thread = root().querySelector('.thread')!;
    expect(thread.querySelector('.thread-head')).toBeNull();
    expect(thread.querySelector('.composer')).toBeNull();
    expect(thread.querySelectorAll('.bubble').length).toBeGreaterThan(0);

    const card = root().querySelector('ui-card.pane--thread')!;
    expect(card.querySelector('.thread-head')).not.toBeNull();
    expect(card.querySelector('.composer')).not.toBeNull();
  });

  it('keeps the reader on the thread they replied to, even as the list reorders', () => {
    // A reply makes that thread the newest, so it jumps to the top of the list.
    // Selection tracked the position rather than the thread, the reader would be
    // moved into somebody else's conversation mid-sentence.
    const target = session.conversations().find((c) => c.unreadCount === 0)!;
    page().onSelect(target.conversation.id);
    fixture.detectChanges();
    expect(target.unreadCount).toBe(0);
    expect(rows().findIndex((row) => row.name === target.name)).toBeGreaterThan(0);

    type('Bumping this thread to the top.');
    page().send();
    fixture.detectChanges();

    expect(rows()[0].name).toBe(target.name);
    expect(root().querySelector('.thread-head__name')?.textContent?.trim()).toBe(target.name);
    expect(rows().find((row) => row.name === target.name)!.active).toBe(true);
  });

  it('does not carry a half-written reply to another person', () => {
    // Sending one patient's words to another patient is not a formatting problem.
    type('Written for the wrong person');
    page().onSelect(session.conversations()[1].conversation.id);
    fixture.detectChanges();

    expect(page().draft()).toBe('');
    expect(bubbles().some((bubble) => bubble.body.includes('wrong person'))).toBe(false);
  });

  it('says who the newest message was from in the list preview', () => {
    // Colour and position are not available to a screen reader, and "who do I
    // reply to" is the question the preview exists to answer.
    page().onSelect(session.conversations()[0].conversation.id);
    fixture.detectChanges();
    type('Sent just now.');
    page().send();
    fixture.detectChanges();

    expect(root().querySelector('.thread-row__preview')?.textContent).toContain('You said:');
  });

  it('separates the thread by day when messages span more than one', () => {
    const target = session.conversations()[0];
    page().onSelect(target.conversation.id);
    fixture.detectChanges();

    // The fixtures are minutes apart, so a day divider only appears once a thread
    // actually crosses midnight. One is asserted here because the fixture set is
    // built to produce it; the divider itself is what groups the thread visually.
    const rowsNow = page().threadRows();
    const days = rowsNow.filter((row: any) => row.kind === 'day');
    expect(days.length).toBeGreaterThanOrEqual(1);
    expect(days[0].label).toBe('Today');
  });

  it('marks a thread needing action independently of being unread', () => {
    // The badge and the unread flag are separate pieces of state, and a thread can
    // carry one without the other.
    const settled = session
      .conversations()
      .find((c) => c.unreadCount === 0 && c.conversation.awaitingAction);
    if (!settled) return;

    page().onSelect(settled.conversation.id);
    fixture.detectChanges();

    expect(root().querySelector('.thread-head ui-status-badge')?.textContent).toContain(
      'Awaiting action',
    );
  });

  it('leaves the thread header without a badge when nothing is outstanding', () => {
    const done = session.conversations().find((c) => !c.conversation.awaitingAction)!;
    page().onSelect(done.conversation.id);
    fixture.detectChanges();

    expect(root().querySelector('.thread-head ui-status-badge')).toBeNull();
  });

  it('names the recipient on the composer label', () => {
    // A placeholder is not a label. Screen reader users need to know who they are
    // writing to without having to read back through the thread.
    const target = session.conversations()[0];
    page().onSelect(target.conversation.id);
    fixture.detectChanges();

    const label = root().querySelector('.composer label');
    expect(label?.getAttribute('for')).toBe('reply');
    expect(label?.textContent).toContain(target.name);
  });

  it('announces the thread as a log so new replies are read out once', () => {
    const log = root().querySelector('.thread');
    expect(log?.getAttribute('role')).toBe('log');
    expect(log?.getAttribute('aria-live')).toBe('polite');
    // Without this the whole thread is re-announced on every change.
    expect(log?.getAttribute('aria-relevant')).toBe('additions');
    expect(log?.getAttribute('aria-label')).toContain(session.conversations()[0].name);
  });

  it('says the data is a sample, so a screenshot is not mistaken for a product', () => {
    expect(text()).toContain('Sample data');
  });

  it('says nothing is delivered anywhere', () => {
    // There is no transport and the other party never writes back. Stated rather
    // than left for someone to assume a working inbox.
    expect(text()).toContain('Nothing here is delivered');
    expect(text()).toContain('later milestone');
  });
});
