import { describe, expect, it } from "vitest";
import { moveItem, slotAtX } from "../reorder";
import { CANVAS, type Clip } from "../types";

const clip = (id: string, seconds: number): Clip => ({
  id,
  slug: "text-reveal",
  props: {},
  durationInFrames: seconds * CANVAS.fps,
});

describe("moveItem", () => {
  it("moves right without dropping a slot short", () => {
    // The classic off-by-one: splice out first, and every index to the right
    // shifts down by one. a,b,c,d with 0 -> 2 must land a *after* c.
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
  });

  it("moves left without landing a slot long", () => {
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("handles the ends", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("returns the input untouched for a no-op or an out-of-range index", () => {
    const arr = ["a", "b", "c"];
    for (const [from, to] of [
      [1, 1],
      [-1, 0],
      [0, -1],
      [5, 0],
      [0, 5],
    ]) {
      expect(moveItem(arr, from, to)).toEqual(arr);
    }
  });

  it("never loses or duplicates an item", () => {
    const arr = [0, 1, 2, 3, 4, 5];
    for (let from = 0; from < arr.length; from++) {
      for (let to = 0; to < arr.length; to++) {
        const out = moveItem(arr, from, to);
        expect(out.length).toBe(arr.length);
        expect([...out].sort()).toEqual(arr);
      }
    }
  });
});

describe("slotAtX", () => {
  // 2s, 4s, 2s at 50px/s → widths 100, 200, 100; edges at 0, 100, 300, 400.
  const clips = [clip("a", 2), clip("b", 4), clip("c", 2)];
  const PX = 50;

  it("swaps at the midpoint of a clip, not at its leading edge", () => {
    // Clip b spans 100..300, midpoint 200. Just before it, the pointer is still
    // claiming b's slot; just after, it has moved past into c's.
    expect(slotAtX(clips, 199, PX)).toBe(1);
    expect(slotAtX(clips, 201, PX)).toBe(2);
  });

  it("claims the first slot before the first midpoint", () => {
    expect(slotAtX(clips, 0, PX)).toBe(0);
    expect(slotAtX(clips, 49, PX)).toBe(0);
    expect(slotAtX(clips, 51, PX)).toBe(1);
  });

  it("clamps past either end rather than returning -1", () => {
    expect(slotAtX(clips, -500, PX)).toBe(0);
    expect(slotAtX(clips, 99_999, PX)).toBe(2);
  });

  it("is empty-safe", () => {
    expect(slotAtX([], 120, PX)).toBe(0);
  });

  it("tracks the zoom, so the same drag means the same slot at any scale", () => {
    // Midpoint of b is 4s in at every zoom; the pixel value moves with it.
    for (const px of [8, 50, 240]) {
      expect(slotAtX(clips, 4 * px - 1, px)).toBe(1);
      expect(slotAtX(clips, 4 * px + 1, px)).toBe(2);
    }
  });
});
