/**
 * The playback plan — lib/demo-governor.ts.
 *
 * Run with:  pnpm vitest run lib/__tests__/demo-governor.test.ts
 *
 * Pins the three faults measured on the built gallery at 1440x900: videos
 * playing off-screen, no ceiling on how many decode at once, and elements that
 * kept their src and their buffer forever once scrolled past.
 */

import { describe, expect, it } from "vitest";
import { type DemoView, MAX_PLAYING, planDemos } from "@/lib/demo-governor";

const grid = (ratios: number[], near = true): Map<number, DemoView> =>
  new Map(ratios.map((ratio, i) => [i, { ratio, near }]));

describe("planDemos", () => {
  it("plays what is on screen and nothing else", () => {
    const plan = planDemos(grid([0.9, 0, 0.4, 0]));
    expect([...plan.values()]).toEqual(["play", "ready", "play", "ready"]);
  });

  it("caps how many decode at once, keeping the most visible", () => {
    const ratios = Array.from(
      { length: MAX_PLAYING + 8 },
      (_, i) => 1 - i / 100,
    );
    const plan = planDemos(grid(ratios));
    const playing = [...plan.entries()].filter(([, s]) => s === "play");
    expect(playing).toHaveLength(MAX_PLAYING);
    // The ones that lose are the least-visible, not whichever registered last.
    expect(playing.map(([k]) => k)).toEqual(
      Array.from({ length: MAX_PLAYING }, (_, i) => i),
    );
    expect([...plan.values()].filter((s) => s === "hold")).toHaveLength(8);
  });

  it("plays the demo the reader opened even when the grid behind it fills the cap", () => {
    // The overlay's video registers last, is no more visible than the cards
    // under the modal, and used to lose the tie to all of them.
    const views = grid(Array(MAX_PLAYING).fill(1));
    views.set(99, { ratio: 1, near: true, priority: true });
    const plan = planDemos(views);
    expect(plan.get(99)).toBe("play");
    expect([...plan.values()].filter((s) => s === "play")).toHaveLength(
      MAX_PLAYING,
    );
  });

  it("holds rather than releases a card it had to stop — it is still on screen", () => {
    const plan = planDemos(grid(Array(MAX_PLAYING + 1).fill(0.5)));
    expect([...plan.values()]).not.toContain("release");
    expect([...plan.values()]).not.toContain("ready");
  });

  it("releases what is nowhere near the viewport", () => {
    const views = new Map<number, DemoView>([
      [0, { ratio: 1, near: true }],
      [1, { ratio: 0, near: true }],
      [2, { ratio: 0, near: false }],
    ]);
    expect([...planDemos(views).values()]).toEqual([
      "play",
      "ready",
      "release",
    ]);
  });

  it("is stable across scroll frames, so a card cannot flicker on a tie", () => {
    const tied = grid(Array(MAX_PLAYING + 4).fill(0.5));
    expect([...planDemos(tied).entries()]).toEqual([
      ...planDemos(tied).entries(),
    ]);
  });

  it("stops everything when the ratios all go to zero — a hidden tab", () => {
    const plan = planDemos(grid([0, 0, 0, 0]));
    expect([...plan.values()].every((s) => s === "ready")).toBe(true);
  });
});
