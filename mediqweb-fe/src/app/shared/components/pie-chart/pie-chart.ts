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
import { ArcElement, Chart, PieController, Tooltip } from 'chart.js';

export interface PieSlice {
  readonly label: string;
  readonly value: number;
  /** A design token, e.g. `var(--color-info)`. Never a raw colour. */
  readonly color: string;
}

/**
 * Register only the parts of chart.js a pie needs. Importing `chart.js/auto`
 * would pull every controller and element into the bundle for the sake of one
 * chart on one dashboard.
 */
Chart.register(PieController, ArcElement, Tooltip);

/** The canvas cannot paint under jsdom or SSR, where there is no layout engine. */
function canDraw(): boolean {
  // Checked before anything touches the 2D context: jsdom answers `getContext`
  // with a "Not implemented" console error every time it is asked.
  return typeof ResizeObserver !== 'undefined';
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Proportion chart drawn on a canvas, with the same numbers always available
 * as text in the legend underneath it.
 *
 * The legend is not a substitute for the chart and the chart is not a
 * substitute for the legend: canvas is opaque to assistive technology and to
 * any environment without a layout engine, so the text is what makes the data
 * readable there, and it is what a sighted user reads when the arcs are too
 * close to tell apart.
 *
 * ```html
 * <ui-pie-chart [slices]="slices" caption="By severity" />
 * ```
 */
@Component({
  selector: 'ui-pie-chart',
  templateUrl: './pie-chart.html',
  styleUrl: './pie-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PieChart implements OnDestroy {
  /** One entry per segment. Slices with no value are dropped, not drawn flat. */
  readonly slices = input.required<readonly PieSlice[]>();
  /** Names the breakdown, e.g. "By severity". */
  readonly caption = input<string | null>(null);
  /** Shown instead of the plot when every slice has fallen to zero. */
  readonly emptyMessage = input('No data yet');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private chart: Chart<'pie'> | null = null;

  protected readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly visibleSlices = computed(() =>
    this.slices().filter((slice) => slice.value > 0),
  );

  constructor() {
    // Both paths run the same idempotent sync: the render callback covers the
    // first paint, when the canvas signal may still have been empty, and the
    // effect covers every later change to the slices or to the canvas itself.
    afterNextRender(() => this.sync());
    effect(() => this.sync());
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  private sync(): void {
    const slices = this.visibleSlices();
    const canvas = this.canvas()?.nativeElement;

    if (!canvas || slices.length === 0) {
      this.destroyChart();
      return;
    }

    // The canvas lives under an `@if`, so an emptied and refilled chart gets a
    // fresh element. Chart.js refuses to be handed a canvas it already owns.
    if (this.chart && this.chart.canvas !== canvas) {
      this.destroyChart();
    }

    const labels = slices.map((slice) => slice.label);
    const values = slices.map((slice) => slice.value);
    const colors = slices.map((slice) => this.resolve(slice.color));

    if (!this.chart) {
      if (!canDraw()) return;
      this.chart = new Chart<'pie'>(canvas, {
        type: 'pie',
        data: {
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: colors,
              // The card's own surface, so the border reads as the gap between
              // arcs rather than as a second outline.
              borderColor: this.resolve('var(--color-surface)'),
              borderWidth: 2,
              hoverOffset: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: prefersReducedMotion() ? false : { duration: 400 },
          plugins: {
            // The legend below is the accessible one; chart.js's own is a
            // second copy in colours this component does not control.
            legend: { display: false },
            tooltip: {
              callbacks: { label: (item) => `${item.label}: ${item.formattedValue}` },
            },
          },
        },
      });
      return;
    }

    const dataset = this.chart.data.datasets[0];
    this.chart.data.labels = labels;
    dataset.data = values;
    dataset.backgroundColor = colors;
    this.chart.update();
  }

  /**
   * Turns `var(--color-info)` into the colour that token currently holds.
   *
   * Canvas does not understand custom properties, so the value has to be
   * resolved against this element's computed style before it reaches
   * chart.js. Anything that is not a single `var()` — a raw hex from a
   * caller — is passed through untouched.
   */
  private resolve(color: string): string {
    const token = /^var\(\s*(--[\w-]+)\s*\)$/.exec(color.trim())?.[1];
    if (!token) return color;
    return getComputedStyle(this.host).getPropertyValue(token).trim() || color;
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = null;
  }
}
