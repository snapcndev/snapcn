/**
 * The playback plan — lib/demo-governor.ts.
 *
 * Run with:  pnpm vitest run lib/__tests__/demo-governor.test.ts
 *
 * Pins what was measured on the built gallery at 1440x900: videos playing
 * off-screen, visible cards frozen by a playback cap, and elements that kept
 * their src and their buffer forever once scrolled past.
 */

import { describe, expect, it } from "vitest";
import { type DemoView, planDemos } from "@/lib/demo-governor";

const grid = (ratios: number[], near = true): Map<number, DemoView> =>
  new Map(ratios.map((ratio, i) => [i, { ratio, near }]));

describe("planDemos", () => {
  it("plays what is on screen and nothing else", () => {
    const plan = planDemos(grid([0.9, 0, 0.4, 0]));
    expect([...plan.values()]).toEqual(["play", "ready", "play", "ready"]);
  });

  it("plays every card on screen — no cap", () => {
    // A cap of 12 froze a third to half of a 16–24 card desktop grid on its
    // poster: the "only thumbnails" report.
    const plan = planDemos(grid(Array(40).fill(1)));
    expect([...plan.values()].every((s) => s === "play")).toBe(true);
  });

  it("plays the demo the reader opened even when the grid behind it fills the cap", () => {
    // The overlay's video registers last, is no more visible than the cards
    // under the modal, and used to lose the tie to all of them.
    const views = grid(Array(12).fill(1));
    views.set(99, { ratio: 1, near: true, priority: true });
    const plan = planDemos(views);
    expect(plan.get(99)).toBe("play");
  });

  it("stops the covered grid from competing with the opened demo", () => {
    // The cards under the modal read as on screen. Fetching and decoding them
    // split a slow connection twelve ways and left the opened demo waiting.
    const views = grid(Array(16).fill(1));
    views.set(99, { ratio: 1, near: true, priority: true });
    const plan = planDemos(views);
    expect([...plan.entries()].filter(([, s]) => s === "play")).toEqual([
      [99, "play"],
    ]);
    // Kept addressed, so closing the overlay does not start from nothing.
    expect(plan.get(0)).toBe("ready");
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

  it("stops everything when the ratios all go to zero — a hidden tab", () => {
    const plan = planDemos(grid([0, 0, 0, 0]));
    expect([...plan.values()].every((s) => s === "ready")).toBe(true);
  });
});
