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
import {
  ChartHandle,
  plural,
  prefersReducedMotion,
  resolveToken,
  resolveTokenNumber,
} from '../chart-support';

/** A labelled count. Order is the caller's. */
export interface ChartBar {
  readonly label: string;
  readonly value: number;
}

/** `vertical` reads counts up columns; `horizontal` reads names down rows. */
export type BarOrientation = 'vertical' | 'horizontal';

/** Plot height in the vertical orientation, where the width is the card's. */
const VERTICAL_HEIGHT = 260;
/** Space one horizontal bar needs, so its name is never dropped to fit. */
const ROW_HEIGHT = 34;
/** Fixed chrome — axis labels and padding — above the first horizontal bar. */
const HORIZONTAL_CHROME = 48;

/**
 * Counts drawn as bars, with the same numbers always available as text.
 *
 * Both orientations are one component because they are one chart: the same bar
 * controller, the same axes and the same tooltip, differing only in which axis
 * carries the categories. Two components would have meant two copies of the
 * axis and tooltip configuration to keep in step.
 *
 * The canvas is opaque to assistive technology and to any environment without a
 * layout engine, so the list under the plot states every bar as text. It is
 * hidden from the layout, not from a screen reader.
 */
@Component({
  selector: 'ui-bar-chart',
  templateUrl: './bar-chart.html',
  styleUrl: './bar-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarChart implements OnDestroy {
  readonly bars = input.required<readonly ChartBar[]>();
  /** `horizontal` puts the categories down the side, which long names need. */
  readonly orientation = input<BarOrientation>('vertical');
  /** A design token, e.g. `var(--color-primary)`. Never a raw colour. */
  readonly color = input('var(--color-primary)');
  /** Names the breakdown, e.g. "By month". Sits above the plot. */
  readonly caption = input<string | null>(null);
  /** What one unit is: `registration` reads "2 registrations" in the tooltip. */
  readonly unit = input<string | null>(null);
  /** Shown instead of the plot when every bar has fallen to zero. */
  readonly emptyMessage = input('No data yet');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly handle = new ChartHandle<'bar'>();
  /** The orientation the live chart was built with; a change needs a rebuild. */
  private builtAs: BarOrientation | null = null;

  protected readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  /**
   * Zero bars are kept — a month with no registrations is a fact about that
   * month, and dropping it would draw a continuous climb that never happened.
   * A chart where *every* bar is zero has nothing to say, though, and an empty
   * state says that better than a row of flat stubs.
   */
  protected readonly hasData = computed(() => this.bars().some((bar) => bar.value > 0));

  protected readonly plotHeight = computed(() => {
    if (this.orientation() === 'vertical') return VERTICAL_HEIGHT;
    return Math.max(VERTICAL_HEIGHT, this.bars().length * ROW_HEIGHT + HORIZONTAL_CHROME);
  });

  constructor() {
    // Both paths run the same idempotent sync: the render callback covers the
    // first paint, when the canvas signal may still have been empty, and the
    // effect covers every later change to the bars or to the canvas itself.
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
    const bars = this.bars();
    const orientation = this.orientation();
    const canvas = this.canvas()?.nativeElement;

    // The axis the categories sit on is fixed when the chart is built, so a
    // changed orientation has to rebuild rather than silently keep the old one.
    if (this.builtAs !== orientation) {
      this.handle.clear();
      this.builtAs = orientation;
    }

    if (!canvas || !this.hasData()) {
      this.handle.clear();
      return;
    }

    const chart = this.handle.own(canvas, () => this.create(canvas, orientation));
    if (!chart) return;

    chart.data.labels = bars.map((bar) => bar.label);
    chart.data.datasets[0].data = bars.map((bar) => bar.value);
    chart.data.datasets[0].backgroundColor = resolveToken(this.host, this.color());
    chart.update();
  }

  private create(canvas: HTMLCanvasElement, orientation: BarOrientation): Chart<'bar'> {
    const vertical = orientation === 'vertical';
    const text = resolveToken(this.host, 'var(--color-text-secondary)');
    const border = resolveToken(this.host, 'var(--color-border)');

    const category = {
      grid: { display: false },
      // `autoSkip` off because every category is a real month or a real doctor:
      // dropping one to make the labels fit would quietly remove a row of data.
      ticks: { color: text, autoSkip: false, maxRotation: 45, font: { size: 11 } },
    };
    const value = {
      beginAtZero: true,
      grid: { color: border },
      // Counts are whole appointments, so a fractional tick would be noise.
      ticks: { color: text, precision: 0, font: { size: 11 } },
    };

    return new Chart<'bar'>(canvas, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            backgroundColor: resolveToken(this.host, this.color()),
            borderRadius: resolveTokenNumber(this.host, '--radius-sm', 0),
            maxBarThickness: 40,
          },
        ],
      },
      options: {
        indexAxis: vertical ? 'x' : 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: prefersReducedMotion() ? false : { duration: 400 },
        plugins: {
          // The text list below the plot is the accessible one; chart.js's own
          // legend would be a second copy of the card's heading.
          legend: { display: false },
          tooltip: {
            callbacks: { label: (item: TooltipItem<'bar'>) => this.describe(Number(item.raw)) },
          },
        },
        scales: vertical ? { x: category, y: value } : { x: value, y: category },
      },
    });
  }
}
