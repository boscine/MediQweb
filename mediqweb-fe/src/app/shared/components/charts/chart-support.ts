import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  type ChartType,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';

/**
 * The chart.js pieces the dashboard's bar, line and heatmap charts need.
 *
 * Registered explicitly rather than through `chart.js/auto`, which would pull
 * in every controller and element the library ships. `pie-chart` registers its
 * own three for the same reason and is left alone: a pie that started depending
 * on a file added for a different chart would be a change to a component this
 * work is meant to leave exactly as it is.
 */
Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
);

/** The canvas cannot paint under jsdom or SSR, where there is no layout engine. */
export function canDraw(): boolean {
  // Checked before anything touches the 2D context: jsdom answers `getContext`
  // with a "Not implemented" console error every time it is asked.
  return typeof ResizeObserver !== 'undefined';
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Turns `var(--color-info)` into the colour that token currently holds.
 *
 * Canvas does not understand custom properties, so the value has to be resolved
 * against a computed style before it reaches chart.js. Anything that is not a
 * single `var()` — a raw hex from a caller — is passed through untouched.
 */
export function resolveToken(host: HTMLElement, color: string): string {
  const token = /^var\(\s*(--[\w-]+)\s*\)$/.exec(color.trim())?.[1];
  if (!token) return color;
  return getComputedStyle(host).getPropertyValue(token).trim() || color;
}

/**
 * A length token as a plain number, for the parts of chart.js that take one —
 * `borderRadius` is a number of pixels, not a CSS length.
 *
 * `fallback` covers both an environment with no stylesheet and a token that is
 * not a length at all, since chart.js would draw something strange rather than
 * complain.
 */
export function resolveTokenNumber(host: HTMLElement, token: string, fallback: number): number {
  const value = Number.parseFloat(getComputedStyle(host).getPropertyValue(token));
  return Number.isFinite(value) ? value : fallback;
}

/** `(1, 'appointment')` -> `'1 appointment'`; `(0, …)` -> `'0 appointments'`. */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * Owns one chart.js instance for the life of a component whose canvas sits
 * under an `@if`.
 *
 * Two hazards it exists to close, both easy to get subtly wrong: an emptied and
 * refilled chart gets a fresh canvas, and chart.js refuses to be handed a
 * canvas it already owns; and an environment with no layout engine cannot be
 * handed one at all. Copied into three components, both would be got wrong in
 * the same way three times.
 */
export class ChartHandle<TType extends ChartType> {
  private chart: Chart<TType> | null = null;

  /** Drops the chart, for when the component has nothing left to draw. */
  clear(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  /**
   * The chart bound to `canvas`, built by `build` the first time it is needed.
   *
   * `null` when the environment cannot draw, which is not an error and not
   * something a caller should branch on — the chart is simply absent.
   */
  own(canvas: HTMLCanvasElement, build: () => Chart<TType>): Chart<TType> | null {
    if (this.chart && this.chart.canvas !== canvas) this.clear();
    if (!this.chart) {
      if (!canDraw()) return null;
      this.chart = build();
    }
    return this.chart;
  }
}
