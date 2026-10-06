import { describe, expect, it } from "vitest";
import { captureRevealConfig } from "../config";
import {
  BEATS,
  cursorAt,
  DROP,
  headlineAt,
  percentAt,
  SCENE_BEATS,
  SWAP_AT,
  toastAt,
  windowAt,
} from "../index";

/**
 * The curves were fitted to a recording; these pin the things that would look
 * wrong without being obviously wrong in review.
 *
 * The counter has to read what the recording reads on its first frame (79%)
 * and reach 100% the frame before the swap. The window has to stand still until
 * the recording starts it, and only ever drop and shrink. And the composition
 * has to hold the whole scene.
 */
describe("capture-reveal", () => {
  it("counts like the recording: 79% on its first frame, 100% before the swap", () => {
    expect(percentAt(0)).toBe(79);
    expect(percentAt(7)).toBe(100);
    expect(percentAt(40)).toBe(100);
    expect(toastAt(7).copied).toBe(false);
    expect(toastAt(SWAP_AT).copied).toBe(true);
  });

  it("holds the window still until the recording, then only drops and shrinks", () => {
    expect(windowAt(-10)).toEqual({ drop: 0, scale: 1 });
    let prev = windowAt(0);
    for (let n = 0.5; n <= SCENE_BEATS; n += 0.5) {
      const w = windowAt(n);
      expect(w.drop).toBeGreaterThanOrEqual(prev.drop);
      expect(w.scale).toBeLessThanOrEqual(prev.scale);
      prev = w;
    }
    expect(windowAt(30).drop).toBeCloseTo(DROP, 9);
  });

  it("keeps the headline hidden until the swap and lands it", () => {
    expect(headlineAt(SWAP_AT).opacity).toBe(0);
    const end = headlineAt(SCENE_BEATS);
    expect(end.opacity).toBe(1);
    expect(end.rise).toBeCloseTo(0, 9);
  });

  it("moves the cursor up and left, toward the toast", () => {
    const [x0, y0] = cursorAt(0);
    const [x1, y1] = cursorAt(28);
    expect(x1).toBeLessThan(x0);
    expect(y1).toBeLessThan(y0);
  });

  it("gives the composition the whole scene", () => {
    const { durationInFrames, fps } = captureRevealConfig;
    expect(durationInFrames).toBe(Math.round((SCENE_BEATS / BEATS) * fps));
  });
});
