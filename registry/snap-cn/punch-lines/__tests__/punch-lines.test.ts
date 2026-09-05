import { describe, expect, it } from "vitest";

import { planPunchLines, punchLinesDuration, slideSwing } from "../index";

const SCRIPT =
  "Ready-made scenes / for Remotion. | One command. Own it. | snapcn.";

describe("planPunchLines", () => {
  it("gives every card the screen time it was written, back to back", () => {
    const beats = planPunchLines(SCRIPT, "slide,punch", "1", "48", 3, 4);
    expect(beats.map((b) => [b.revealAt, b.end])).toEqual([
      [0, 48],
      [48, 96],
      [96, 144],
    ]);
  });

  it("never lets a card bleed over the one in front of it", () => {
    const beats = planPunchLines(SCRIPT, "slide,punch", "1", "48", 3, 4);
    for (let i = 1; i < beats.length; i++) {
      expect(beats[i]?.revealAt).toBe(beats[i - 1]?.end);
    }
  });

  it("runs the lead off screen, and gives the first card none", () => {
    const beats = planPunchLines(SCRIPT, "slide,punch", "1", "48", 3, 4);
    // Nothing is behind the first card, so there is nothing to arrive out of.
    expect(beats[0]?.start).toBe(beats[0]?.revealAt);
    expect(beats[1]?.start).toBe((beats[1]?.revealAt ?? 0) - 4);
    expect(planPunchLines(SCRIPT, "punch", "1", "48", 3, 0)[1]?.start).toBe(48);
  });

  it("repeats the last entry of every list", () => {
    const beats = planPunchLines(
      "a | b | c | d",
      "slide,punch",
      "2,1",
      "40",
      0,
      5,
    );
    expect(beats.map((b) => b.style)).toEqual([
      "slide",
      "punch",
      "punch",
      "punch",
    ]);
    expect(beats.map((b) => b.size)).toEqual([2, 1, 1, 1]);
    expect(beats.map((b) => b.end - b.revealAt)).toEqual([40, 40, 40, 40]);
  });

  it("splits cards on | and lines on /, and words on whitespace", () => {
    const beats = planPunchLines(SCRIPT, "slide,punch", "1", "48", 0, 4);
    expect(beats[0]?.lines).toEqual([
      ["Ready-made", "scenes"],
      ["for", "Remotion."],
    ]);
    expect(beats[2]?.lines).toEqual([["snapcn."]]);
  });

  it("marks the accent card, counting from 1", () => {
    const beats = planPunchLines(SCRIPT, "punch", "1", "48", 3, 4);
    expect(beats.map((b) => b.accent)).toEqual([false, false, true]);
    expect(
      planPunchLines(SCRIPT, "punch", "1", "48", 0, 4).some((b) => b.accent),
    ).toBe(false);
  });

  it("reports the length the composition has to be", () => {
    // The same number the plan ends on — the config and the component cannot
    // drift, because both come from here.
    const beats = planPunchLines(SCRIPT, "slide,punch", "1", "48", 3, 4);
    expect(punchLinesDuration(SCRIPT, "48")).toBe(beats[beats.length - 1]?.end);
    expect(punchLinesDuration(SCRIPT, "48")).toBe(144);
    expect(punchLinesDuration(SCRIPT, "60,40,40")).toBe(140);
  });
});

describe("slideSwing", () => {
  it("finds the far side of the overshoot, not just the start", () => {
    // The shipped curve: out from 0.737em left, over to 0.713em right.
    expect(slideSwing(-0.737, 7.34, 2.846)).toBeCloseTo(0.737, 3);
    // A harder kick throws it further right than it ever was left.
    expect(slideSwing(-0.737, 20, 2.846)).toBeGreaterThan(0.737);
  });

  it("is the start alone when there is no kick", () => {
    expect(slideSwing(-0.737, 0, 2.846)).toBeCloseTo(0.737, 6);
  });
});
