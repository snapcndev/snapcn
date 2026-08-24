import { describe, expect, it } from "vitest";
import {
  clampZoom,
  DEFAULT_PX_PER_SECOND,
  fitPxPerSecond,
  formatTimecode,
  MAX_PX_PER_SECOND,
  MIN_PX_PER_SECOND,
  rulerTicks,
  sliderToZoom,
  tickStep,
  zoomToSlider,
} from "../timeline-zoom";

describe("tickStep", () => {
  it("widens the interval as the zoom drops, so labels never collide", () => {
    // 56px minimum gap: at 60px/s a 1s interval clears it, at 6px/s it does not.
    expect(tickStep(60)).toBe(1);
    expect(tickStep(6)).toBe(10);
    expect(tickStep(1)).toBe(60);
  });

  it("only ever picks an interval a viewer would have guessed", () => {
    const allowed = new Set([1, 2, 5, 10, 15, 30, 60, 120, 300, 600]);
    for (let px = MIN_PX_PER_SECOND; px <= MAX_PX_PER_SECOND; px++) {
      expect(allowed.has(tickStep(px))).toBe(true);
    }
  });
});

describe("rulerTicks", () => {
  it("puts every major tick exactly on its second — no accumulated drift", () => {
    const majors = rulerTicks(600, 60).filter((t) => t.major);
    for (const tick of majors) {
      expect(tick.seconds).toBeCloseTo(Math.round(tick.seconds), 10);
      expect(tick.x).toBeCloseTo(tick.seconds * 60, 10);
    }
  });

  it("closes on a tick at or before the end, never past it", () => {
    for (const total of [5, 12.5, 40, 137]) {
      const ticks = rulerTicks(total, 48);
      expect(ticks[0].seconds).toBe(0);
      expect(ticks[ticks.length - 1].seconds).toBeLessThanOrEqual(total + 1e-9);
    }
  });

  it("never crowds two ticks closer than a hairline, at any zoom", () => {
    // This is what makes the dropped `emitMinors` guard unnecessary: because
    // majors are held >= MIN_LABEL_GAP_PX apart, a fifth of that is always
    // legible. If the step table or MINOR_PER_MAJOR ever changes, this fails.
    for (let px = MIN_PX_PER_SECOND; px <= MAX_PX_PER_SECOND; px += 4) {
      const ticks = rulerTicks(300, px);
      for (let i = 1; i < ticks.length; i++) {
        expect(ticks[i].x - ticks[i - 1].x).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it("is monotonic in x", () => {
    const ticks = rulerTicks(90, 24);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].x).toBeGreaterThan(ticks[i - 1].x);
    }
  });
});

describe("formatTimecode", () => {
  it("floors rather than rounds, so the clock never reads ahead", () => {
    expect(formatTimecode(0)).toBe("0:00");
    expect(formatTimecode(5.9)).toBe("0:05");
    expect(formatTimecode(83)).toBe("1:23");
    expect(formatTimecode(600)).toBe("10:00");
  });

  it("never renders a negative clock", () => {
    expect(formatTimecode(-4)).toBe("0:00");
  });
});

describe("zoom", () => {
  it("round-trips to within one slider step", () => {
    // 101 positions across a log range means each step is ~3.4%. A round-trip
    // cannot beat the slider's own resolution, so that is what we assert —
    // anything tighter is a test that only passes by luck.
    for (const px of [MIN_PX_PER_SECOND, 24, DEFAULT_PX_PER_SECOND, 120]) {
      const back = sliderToZoom(zoomToSlider(px));
      expect(Math.abs(back - px) / px).toBeLessThan(0.035);
    }
  });

  it("clamps both ends", () => {
    expect(clampZoom(0)).toBe(MIN_PX_PER_SECOND);
    expect(clampZoom(1e6)).toBe(MAX_PX_PER_SECOND);
    expect(sliderToZoom(-50)).toBe(MIN_PX_PER_SECOND);
    expect(sliderToZoom(500)).toBe(MAX_PX_PER_SECOND);
  });

  it("fits the timeline to the track, and survives a zero width", () => {
    expect(fitPxPerSecond(10, 480)).toBeCloseTo(48, 5);
    // Before the track is measured, fall back rather than divide by zero.
    expect(fitPxPerSecond(10, 0)).toBe(DEFAULT_PX_PER_SECOND);
    expect(fitPxPerSecond(0, 480)).toBe(DEFAULT_PX_PER_SECOND);
    expect(Number.isFinite(fitPxPerSecond(0.0001, 480))).toBe(true);
  });
});
