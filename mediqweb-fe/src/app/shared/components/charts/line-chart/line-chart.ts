import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  viewChild,
} from '@angular/core';
import { Chart, type TooltipItem } from 'chart.js';
import { ChartHandle, plural, prefersReducedMotion, resolveToken } from '../chart-support';

/** A labelled count on a time axis, oldest first. */
export interface LinePoint {
  readonly label: string;
  readonly value: number;
}

/** Plot height. Wide enough for a readable curve, fixed so cards line up. */
const PLOT_HEIGHT = 260;

/**
 * A count per period, drawn as a line, with the same numbers always available
 * as text.
 *
 * The canvas is opaque to assistive technology and to any environment without a
 * layout engine, so the list under the plot states every point as text.
 */
@Component({
  selector: 'ui-line-chart',
  templateUrl: './line-chart.html',
  styleUrl: './line-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineChart implements OnDestroy {
  readonly points = input.required<readonly LinePoint[]>();
  /** A design token, e.g. `var(--color-primary)`. Never a raw colour. */
  readonly color = input('var(--color-primary)');
  /** Names the series and the period, e.g. "By day, last 14 days". */
  readonly caption = input<string | null>(null);
  /** What one unit is: `appointment` reads "2 appointments" in the tooltip. */
  readonly unit = input<string | null>(null);
  /** Shown instead of the plot when every point has fallen to zero. */
  readonly emptyMessage = input('No data yet');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly handle = new ChartHandle<'line'>();

  protected readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly plotHeight = PLOT_HEIGHT;

  /**
   * A day with no appointments is a fact about that day, so a zero is kept and
   * the line is drawn down to it. Only a window where *every* day is zero has
   * nothing to show, and that reads better as an empty state than as a flat
   * line along the axis.
   */
  protected readonly hasData = computed(() => this.points().some((point) => point.value > 0));

  constructor() {
    // Both paths run the same idempotent sync: the render callback covers the
    // first paint, when the canvas signal may still have been empty, and the
    // effect covers every later change to the points or to the canvas itself.
    afterNextRender(() => this.sync());
    effect(() => this.sync());
  }

  ngOnDestroy(): void {
    this.handle.clear();
  }

  /** The count as words, for the tooltip and for the text alternative. */
  protected describe(value: number): string {
    const unit = this.unit();
    return unit ? plural(value, unit) : String(value);
  }

  private sync(): void {
    const points = this.points();
    const canvas = this.canvas()?.nativeElement;

    if (!canvas || !this.hasData()) {
      this.handle.clear();
      return;
    }

    const chart = this.handle.own(canvas, () => this.create(canvas));
    if (!chart) return;

    const color = resolveToken(this.host, this.color());
    const dataset = chart.data.datasets[0];
    chart.data.labels = points.map((point) => point.label);
    dataset.data = points.map((point) => point.value);
    dataset.borderColor = color;
    dataset.backgroundColor = color;
    dataset.pointBackgroundColor = color;
    chart.update();
  }

  private create(canvas: HTMLCanvasElement): Chart<'line'> {
    const text = resolveToken(this.host, 'var(--color-text-secondary)');
    const border = resolveToken(this.host, 'var(--color-border)');

    return new Chart<'line'>(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            borderWidth: 2,
            // A gentle curve, but monotone, so the line never dips below a day
            // that had no appointments and never overshoots above a peak.
            tension: 0.3,
            cubicInterpolationMode: 'monotone',
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBorderWidth: 2,
            // The card's own surface, so a point reads as a dot on the line
            // rather than as a knot in it.
            pointBorderColor: resolveToken(this.host, 'var(--color-surface)'),
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: prefersReducedMotion() ? false : { duration: 400 },
        // Anywhere in a day's column, not just on the 6px dot. A point that
        // small should not have to be hit exactly to read its value.
        interaction: { mode: 'index', intersect: false },
        plugins: {
          // The text list below the plot is the accessible one; chart.js's own
          // legend would be a second copy of the card's heading.
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item: TooltipItem<'line'>) => this.describe(Number(item.raw)),
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            // Every point is a real day, so none is dropped to make the labels
            // fit; they rotate instead.
            ticks: { color: text, autoSkip: false, maxRotation: 45, font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: border },
            // Counts are whole appointments, so a fractional tick would be noise.
            ticks: { color: text, precision: 0, font: { size: 11 } },
          },
        },
      },
    });
  }
}
