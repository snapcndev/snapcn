/**
 * Unit tests for the timeline frame budget in lib/video-editor/types.ts.
 *
 * Run with:  pnpm vitest run lib/video-editor/__tests__/budget.test.ts
 *
 * Two bugs these pin:
 *
 *  1. `MAX_CLIPS` was 12 and was the limit everyone actually hit — twelve
 *     3.2s clips is 41s, and the editor refused a thirteenth while 139s of the
 *     three-minute budget sat unspent.
 *  2. The editor never checked `MAX_TOTAL_FRAMES` at all, so a timeline could
 *     be built past the length `parseVideoTimelineInput` accepts and only fail
 *     at export — after the render had been waited on.
 */

import { describe, expect, it } from "vitest";
import {
  CANVAS,
  type Clip,
  MAX_CLIP_FRAMES,
  MAX_CLIPS,
  MAX_TOTAL_FRAMES,
  maxFramesForClip,
  remainingFrames,
  totalDuration,
} from "@/lib/video-editor/types";

const clip = (id: string, frames: number): Clip => ({
  id,
  slug: "text-reveal",
  props: {},
  durationInFrames: frames,
  background: "#000000",
});

/** n clips of `frames` each, ids `c0…c{n-1}`. */
const clips = (n: number, frames: number) =>
  Array.from({ length: n }, (_, i) => clip(`c${i}`, frames));

describe("remainingFrames", () => {
  it("an empty timeline has spent nothing", () => {
    // Not 5399: `totalDuration` floors at 1 for the Player's sake, and that
    // floor must not be charged to the budget.
    expect(remainingFrames([])).toBe(MAX_TOTAL_FRAMES);
    expect(totalDuration([])).toBe(1);
  });

  it("subtracts what the clips actually use", () => {
    expect(remainingFrames(clips(3, 100))).toBe(MAX_TOTAL_FRAMES - 300);
  });

  it("never goes negative", () => {
    expect(remainingFrames(clips(10, MAX_CLIP_FRAMES))).toBe(0);
  });

  it("the old 12-clip wall is gone: 13 clips of 3.2s still leaves room", () => {
    // The exact case that was reported — 0:41 on the clock, add refused.
    const thirteen = clips(13, Math.round(3.2 * CANVAS.fps));
    expect(thirteen.length).toBeLessThanOrEqual(MAX_CLIPS);
    expect(remainingFrames(thirteen)).toBeGreaterThan(0);
  });

  it("duration is the binding limit for clips of 3s or more", () => {
    // MAX_CLIPS must not be reachable before the frame budget for normal clips.
    const threeSeconds = 3 * CANVAS.fps;
    expect(MAX_CLIPS * threeSeconds).toBeGreaterThanOrEqual(MAX_TOTAL_FRAMES);
  });
});

describe("maxFramesForClip", () => {
  it("offers the per-clip ceiling when the timeline is nearly empty", () => {
    expect(maxFramesForClip([clip("a", 30)], "a")).toBe(MAX_CLIP_FRAMES);
  });

  it("excludes the clip's own frames — resizing must not fight itself", () => {
    // 'a' already holds 1000 frames; those are its to keep, not spend again.
    const list = [clip("a", 1000), clip("b", 1000)];
    expect(maxFramesForClip(list, "a")).toBe(
      Math.min(MAX_CLIP_FRAMES, MAX_TOTAL_FRAMES - 1000),
    );
  });

  it("shrinks to what the budget has left once others are paid for", () => {
    const others = MAX_TOTAL_FRAMES - 200;
    const list = [clip("a", 50), clip("b", others)];
    expect(maxFramesForClip(list, "a")).toBe(200);
  });

  it("never returns 0 — a clip must always have a legal length", () => {
    const list = [clip("a", 10), clip("b", MAX_TOTAL_FRAMES)];
    expect(maxFramesForClip(list, "a")).toBe(1);
  });

  it("an unknown id is charged for everything, and still gets a legal length", () => {
    expect(maxFramesForClip(clips(2, 100), "nope")).toBe(
      Math.min(MAX_CLIP_FRAMES, MAX_TOTAL_FRAMES - 200),
    );
  });
});

describe("the editor and the server agree on the same ceiling", () => {
  it("a timeline built to the budget is exactly what the validator accepts", () => {
    // parseVideoTimelineInput rejects `totalFrames > MAX_TOTAL_FRAMES`; a
    // timeline the editor considers full must sit on the legal side of that.
    const full = clips(3, MAX_TOTAL_FRAMES / 3);
    expect(remainingFrames(full)).toBe(0);
    expect(totalDuration(full)).toBe(MAX_TOTAL_FRAMES);
    expect(totalDuration(full)).toBeLessThanOrEqual(MAX_TOTAL_FRAMES);
  });
});
