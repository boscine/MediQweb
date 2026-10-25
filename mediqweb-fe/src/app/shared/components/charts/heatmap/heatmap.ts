import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { plural } from '../chart-support';

/** One cell: a weekday, an hour bucket, and the count that falls in it. */
export interface HeatmapCell {
  /** 0 = Monday … 6 = Sunday, index into `days`. */
  readonly dayIndex: number;
  /** Index into `slots`. */
  readonly slotIndex: number;
  readonly count: number;
}

/** The whole grid, already aggregated. */
export interface HeatmapMatrix {
  readonly days: readonly string[];
  readonly slots: readonly string[];
  /** Row-major: every slot of the first day, then every slot of the second. */
  readonly cells: readonly HeatmapCell[];
  readonly total: number;
}

/** Counts at or above this are the darkest band. */
const HIGH_AT = 3;
/** Counts at or above this, and below `HIGH_AT`, are the middle band. */
const MEDIUM_AT = 2;

/** The three bands the legend names, with the count each one starts at. */
const LEGEND: readonly { level: 1 | 2 | 3; label: string }[] = [
  { level: 1, label: 'Low (1)' },
  { level: 2, label: `Medium (${MEDIUM_AT})` },
  { level: 3, label: `High (${HIGH_AT}+)` },
];

/**
 * The intensity band a count falls in, 0–3.
 *
 * Fixed thresholds rather than a share of the busiest cell. A relative scale
 * paints whatever the busiest cell holds in the darkest band, so a fortnight
 * whose busiest hour saw a single appointment would draw it as high activity —
 * true of the chart and false about the clinic. Fixed steps mean a colour always
 * stands for the same number of appointments, which is also what lets the legend
 * say which number that is; any non-zero count reaches at least band 1, so one
 * appointment is never drawn as an empty cell.
 */
export function heatLevel(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count >= HIGH_AT) return 3;
  if (count >= MEDIUM_AT) return 2;
  return 1;
}

/**
 * When the clinic is busiest, as a grid of weekdays against hours.
 *
 * A table rather than a canvas. chart.js has no heatmap without a plugin, and a
 * table is a better fit anyway: the grid is a matrix of counts, which is what a
 * table means, so every cell's value is in the accessibility tree without a
 * text alternative being bolted on beside an opaque canvas.
 *
 * Every count is drawn in its cell. Hiding the zeros would make the lightest
 * band mean two different things — "nothing" and "nothing visible" — and the
 * point of the chart is to show which hours are quiet.
 */
@Component({
  selector: 'ui-heatmap',
  templateUrl: './heatmap.html',
  styleUrl: './heatmap.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Heatmap {
  readonly matrix = input.required<HeatmapMatrix>();
  /** Names the measure and the period, e.g. "By weekday and hour, last 14 days". */
  readonly caption = input<string | null>(null);
  /** What one unit is, for the cell tooltip: `appointment` reads "2 appointments". */
  readonly unit = input('appointment');
  /** Shown instead of the grid when no appointment falls in the window. */
  readonly emptyMessage = input('No data yet');

  protected readonly legend = LEGEND;

  protected readonly hasData = computed(() => this.matrix().total > 0);

  /**
   * The cells grouped one row per weekday, Monday first.
   *
   * Grouped here rather than in the aggregation so the matrix stays the plain
   * grid of numbers it is and the shape of the table stays a template concern.
   */
  protected readonly rows = computed(() =>
    this.matrix().days.map((name, dayIndex) => ({
      name,
      cells: this.matrix().cells.filter((cell) => cell.dayIndex === dayIndex),
    })),
  );

  /** The table's own caption, which only assistive technology hears. */
  protected readonly tableCaption = computed(
    () => `${this.caption() ?? 'Appointment volume'}, by weekday and hour`,
  );

  protected level(count: number): number {
    return heatLevel(count);
  }

  /** Names the cell in full, so a count is never read without its slot. */
  protected tooltip(cell: HeatmapCell): string {
    const matrix = this.matrix();
    const day = matrix.days[cell.dayIndex];
    const slot = matrix.slots[cell.slotIndex];
    return `${day} ${slot} — ${plural(cell.count, this.unit())}`;
  }
}
