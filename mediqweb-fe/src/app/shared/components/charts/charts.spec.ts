import { TestBed } from '@angular/core/testing';
import { BarChart, type ChartBar } from './bar-chart/bar-chart';
import { Heatmap, heatLevel, type HeatmapMatrix } from './heatmap/heatmap';
import { LineChart, type LinePoint } from './line-chart/line-chart';

describe('BarChart', () => {
  const bars: ChartBar[] = [
    { label: 'Sep 25', value: 1 },
    { label: 'Oct 25', value: 0 },
    { label: 'Nov 25', value: 3 },
  ];

  function render(list: readonly ChartBar[], inputs: Record<string, unknown> = {}): HTMLElement {
    const fixture = TestBed.createComponent(BarChart);
    fixture.componentRef.setInput('bars', list);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('states every bar as text, including the empty months', () => {
    const host = render(bars, { unit: 'registration' });
    const items = Array.from(host.querySelectorAll('.visually-hidden li')).map((li) =>
      li.textContent?.trim(),
    );
    expect(items).toEqual([
      'Sep 25: 1 registration',
      'Oct 25: 0 registrations',
      'Nov 25: 3 registrations',
    ]);
  });

  it('keeps the canvas out of the accessibility tree, since the list already states the data', () => {
    const canvas = render(bars).querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('aria-hidden')).toBe('true');
  });

  it('holds the text alternative out of the visual layout', () => {
    const list = render(bars).querySelector('.visually-hidden');
    expect(list?.classList.contains('visually-hidden')).toBe(true);
  });

  it('keeps a zero bar, because a month with no registrations is still a month', () => {
    expect(render(bars).querySelectorAll('.visually-hidden li')).toHaveLength(3);
  });

  it('shows an empty state rather than a row of stubs when nothing was counted', () => {
    const host = render(
      [
        { label: 'Sep 25', value: 0 },
        { label: 'Oct 25', value: 0 },
      ],
      { emptyMessage: 'No registrations on record.' },
    );
    expect(host.querySelector('canvas')).toBeNull();
    expect(host.querySelector('.chart__empty')?.textContent?.trim()).toBe(
      'No registrations on record.',
    );
  });

  it('shows the empty state for no bars at all', () => {
    expect(render([]).querySelector('.chart__empty')).not.toBeNull();
  });

  it('names the breakdown when given a caption, and omits the line when not', () => {
    expect(
      render(bars, { caption: 'By month' }).querySelector('.chart__caption')?.textContent,
    ).toBe('By month');
    expect(render(bars).querySelector('.chart__caption')).toBeNull();
  });

  it('gives a horizontal chart enough height for one row per bar', () => {
    // chart.js drops axis labels that will not fit, so the box has to be tall
    // enough for every name or a doctor silently disappears from the chart.
    const tall = render(
      Array.from({ length: 8 }, (_, index) => ({ label: `Doctor ${index}`, value: index })),
      { orientation: 'horizontal' },
    );
    const tallHeight = Number.parseFloat(
      (tall.querySelector('.chart__plot') as HTMLElement).style.height,
    );

    const few = render([{ label: 'Doctor 0', value: 1 }], { orientation: 'horizontal' });
    const fewHeight = Number.parseFloat(
      (few.querySelector('.chart__plot') as HTMLElement).style.height,
    );

    expect(tallHeight).toBeGreaterThan(fewHeight);
    expect(tallHeight).toBeGreaterThanOrEqual(8 * 34);
  });

  it('gives a vertical chart a fixed height, so a row of cards lines up', () => {
    const short = render([{ label: 'A', value: 1 }]);
    const long = render(Array.from({ length: 14 }, (_, i) => ({ label: `${i}`, value: 1 })));
    const heightOf = (host: HTMLElement) =>
      Number.parseFloat((host.querySelector('.chart__plot') as HTMLElement).style.height);
    expect(heightOf(short)).toBe(heightOf(long));
    expect(heightOf(short)).toBeGreaterThan(0);
  });

  it('survives being torn down without a canvas ever being drawn', () => {
    // jsdom has no layout engine, so `canDraw` is false and no chart.js
    // instance is ever constructed. Tearing down must not throw on a null one.
    const fixture = TestBed.createComponent(BarChart);
    fixture.componentRef.setInput('bars', bars);
    fixture.detectChanges();
    expect(() => fixture.destroy()).not.toThrow();
  });
});

describe('LineChart', () => {
  const points: LinePoint[] = [
    { label: '2 Jul', value: 0 },
    { label: '3 Jul', value: 1 },
    { label: '4 Jul', value: 0 },
  ];

  function render(list: readonly LinePoint[], inputs: Record<string, unknown> = {}): HTMLElement {
    const fixture = TestBed.createComponent(LineChart);
    fixture.componentRef.setInput('points', list);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('states every point as text, including the days with none', () => {
    const host = render(points, { unit: 'appointment' });
    const items = Array.from(host.querySelectorAll('.visually-hidden li')).map((li) =>
      li.textContent?.trim(),
    );
    expect(items).toEqual([
      '2 Jul: 0 appointments',
      '3 Jul: 1 appointment',
      '4 Jul: 0 appointments',
    ]);
  });

  it('keeps the canvas out of the accessibility tree', () => {
    expect(render(points).querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows an empty state when every day in the window is zero', () => {
    const host = render(
      [
        { label: '2 Jul', value: 0 },
        { label: '3 Jul', value: 0 },
      ],
      { emptyMessage: 'No appointments in this period.' },
    );
    expect(host.querySelector('canvas')).toBeNull();
    expect(host.querySelector('.chart__empty')?.textContent?.trim()).toBe(
      'No appointments in this period.',
    );
  });

  it('draws the plot at a fixed height so a row of cards lines up', () => {
    const height = Number.parseFloat(
      (render(points).querySelector('.chart__plot') as HTMLElement).style.height,
    );
    expect(height).toBeGreaterThan(0);
  });

  it('survives being torn down without a canvas ever being drawn', () => {
    const fixture = TestBed.createComponent(LineChart);
    fixture.componentRef.setInput('points', points);
    fixture.detectChanges();
    expect(() => fixture.destroy()).not.toThrow();
  });
});

describe('Heatmap', () => {
  const matrix: HeatmapMatrix = {
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    slots: ['09:00', '10:00', '11:00'],
    cells: [
      { dayIndex: 0, slotIndex: 0, count: 0 },
      { dayIndex: 0, slotIndex: 1, count: 0 },
      { dayIndex: 0, slotIndex: 2, count: 0 },
      { dayIndex: 1, slotIndex: 0, count: 4 },
      { dayIndex: 1, slotIndex: 1, count: 0 },
      { dayIndex: 1, slotIndex: 2, count: 0 },
      { dayIndex: 2, slotIndex: 0, count: 1 },
      { dayIndex: 2, slotIndex: 1, count: 0 },
      { dayIndex: 2, slotIndex: 2, count: 2 },
      { dayIndex: 3, slotIndex: 0, count: 0 },
      { dayIndex: 3, slotIndex: 1, count: 0 },
      { dayIndex: 3, slotIndex: 2, count: 0 },
      { dayIndex: 4, slotIndex: 0, count: 0 },
      { dayIndex: 4, slotIndex: 1, count: 0 },
      { dayIndex: 4, slotIndex: 2, count: 0 },
      { dayIndex: 5, slotIndex: 0, count: 0 },
      { dayIndex: 5, slotIndex: 1, count: 0 },
      { dayIndex: 5, slotIndex: 2, count: 0 },
      { dayIndex: 6, slotIndex: 0, count: 0 },
      { dayIndex: 6, slotIndex: 1, count: 0 },
      { dayIndex: 6, slotIndex: 2, count: 0 },
    ],
    total: 7,
  };

  function render(value: HeatmapMatrix, inputs: Record<string, unknown> = {}): HTMLElement {
    const fixture = TestBed.createComponent(Heatmap);
    fixture.componentRef.setInput('matrix', value);
    for (const [name, input] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, input);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('has one row per weekday, in the order the matrix gives them', () => {
    const rows = Array.from(render(matrix).querySelectorAll('.heatmap__day')).map((th) =>
      th.textContent?.trim(),
    );
    expect(rows).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('has one column per slot', () => {
    const headers = Array.from(render(matrix).querySelectorAll('.heatmap__slot')).map((th) =>
      th.textContent?.trim(),
    );
    expect(headers).toEqual(['09:00', '10:00', '11:00']);
  });

  it('puts each count in its own cell, zeros included', () => {
    const cells = Array.from(render(matrix).querySelectorAll('.heatmap__cell')).map((td) =>
      td.textContent?.trim(),
    );
    expect(cells).toHaveLength(21);
    expect(cells.filter((text) => text === '0')).toHaveLength(18);
    expect(cells).toContain('4');
  });

  it('names every cell with its weekday, slot and count', () => {
    // The count is drawn in the cell already, so the tooltip is what supplies
    // the day and the hour it belongs to.
    const titles = Array.from(render(matrix).querySelectorAll('.heatmap__cell')).map((td) =>
      td.getAttribute('title'),
    );
    expect(titles).toContain('Tue 09:00 — 4 appointments');
    expect(titles).toContain('Wed 09:00 — 1 appointment');
    expect(titles).toContain('Wed 11:00 — 2 appointments');
    expect(titles).toContain('Mon 09:00 — 0 appointments');
  });

  it('uses a table, so the grid is a matrix of counts to a screen reader', () => {
    const host = render(matrix);
    expect(host.querySelector('table.heatmap__grid')).not.toBeNull();
    expect(host.querySelector('caption.visually-hidden')?.textContent).toContain(
      'by weekday and hour',
    );
    expect(host.querySelector('th[scope="col"]')).not.toBeNull();
    expect(host.querySelector('th[scope="row"]')).not.toBeNull();
  });

  it('names the measure and the period in its caption', () => {
    expect(
      render(matrix, { caption: 'By weekday and hour, last 14 days' })
        .querySelector('.heatmap__caption')
        ?.textContent?.trim(),
    ).toBe('By weekday and hour, last 14 days');
  });

  it('explains the colour scale with a low, medium and high key', () => {
    const keys = Array.from(render(matrix).querySelectorAll('.heatmap__key')).map((li) =>
      li.textContent?.trim(),
    );
    expect(keys).toEqual(['Low (1)', 'Medium (2)', 'High (3+)']);
  });

  it('shows an empty state when nothing falls in the window', () => {
    const host = render(
      { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], slots: [], cells: [], total: 0 },
      { emptyMessage: 'No appointments in this period.' },
    );
    expect(host.querySelector('table')).toBeNull();
    expect(host.querySelector('.heatmap__empty')?.textContent?.trim()).toBe(
      'No appointments in this period.',
    );
  });

  it('pans the grid rather than squeezing its cells below the width of the number', () => {
    expect(render(matrix).querySelector('.heatmap__scroll')).not.toBeNull();
  });
});

describe('heatLevel', () => {
  it('leaves an empty cell unshaded', () => {
    expect(heatLevel(0)).toBe(0);
  });

  it('shades any single appointment at all, so it is never drawn as nothing', () => {
    expect(heatLevel(1)).toBe(1);
  });

  it('bands on fixed counts rather than on a share of the busiest cell', () => {
    // A relative scale would draw the busiest cell darkest whatever it holds,
    // so a week whose busiest hour saw one appointment would call it "high".
    expect(heatLevel(2)).toBe(2);
    expect(heatLevel(3)).toBe(3);
    expect(heatLevel(99)).toBe(3);
  });

  it('gives the same count the same band every time', () => {
    expect(heatLevel(1)).toBe(heatLevel(1));
  });

  it('treats a negative count as empty', () => {
    expect(heatLevel(-1)).toBe(0);
  });
});
