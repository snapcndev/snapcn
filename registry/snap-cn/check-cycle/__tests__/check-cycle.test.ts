import { describe, expect, it } from "vitest";
import { checkCycleConfig } from "../config";
import {
  restOf,
  sceneLength,
  stripAt,
  TRAVEL,
  ZOOM_REST,
  ZOOM_TO,
  zoomAt,
  zoomStart,
} from "../index";

/**
 * Three things here can be wrong without looking wrong in review.
 *
 * The strip has to land each word exactly on the slot. `TRAVEL` alternates, so
 * the strip's rest after k rolls and the k-th word's place on it are two sums
 * of the same table — if they drift apart the scene stops a pixel off, forever.
 *
 * The composition has to end on the last word at rest, not mid-roll.
 *
 * And the roll must only move forwards: the strip's travel is a sum of eased
 * steps, and a step that started before the last one finished would pull back.
 */
describe("check-cycle", () => {
  it("lands every word exactly on the slot", () => {
    for (const n of [2, 3, 5]) {
      const done = stripAt(60, n);
      expect(done).toBeCloseTo(restOf(n - 1), 9);
    }
    expect(restOf(1)).toBe(TRAVEL[0]);
    expect(restOf(2)).toBe(TRAVEL[0] + TRAVEL[1]);
  });

  it("rolls forwards only", () => {
    let prev = -1;
    for (let f = 0; f <= 90; f++) {
      const s = stripAt(f / 30, 3);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });

  it("steps back only a little, and rests before the end", () => {
    expect(zoomAt(zoomStart(6) - 0.01, 6)).toBe(1);
    expect(zoomAt(sceneLength(6), 6)).toBeCloseTo(ZOOM_TO, 9);
    expect(zoomAt(sceneLength(6) - ZOOM_REST, 6)).toBeCloseTo(ZOOM_TO, 9);
  });

  it("ends on the last word, with the composition", () => {
    expect(stripAt(sceneLength(6), 6)).toBeCloseTo(restOf(5), 9);
    const { durationInFrames, fps } = checkCycleConfig;
    expect(Math.ceil(sceneLength(6) * fps)).toBe(durationInFrames);
  });
});
