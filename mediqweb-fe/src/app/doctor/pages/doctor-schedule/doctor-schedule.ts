import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Button, Card, DatePicker, FormField, MockNotice } from '../../../shared/components';
import {
  blockMinutes,
  dayKey,
  formatDuration,
  minutesOfDay,
  parseDayKey,
  usableBlocks,
} from '../../doctor.dates';
import { DatedAvailabilityRefusal, DoctorSession } from '../../doctor-session';
import { ToastService } from '../../../core/services/toast.service';
import { SESSION_LABELS, type DatedAvailability, type ScheduleBlock } from '../../doctor.models';

/** Sunday first, matching `Date.prototype.getDay()` and the fixture order. */
const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Short month names, for the toast's sentence about a date.
 *
 * Written out rather than pulled from `Intl` so the wording of a notification is
 * not at the mercy of whatever locale the browser reports — a toast that said
 * "Fri, Nov 14" on one machine and "Fri, Nov. 14" on another would read as a
 * difference in what was published.
 */
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/**
 * The hours each session starts and ends by default, indexed as the sessions are.
 *
 * A morning running 05:00–12:00 and an afternoon running 13:00–20:00: a clinic
 * that opens before the morning commute and works well into the evening. That is
 * the shape that made one pair of hours a day untenable — a single range would
 * have to be 05:00–20:00, publishing fifteen hours of bookable time across a gap
 * the doctor does not work.
 *
 * The two touch at 12:00/13:00 without overlapping, because sessions are
 * half-open: a visit may begin exactly as the morning ends.
 */
const SESSION_DEFAULTS: readonly { startTime: string; endTime: string }[] = [
  { startTime: '05:00', endTime: '12:00' },
  { startTime: '13:00', endTime: '20:00' },
];

/**
 * Control ids for the dated form.
 *
 * At module level because `FormField` derives the id of its help text from the
 * control's id, and a field initializer cannot call a method on the instance it
 * belongs to. `DATED_FIELD_PREFIX` is shared with the date input so the hint's
 * id and the control that describes it cannot drift apart.
 */
const DATED_FIELD_PREFIX = 'dated-';

const datedControlId = (session: number, part: 'startTime' | 'endTime'): string =>
  `${DATED_FIELD_PREFIX}${session}-${part}`;

/** Control ids for a weekday's sessions. */
const weeklyControlId = (day: number, session: number, part: 'startTime' | 'endTime'): string =>
  `weekly-${day}-${session}-${part}`;

/** One session within a day: whether it is worked, and for how long. */
type SessionForm = FormGroup<{
  enabled: FormControl<boolean>;
  startTime: FormControl<string>;
  endTime: FormControl<string>;
}>;

/** One group per day, holding that day's sessions. */
type DayForm = FormGroup<{ sessions: FormArray<SessionForm> }>;

/** One group per dated exception: which day, and the sessions replacing it. */
type DatedForm = FormGroup<{
  date: FormControl<string>;
  sessions: FormArray<SessionForm>;
}>;

/**
 * A session's end must be after its start — but only while it is switched on.
 *
 * Two separate cases that the old single-pair form did not have. An unused
 * session has no hours to check, and a day where neither session is worked is
 * closed, so a blank afternoon must not block a perfectly good morning.
 *
 * An empty or unparsable time belongs to `Validators.required`; reporting "end
 * before start" for a blank field would be a lie about what is wrong.
 */
const startBeforeEnd: ValidatorFn = (control): ValidationErrors | null => {
  const group = control as SessionForm;
  if (!group.get('enabled')?.value) return null;
  return group.getRawValue().endTime === '' || group.getRawValue().startTime === ''
    ? null
    : blockMinutes(group.getRawValue())
      ? null
      : { endBeforeStart: true };
};

/**
 * Two sessions in one day cannot claim the same time.
 *
 * Half-open, so a morning ending at 12:00 and an afternoon starting at 12:00 do
 * not clash — that pair is the ordinary split day, and treating it as a conflict
 * would make the most common thing about this form unsavable.
 *
 * Only worth asking because a day can hold more than one session, which is what
 * the split day introduced.
 */
const noOverlap: ValidatorFn = (control): ValidationErrors | null => {
  const sessions = (control as FormGroup).get('sessions') as FormArray<SessionForm> | null;
  if (!sessions) return null;

  const usable = sessions.controls
    .filter((group) => group.get('enabled')?.value)
    .map((group) => group.getRawValue())
    .filter((session) => blockMinutes(session) !== null)
    .map((session) => ({
      start: minutesOfDay(session.startTime)!,
      end: minutesOfDay(session.endTime)!,
    }));

  for (let i = 0; i < usable.length; i += 1) {
    for (let j = i + 1; j < usable.length; j += 1) {
      if (usable[i].start < usable[j].end && usable[j].start < usable[i].end) {
        return { overlappingSessions: true };
      }
    }
  }
  return null;
};

/**
 * Weekly availability, plus dated exceptions to it.
 *
 * The doctor publishes the hours a Secretary may book into. The weekly form is
 * filled from the store and only written back on save, so leaving a half-finished
 * edit never touches the published week.
 *
 * Each day holds two sessions, a morning and an afternoon, rather than one pair
 * of hours. A doctor who works 09:00–12:00 and 13:00–17:00 cannot be described
 * by a single range, and one range is not only a display limitation: the booking
 * rules compared against one closing time per day, so every afternoon booking on
 * a split day was refused as outside-hours.
 *
 * A day is worked when at least one of its sessions is on, which is why there is
 * no separate day-level switch that could disagree with the sessions it claims to
 * switch on. Both off is a closed day.
 *
 * The dated form is separate because a date exception is a different shape of
 * thing: one day, published the moment it is entered, rather than a pattern that
 * only means anything as a whole. It carries the same two sessions, so a split
 * week and a split exception are described in the same words.
 */
@Component({
  selector: 'app-doctor-schedule',
  imports: [ReactiveFormsModule, Button, Card, DatePicker, FormField, MockNotice],
  templateUrl: './doctor-schedule.html',
  styleUrl: './doctor-schedule.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorSchedule {
  private readonly session = inject(DoctorSession);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly toasts = inject(ToastService);

  protected readonly dayNames = DAY_NAMES;
  protected readonly sessionLabels = SESSION_LABELS;

  /**
   * Bumped whenever a session is switched on or off.
   *
   * Form values are not signals, so a template or a `computed` reading one would
   * be cached after its first evaluation and never re-read. This counter is what
   * puts the form in their dependency set.
   */
  private readonly formChanged = signal(0);

  protected readonly days = new FormArray<DayForm>(DAY_NAMES.map(() => this.buildDay()));

  protected readonly form = this.fb.group({ days: this.days });

  /** The published week, shown beside the form so a save can be seen to stick. */
  protected readonly published = computed(() => {
    const days = this.session.workingDayCount();
    return `${days} ${days === 1 ? 'day' : 'days'} · ${formatDuration(
      this.session.weeklyMinutes(),
    )} a week`;
  });

  /**
   * Today's `YYYY-MM-DD`, as the date input's lower bound.
   *
   * Bound rather than validated only in the store: a date picker that will not
   * let the doctor pick yesterday is less annoying than one that accepts it and
   * then refuses. The store still refuses, because a bound is a courtesy and a
   * rule enforced only in the browser is not a rule.
   */
  protected readonly today = dayKey(this.session.now());

  protected readonly dated = this.fb.group(
    {
      date: this.fb.control('', Validators.required),
      sessions: new FormArray<SessionForm>(this.buildSessions()),
    },
    { validators: noOverlap },
  );

  /**
   * The date being edited, or `null` when the form is adding a new one.
   *
   * Separate from the form's own `date` control on purpose: the control holds
   * what the doctor has typed, which may be half-finished, while this holds what
   * is actually published. Editing an entry loads it into the form and records
   * which date it came from, so saving updates that date rather than adding a
   * second one.
   */
  protected readonly editingDate = signal<string | null>(null);

  protected readonly datedEntries = computed(() => this.session.datedAvailability());

  /**
   * Dates the calendar marks as already carrying an exception.
   *
   * The picker's own popup cannot show this, which is half the reason for having
   * one: on a page whose whole job is overriding dates, the question "which of the
   * next few weeks have I already dealt with?" is the first thing asked, and
   * without the dots it can only be answered by scrolling the list below.
   */
  protected readonly markedDates = computed(() => this.datedEntries().map((e) => e.date));

  /**
   * What the weekly pattern already says for the date in the form.
   *
   * Shown under the picker so an exception can be entered as a difference from
   * what already happens that weekday, rather than as a set of hours with no
   * context — otherwise "closed" looks like a mistake, and a single afternoon
   * block on a normally-split Friday looks like a typo rather than a deliberate
   * change.
   */
  protected readonly weeklyBaseline = computed(() => {
    this.formChanged();
    const chosen = parseDayKey(this.dated.get('date')?.value ?? '');
    if (!chosen) return null;
    return {
      dayName: DAY_NAMES[chosen.getDay()],
      text: describeSessions(this.session.sessionsOn(chosen)),
    };
  });

  constructor() {
    this.fillFromStore();
    this.watchSessions();
  }

  /**
   * Keeps a switched-off session's hours disabled rather than only dimmed.
   *
   * Driven through the controls rather than a `[disabled]` attribute on the
   * input: Angular warns that a `disabled` attribute bound to a reactive form is
   * read once at creation, so toggling a session would leave its inputs looking
   * closed while still editable and still validating.
   */
  private watchSessions(): void {
    for (const list of this.allSessionArrays()) {
      for (const group of list.controls) {
        this.applyEnabled(group, group.get('enabled')!.value);
        group.get('enabled')!.valueChanges.subscribe((on) => {
          this.applyEnabled(group, on);
          // The group owns the overlap rule, so it has to be told its children
          // moved even though the array itself did not change.
          group.parent?.updateValueAndValidity({ emitEvent: false });
          list.parent?.updateValueAndValidity({ emitEvent: false });
          this.formChanged.update((n) => n + 1);
        });
      }
    }

    // The baseline under the date picker reads the date control, and a control
    // value is not a signal, so without this the hint would show whatever the
    // picker said when the page first rendered and never change again.
    this.dated.get('date')!.valueChanges.subscribe(() => this.formChanged.update((n) => n + 1));
  }

  /** Every session `FormArray` on the page, so the toggle rule is stated once. */
  private allSessionArrays(): FormArray<SessionForm>[] {
    return [
      ...this.days.controls.map((day) => day.controls.sessions),
      this.dated.controls.sessions,
    ];
  }

  private applyEnabled(group: SessionForm, on: boolean): void {
    for (const control of [group.get('startTime')!, group.get('endTime')!]) {
      if (on) control.enable({ emitEvent: false });
      else control.disable({ emitEvent: false });
    }
    // A disabled control drops out of the group's value, so revalidate to keep
    // the session from being reported invalid on the strength of a field the
    // doctor cannot even see.
    group.updateValueAndValidity({ emitEvent: false });
  }

  // --- Weekly form

  protected dayRow(index: number): DayForm {
    return this.days.at(index);
  }

  protected sessionRow(day: number, session: number): SessionForm {
    return this.dayRow(day).controls.sessions.at(session);
  }

  protected weeklyId(day: number, session: number, part: 'startTime' | 'endTime'): string {
    return weeklyControlId(day, session, part);
  }

  /** Whether a session in the weekly form is worked. */
  protected isSessionOn(day: number, session: number): boolean {
    this.formChanged();
    return this.sessionRow(day, session).getRawValue().enabled;
  }

  /** Whether a day has any session worked, which is what makes it a working day. */
  protected isDayOpen(day: number): boolean {
    this.formChanged();
    return this.days
      .at(day)
      .controls.sessions.controls.some((group) => group.getRawValue().enabled);
  }

  /** Whether any day's two sessions claim the same time. */
  protected hasOverlapError(): boolean {
    return this.days.controls.some((day) => !!day.errors?.['overlappingSessions']);
  }

  /** Whether the dated entry's two sessions claim the same time. */
  protected hasDatedOverlapError(): boolean {
    return !!this.dated.errors?.['overlappingSessions'];
  }

  /** Whether a session's times are switched on but not yet valid. */
  protected showSessionError(day: number, session: number): boolean {
    const group = this.sessionRow(day, session);
    return group.touched && !!group.errors?.['endBeforeStart'];
  }

  /** Whether the day's two sessions claim the same time. */
  protected showOverlapError(day: number): boolean {
    const group = this.dayRow(day);
    return group.touched && !!group.errors?.['overlappingSessions'];
  }

  /**
   * What a day currently adds up to, in one line beside its name.
   *
   * Names the sessions it has rather than only totalling them, because "7h a
   * week" is the same for a split day and a continuous one, and the split is the
   * thing the doctor just chose.
   */
  protected daySummary(day: number): string {
    this.formChanged();
    const sessions = this.readSessions(this.dayRow(day).controls.sessions);
    return sessions.length ? describeSessions(sessions) : 'Not working';
  }

  /**
   * What the whole form currently adds up to.
   *
   * A method rather than a `computed`: a form's value is not a signal, so a
   * `computed` would read it once and cache the total forever. Re-evaluating on
   * each change detection is cheap and always current. An invalid session counts
   * as zero, so a half-finished row cannot make the total look plausible.
   */
  protected draftSummary(): string {
    this.formChanged();
    let total = 0;
    let open = 0;
    for (const group of this.days.controls) {
      const sessions = this.readSessions(group.controls.sessions);
      if (!sessions.length) continue;
      open += 1;
      total += sessions.reduce((sum, session) => sum + (blockMinutes(session) ?? 0), 0);
    }
    return `${open} ${open === 1 ? 'day' : 'days'} · ${formatDuration(total)} a week`;
  }

  protected reset(): void {
    this.fillFromStore();
  }

  protected save(): void {
    if (this.form.invalid) {
      // Touch every row so the messages appear, rather than silently refusing.
      this.days.markAllAsTouched();
      for (const day of this.days.controls) {
        day.markAsTouched();
        day.controls.sessions.markAllAsTouched();
      }
      this.toasts.warning('Nothing saved', this.weeklyProblem() ?? 'Fix the highlighted days.');
      return;
    }

    // Read the controls individually rather than with `getRawValue` at the day
    // level, which would omit a switched-off session's times — that would lose
    // the hours the doctor set before turning a session off.
    this.session.saveSchedule(
      this.days.controls.map((group, index) => ({
        dayOfWeek: index,
        sessions: this.readSessions(group.controls.sessions),
      })),
    );
    // Says "in this session" rather than "saved", because the store is a fixture:
    // the doctor's published hours revert on reload, and a toast that said only
    // "saved" would be claiming a persistence that does not exist.
    this.toasts.success(
      'Hours updated',
      `You now publish ${this.draftSummary()}. Held in this session only.`,
    );
  }

  /** Why the weekly form is invalid, in the words the toast uses. */
  private weeklyProblem(): string | null {
    if (this.form.errors?.['overlappingSessions']) return this.overlapError();
    for (const day of this.days.controls) {
      if (day.errors?.['overlappingSessions']) return this.overlapError();
    }
    return this.timeError();
  }

  // --- Dated exceptions

  /** True when the dated form is editing an entry rather than adding one. */
  protected isEditingDate(): boolean {
    return this.editingDate() !== null;
  }

  protected datedSessionRow(session: number): SessionForm {
    return this.dated.controls.sessions.at(session);
  }

  protected datedId(session: number, part: 'startTime' | 'endTime'): string {
    return datedControlId(session, part);
  }

  /** Whether a session in the dated form is worked. */
  protected isDatedSessionOn(session: number): boolean {
    this.formChanged();
    return this.datedSessionRow(session).getRawValue().enabled;
  }

  /** Whether the dated entry has any session worked, which is what makes it open. */
  protected isDateOpen(): boolean {
    this.formChanged();
    return this.dated.controls.sessions.controls.some((group) => group.getRawValue().enabled);
  }

  /** What the button says, so it never claims to add something being edited. */
  protected datedSubmitLabel(): string {
    return this.isEditingDate() ? 'Update this date' : 'Add this date';
  }

  /**
   * What the weekly pattern already says for the chosen date, for the hint.
   *
   * Lives in the field's hint rather than in a paragraph of its own, so it sits
   * with the control it is about and is replaced by the error when there is one.
   */
  protected baselineHint(): string | null {
    const baseline = this.weeklyBaseline();
    if (!baseline) return null;
    return `That ${baseline.dayName} is usually ${baseline.text}.`;
  }

  /** Points the date input at the hint `FormField` rendered for it. */
  protected readonly datedHelpId = `${DATED_FIELD_PREFIX}date-help`;

  protected showDatedSessionError(session: number): boolean {
    const group = this.datedSessionRow(session);
    return group.touched && !!group.errors?.['endBeforeStart'];
  }

  protected showDatedOverlapError(): boolean {
    return this.dated.touched && !!this.dated.errors?.['overlappingSessions'];
  }

  /**
   * The message under the date input, or `null` while there is nothing wrong.
   *
   * Only the empty-date case: a date that is well formed but already past is
   * caught by the store and reported in a toast, because the input itself is not
   * invalid — it holds a perfectly good date, just not one that can be published.
   * Marking the field red for that would blame the control for a rule about time.
   */
  protected datedDateError(): string | null {
    return this.dated.get('date')?.touched && this.dated.get('date')?.hasError('required')
      ? 'Choose the date this applies to.'
      : null;
  }

  protected timeError(): string {
    return 'End time must be later than the start time.';
  }

  protected overlapError(): string {
    return 'The morning and afternoon sessions cannot overlap.';
  }

  /**
   * Publishes the dated entry, or explains why it was not published.
   *
   * The store decides, not this method. It is the only thing that knows what
   * "today" is and whether a date has passed, and a check the page could
   * disagree with would be a second answer to the same question.
   */
  protected saveDated(): void {
    if (this.dated.invalid) {
      this.dated.markAllAsTouched();
      this.dated.controls.sessions.markAllAsTouched();
      this.toasts.warning('Nothing saved', this.datedProblem() ?? 'Check the date and the hours.');
      return;
    }

    const { date } = this.dated.getRawValue();
    const refusal = this.session.saveDatedAvailability({
      date,
      sessions: this.readSessions(this.dated.controls.sessions),
    });

    if (refusal) {
      // A rule the store refused is not a validation error on a field, so it is
      // reported rather than painted on the input — the date may be perfectly
      // well formed and simply be yesterday.
      this.toasts.warning('Nothing saved', this.refusalText(refusal));
      return;
    }

    const wasEditing = this.isEditingDate();
    const sessions = this.readSessions(this.dated.controls.sessions);
    this.toasts.success(
      wasEditing ? 'Date updated' : 'Date added',
      sessions.length
        ? `${this.formatDate(date)} is ${describeSessions(sessions)}. Held in this session only.`
        : `${this.formatDate(date)} is closed. Held in this session only.`,
    );
    this.resetDated();
  }

  /**
   * Why the dated form is invalid, in the words the toast uses.
   *
   * Shared by the two places that refuse — the field-level validator and the
   * store — so a problem is described the same way wherever it is caught.
   */
  private datedProblem(): string | null {
    if (this.dated.get('date')?.hasError('required')) return 'Choose the date this applies to.';
    if (this.dated.errors?.['overlappingSessions']) return this.overlapError();
    return this.timeError();
  }

  /** What a refusal means, said as a sentence rather than as a code. */
  private refusalText(refusal: DatedAvailabilityRefusal): string {
    switch (refusal) {
      case 'invalid-date':
        return 'That is not a date the clinic can book.';
      case 'in-the-past':
        return 'That date has already passed. Choose today or a date after it.';
      case 'bad-session':
        return this.timeError();
      case 'overlapping-sessions':
        return this.overlapError();
    }
  }

  /**
   * A saved entry, loaded back into the form to be changed.
   *
   * Marks it as editing rather than adding, so saving updates that date instead
   * of adding a second entry for it — two records for one date would leave
   * "which hours apply" ambiguous.
   */
  protected editDated(entry: DatedAvailability): void {
    this.editingDate.set(entry.date);
    this.dated.get('date')!.setValue(entry.date);
    this.loadSessions(this.dated.controls.sessions, entry.sessions);
    this.dated.markAsUntouched();
    this.formChanged.update((n) => n + 1);
  }

  /**
   * Puts a date back on the weekly pattern.
   *
   * Withdrawing is not destructive in the way cancelling an appointment is — it
   * only means "no exception for this day" — so it is not asked about first.
   * Saying so is worth it though, because the word "remove" next to an
   * appointment list elsewhere on this site means something more serious.
   */
  protected clearDated(entry: DatedAvailability): void {
    if (!this.session.clearDatedAvailability(entry.date)) {
      this.toasts.error('Nothing to remove', 'That date is no longer listed.');
      return;
    }
    // Clearing the entry being edited would leave the form editing a date that
    // is no longer there, so the edit is abandoned at the same time.
    if (this.editingDate() === entry.date) this.resetDated();
    this.toasts.info(
      'Date removed',
      `${this.formatDate(entry.date)} is back to your weekly hours. Held in this session only.`,
    );
  }

  /** Clears the dated form and stops editing. */
  protected resetDated(): void {
    this.editingDate.set(null);
    this.dated.get('date')!.setValue('');
    this.dated.markAsUntouched();
    this.dated.markAsPristine();
    this.loadSessions(this.dated.controls.sessions, []);
    this.formChanged.update((n) => n + 1);
  }

  /**
   * Sessions as one line of text, for the published list.
   *
   * A method rather than a property so the template can call it with the entry it
   * is rendering, which is what lets one formatter serve the list, the day
   * summaries and the toast rather than three near-identical ones.
   */
  protected describeSessions(sessions: readonly ScheduleBlock[]): string {
    return describeSessions(sessions);
  }

  /**
   * A saved date as a clinician would say it: "Fri, Nov 14".
   *
   * Hand-formatted rather than reusing the template's `DatePipe`, because a pipe
   * is not callable from here and this runs inside a toast message. Falls back to
   * the raw key rather than "Invalid Date": a bad key in the store is a bug to be
   * seen, not one to be papered over with a plausible-looking word.
   */
  protected formatDate(date: string): string {
    const parsed = parseDayKey(date);
    if (!parsed) return date;
    const weekday = DAY_NAMES[parsed.getDay()].slice(0, 3);
    const month = MONTH_NAMES[parsed.getMonth()];
    return `${weekday}, ${month} ${parsed.getDate()}`;
  }

  // --- Building and reading the form

  private buildDay(): DayForm {
    return this.fb.group(
      { sessions: new FormArray<SessionForm>(this.buildSessions()) },
      { validators: noOverlap },
    );
  }

  private buildSessions(): SessionForm[] {
    return SESSION_LABELS.map((label, index) => {
      const hours = SESSION_DEFAULTS[index] ?? SESSION_DEFAULTS[0];
      return this.fb.group(
        {
          // The first session on by default, because a doctor opening the page
          // has a working week in mind; the second starts off so a split day is
          // something they choose rather than something they get by accident.
          enabled: this.fb.control(index === 0),
          startTime: this.fb.control(hours.startTime, Validators.required),
          endTime: this.fb.control(hours.endTime, Validators.required),
        },
        { validators: startBeforeEnd },
      );
    });
  }

  /**
   * The sessions that are switched on and hold usable hours.
   *
   * Read control by control rather than with `getRawValue` on the array, which
   * would omit a switched-off session's times — that would lose the hours the
   * doctor set before turning a session off, and then re-enabling it would come
   * back blank.
   */
  private readSessions(sessions: FormArray<SessionForm>): ScheduleBlock[] {
    return sessions.controls
      .filter((group) => group.get('enabled')!.value)
      .map((group) => {
        const { startTime, endTime } = group.getRawValue();
        return { startTime, endTime };
      })
      .filter((block) => blockMinutes(block) !== null);
  }

  /**
   * Loads saved sessions into the form, switching on exactly the ones that exist.
   *
   * Placed by time of day rather than by array position. An afternoon-only clinic
   * must not land in the Morning box: the form would then read "Morning 1:00 PM –
   * 5:00 PM", and saving it would publish it as a morning session, so the one edit
   * the doctor made to their week would silently change what it meant.
   */
  private loadSessions(sessions: FormArray<SessionForm>, saved: readonly ScheduleBlock[]): void {
    const ordered = usableBlocks(saved);
    sessions.controls.forEach((group, index) => {
      const block = ordered.find((candidate) => sessionIndexOf(candidate) === index);
      const on = !!block;
      const hours = SESSION_DEFAULTS[index] ?? SESSION_DEFAULTS[0];
      group.patchValue({
        enabled: on,
        startTime: block?.startTime ?? hours.startTime,
        endTime: block?.endTime ?? hours.endTime,
      });
      this.applyEnabled(group, on);
    });
    sessions.parent?.updateValueAndValidity({ emitEvent: false });
    this.formChanged.update((n) => n + 1);
  }

  private fillFromStore(): void {
    this.session.schedule().forEach((day, index) => {
      const group = this.days.at(index);
      this.loadSessions(group.controls.sessions, day.sessions);
      group.markAsPristine();
      group.markAsUntouched();
      // `markAllAsUntouched` is on the group, not the array, and the group's own
      // call does not reach into its children.
      group.controls.sessions.controls.forEach((session) => session.markAsUntouched());
    });
    this.formChanged.update((n) => n + 1);
  }
}

/**
 * Which session of the day a block belongs in: 0 for Morning, 1 for Afternoon.
 *
 * The boundary is noon, so a block starting at 12:00 is an afternoon one. That
 * is a convention rather than a truth about the clinic — a clinic that opens at
 * 06:00 and works a late evening would want the split drawn elsewhere — but it is
 * the only split the labels imply, and being wrong about it costs a label, not a
 * booking.
 */
function sessionIndexOf(block: ScheduleBlock): number {
  return (minutesOfDay(block.startTime) ?? 0) < 12 * 60 ? 0 : 1;
}

/**
 * Time formatting for the day summaries and the published list.
 *
 * Built once rather than per call: `describeSessions` runs for all seven days on
 * every change detection, and constructing an `Intl.DateTimeFormat` is far from
 * free — doing it seven times a cycle is the sort of cost that shows up as
 * unrelated jank elsewhere.
 *
 * Uses the browser's own time formatting rather than a hand-rolled one, because
 * a schedule that read "09:00–12:00" beside inputs showing "09:00 AM" would look
 * like two different conventions on the same page.
 */
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/** `09:30` in whatever format the browser uses for its time inputs. */
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  return TIME_FORMAT.format(new Date(2000, 0, 1, hours, minutes));
}

/**
 * Sessions as one line of text: "9:00 AM – 12:00 PM, 1:00 PM – 5:00 PM".
 *
 * Says "not working" for an empty list, so a closed day never renders as an
 * empty gap.
 */
function describeSessions(sessions: readonly ScheduleBlock[]): string {
  if (!sessions.length) return 'not working';
  return sessions
    .map((block) => `${formatTime(block.startTime)} – ${formatTime(block.endTime)}`)
    .join(', ');
}
