/**
 * Timeline ruler + zoom maths. Pure, so it can be tested without a DOM — the
 * bugs in a timeline are all arithmetic (a tick every 0.3s, a clip one pixel
 * wide, a playhead that drifts from the ruler), and none of them are visible
 * until someone with a 40-second video opens the editor.
 */

/** Pixels per second of timeline, at each end of the zoom slider. */
export const MIN_PX_PER_SECOND = 8;
export const MAX_PX_PER_SECOND = 240;
export const DEFAULT_PX_PER_SECOND = 48;

/**
 * Tick intervals we are willing to label, in seconds. Every one divides a
 * minute (or is a whole number of them), so the labels a viewer reads are the
 * ones they would have guessed — never `|7s |14s |21s`.
 */
const TICK_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600] as const;

/** Minimum gap between two labels before they read as one smear. */
const MIN_LABEL_GAP_PX = 56;

/**
 * Minor ticks per labelled tick — the unlabelled hairlines between them.
 *
 * No "are these too close together?" guard: `tickStep` already keeps majors at
 * least `MIN_LABEL_GAP_PX` apart, so a fifth of that is 11.2px at the very
 * worst. Any check here would be a branch that can never run.
 */
const MINOR_PER_MAJOR = 5;

export interface Tick {
  /** Position on the ruler, in seconds from zero. */
  seconds: number;
  /** Offset from the track's left edge, in pixels. */
  x: number;
  /** Labelled (`|10s`) rather than a bare hairline. */
  major: boolean;
}

/**
 * The largest tick interval whose labels still fit at this zoom, in seconds.
 *
 * Falls back to the coarsest step rather than looping forever: at
 * `MIN_PX_PER_SECOND` a 10-minute interval is 80px, so the list only runs out
 * for timelines far longer than `MAX_TOTAL_FRAMES` allows.
 */
export function tickStep(pxPerSecond: number): number {
  for (const step of TICK_STEPS) {
    if (step * pxPerSecond >= MIN_LABEL_GAP_PX) return step;
  }
  return TICK_STEPS[TICK_STEPS.length - 1];
}

/**
 * Every tick from 0 to `totalSeconds` inclusive, majors labelled.
 *
 * Inclusive of the end so the ruler always closes on a tick instead of trailing
 * off mid-interval.
 */
export function rulerTicks(totalSeconds: number, pxPerSecond: number): Tick[] {
  const major = tickStep(pxPerSecond);
  const stride = major / MINOR_PER_MAJOR;

  const ticks: Tick[] = [];
  // Integer loop, not `for (t = 0; t <= end; t += stride)` — accumulating a
  // fractional stride drifts, and the drift is exactly what puts a "10s" label
  // half a pixel off the clip boundary it is meant to line up with.
  const count = Math.floor(totalSeconds / stride);
  for (let i = 0; i <= count; i++) {
    const seconds = i * stride;
    ticks.push({
      seconds,
      x: seconds * pxPerSecond,
      // Floating-point stride means `seconds % major` is never exactly 0.
      major: Math.abs(seconds / major - Math.round(seconds / major)) < 1e-9,
    });
  }
  return ticks;
}

/** `0:05`, `1:23`. Seconds floored — a clock that rounds up reads as ahead. */
export function formatTimecode(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  return `${mins}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * The zoom at which the whole timeline just fits `availableWidth`, clamped to
 * the slider's range. Guards a zero/absent width (the first render, before the
 * track has been measured) by falling back to the default rather than dividing
 * by zero and zooming to infinity.
 */
export function fitPxPerSecond(
  totalSeconds: number,
  availableWidth: number,
): number {
  if (!(totalSeconds > 0) || !(availableWidth > 0)) {
    return DEFAULT_PX_PER_SECOND;
  }
  return clampZoom(availableWidth / totalSeconds);
}

export function clampZoom(pxPerSecond: number): number {
  return Math.min(MAX_PX_PER_SECOND, Math.max(MIN_PX_PER_SECOND, pxPerSecond));
}

/**
 * Zoom as the 0–100 the slider moves in, mapped logarithmically: the useful
 * detail is all at the low end, and a linear slider spends three quarters of
 * its travel between "very zoomed in" and "very very zoomed in".
 */
export function zoomToSlider(pxPerSecond: number): number {
  const t =
    (Math.log(clampZoom(pxPerSecond)) - Math.log(MIN_PX_PER_SECOND)) /
    (Math.log(MAX_PX_PER_SECOND) - Math.log(MIN_PX_PER_SECOND));
  return Math.round(t * 100);
}

export function sliderToZoom(value: number): number {
  const t = Math.min(100, Math.max(0, value)) / 100;
  const px = Math.exp(
    Math.log(MIN_PX_PER_SECOND) +
      t * (Math.log(MAX_PX_PER_SECOND) - Math.log(MIN_PX_PER_SECOND)),
  );
  // Round off the float dust before clamping: the exponential lands on
  // 239.99999999999997 at the top of the travel, which is not MAX, so the
  // slider could never actually reach its own maximum.
  return clampZoom(Math.round(px * 1000) / 1000);
}
