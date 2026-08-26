/**
 * Unit tests for the pure helpers in registry/snap-cn/text-select/index.tsx.
 *
 * Run with:
 *   pnpm vitest run registry/snap-cn/text-select/__tests__/text-select.test.ts
 *
 * No React DOM or Remotion player needed — only pure JS logic is exercised.
 * All tests are fully deterministic (no network, no Date.now).
 *
 * The numbers are the ones measured off the reference recording, so a
 * regression in any of them is a regression against the frames themselves.
 */

import { describe, expect, it } from "vitest";

import {
  lineShift,
  selectionSweep,
  sheenGradient,
  shineGradient,
  shineSweep,
  wordInk,
  zoomScale,
} from "../index";

const AT = 0.066;
const STAGGER = 0.208;
const DUR = 0.13;
const BASE = {
  at: AT,
  stagger: STAGGER,
  dur: DUR,
  coolDelay: 0.208,
  coolDur: 0.208,
  blur: 1,
};
const SEL = { at: 1.4, dur: 0.26 };
const PUSH = { at: 1.13, dur: 0.42, to: 2.39 };

describe("wordInk — arrival", () => {
  it("holds a word off screen until its cue", () => {
    expect(wordInk(0, 0, BASE).opacity).toBe(0);
    expect(wordInk(AT - 0.001, 0, BASE).opacity).toBe(0);
    expect(wordInk(AT + 0.0001, 0, BASE).opacity).toBeGreaterThan(0);
  });

  it("staggers every word by the measured 208ms", () => {
    for (let i = 0; i < 5; i++) {
      const cue = AT + i * STAGGER;
      expect(wordInk(cue - 0.001, i, BASE).opacity).toBe(0);
      expect(wordInk(cue + 0.0001, i, BASE).opacity).toBeGreaterThan(0);
    }
  });

  it("is a fade, and lands in 130ms", () => {
    const done = wordInk(AT + DUR, 0, BASE);
    expect(done.opacity).toBeCloseTo(1, 6);
    expect(done.blur).toBeCloseTo(0, 6);
  });

  it("matches the opacity measured a few frames in", () => {
    // Ink mass on the recording: 51% at 17ms after the cue, 77% at 34ms,
    // 95% at 67ms — the shape of an easeOutQuart, not a linear ramp.
    expect(wordInk(AT + 0.017, 0, BASE).opacity).toBeGreaterThan(0.4);
    expect(wordInk(AT + 0.034, 0, BASE).opacity).toBeGreaterThan(0.65);
    expect(wordInk(AT + 0.067, 0, BASE).opacity).toBeGreaterThan(0.9);
  });
});

describe("wordInk — the accent walks the line", () => {
  it("holds the accent for exactly one beat, then cools over another", () => {
    const cue = AT + 1 * STAGGER;
    expect(wordInk(cue + 0.1, 1, BASE).cool).toBe(0);
    expect(wordInk(cue + STAGGER, 1, BASE).cool).toBe(0);
    expect(wordInk(cue + STAGGER + 0.104, 1, BASE).cool).toBeCloseTo(0.5, 1);
    expect(wordInk(cue + STAGGER + 0.208, 1, BASE).cool).toBeCloseTo(1, 6);
  });

  it("leaves exactly one word accent-coloured at a time", () => {
    // Sample right before each word lands: the previous one must be fully
    // cooled and the newest fully accent.
    for (let i = 1; i < 5; i++) {
      const justBefore = AT + i * STAGGER - 0.001;
      expect(wordInk(justBefore, i - 1, BASE).cool).toBeCloseTo(0, 2);
      if (i >= 2) {
        expect(wordInk(justBefore, i - 2, BASE).cool).toBeGreaterThan(0.99);
      }
    }
  });

  it("cools the last word on the drag, since no word follows it", () => {
    const last = { ...BASE, selectAt: SEL.at, selectDur: SEL.dur };
    const cue = AT + 4 * STAGGER;
    // It is still fully accent at the cut, which is what the recording shows.
    expect(wordInk(PUSH.at, 4, last).cool).toBe(0);
    expect(wordInk(SEL.at, 4, last).cool).toBe(0);
    expect(wordInk(SEL.at + SEL.dur / 2, 4, last).cool).toBeCloseTo(1, 6);
    // …and without a drag it falls back to the ordinary beat.
    expect(wordInk(cue + 0.208 + 0.208, 4, BASE).cool).toBeCloseTo(1, 6);
  });
});

describe("lineShift", () => {
  it("puts the line at full offset before anything lands", () => {
    expect(lineShift(0, 5, BASE)).toBe(1);
  });

  it("re-triggers on every word, not just the first", () => {
    // Settled just before the second word, then thrown out again by it.
    expect(lineShift(AT + STAGGER - 0.001, 5, BASE)).toBeCloseTo(0, 3);
    expect(lineShift(AT + STAGGER + 0.001, 5, BASE)).toBeGreaterThan(0.9);
    expect(lineShift(AT + STAGGER + DUR, 5, BASE)).toBeCloseTo(0, 6);
  });

  it("stops re-triggering once the last word has landed", () => {
    const afterLast = AT + 4 * STAGGER + DUR;
    for (const t of [afterLast, afterLast + 1, afterLast + 5]) {
      expect(lineShift(t, 5, BASE)).toBeCloseTo(0, 6);
    }
  });

  it("settles in the same 130ms a word takes", () => {
    expect(lineShift(AT + DUR, 5, BASE)).toBeCloseTo(0, 6);
    expect(lineShift(AT + DUR / 2, 5, BASE)).toBeGreaterThan(0);
    expect(lineShift(AT + DUR / 2, 5, BASE)).toBeLessThan(0.15);
  });
});

describe("selectionSweep", () => {
  it("is nothing before its cue and whole after it", () => {
    expect(selectionSweep(SEL.at - 0.001, SEL)).toBe(0);
    expect(selectionSweep(SEL.at + SEL.dur, SEL)).toBeCloseTo(1, 6);
    expect(selectionSweep(10, SEL)).toBeCloseTo(1, 6);
  });

  it("is a drag: a third of the way across on its first frame", () => {
    // Measured on the recording, as fractions of the drag: 31% at 6% in,
    // 53% at 14%, 86% at 36%. The shape of an easeOutQuint, not a wipe.
    expect(selectionSweep(SEL.at + SEL.dur * 0.06, SEL)).toBeGreaterThan(0.25);
    expect(selectionSweep(SEL.at + SEL.dur * 0.14, SEL)).toBeGreaterThan(0.47);
    expect(selectionSweep(SEL.at + SEL.dur * 0.36, SEL)).toBeGreaterThan(0.8);
  });

  it("spends its back half on the last few percent", () => {
    const half = selectionSweep(SEL.at + SEL.dur / 2, SEL);
    expect(half).toBeGreaterThan(0.95);
    expect(half).toBeLessThan(1);
  });

  it("is monotonic", () => {
    let prev = -1;
    for (let f = 0; f <= 66; f++) {
      const v = selectionSweep(f / 30, SEL);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("the choreography holds together", () => {
  it("has every word landed before the push", () => {
    for (let i = 0; i < 5; i++) {
      expect(wordInk(PUSH.at, i, BASE).opacity).toBeCloseTo(1, 6);
    }
  });

  it("drags the selection only once the push is well under way", () => {
    // Not before it starts, and not after it ends either — the reference has
    // the drag overlapping the move, which is what makes them read as one beat.
    expect(SEL.at).toBeGreaterThan(PUSH.at);
    expect(SEL.at).toBeLessThan(PUSH.at + PUSH.dur);
  });

  it("still works for a line of any length", () => {
    for (const n of [1, 3, 12]) {
      const last = AT + (n - 1) * STAGGER;
      expect(lineShift(last + DUR, n, BASE)).toBeCloseTo(0, 6);
      expect(wordInk(last + DUR, n - 1, BASE).opacity).toBeCloseTo(1, 6);
    }
  });
});

describe("zoomScale — the push forward", () => {
  it("holds at 1 until its cue and lands exactly on `to`", () => {
    expect(zoomScale(0, PUSH)).toBe(1);
    expect(zoomScale(PUSH.at, PUSH)).toBeCloseTo(1, 6);
    expect(zoomScale(PUSH.at + PUSH.dur, PUSH)).toBeCloseTo(PUSH.to, 6);
    expect(zoomScale(99, PUSH)).toBeCloseTo(PUSH.to, 6);
  });

  it("is a cut when the duration is zero", () => {
    const cut = { ...PUSH, dur: 0 };
    expect(cut.at).toBeGreaterThan(0);
    expect(zoomScale(PUSH.at - 0.001, cut)).toBe(1);
    expect(zoomScale(PUSH.at, cut)).toBe(PUSH.to);
  });

  it("decelerates — front-loaded, but never front-loaded like a quint", () => {
    const half = zoomScale(PUSH.at + PUSH.dur / 2, PUSH);
    const u = (half - 1) / (PUSH.to - 1);
    expect(u).toBeGreaterThan(0.5); // it is a decelerate…
    // …and a moderate one. A quint-out is 0.969 through at half, an expo-out
    // 0.997 — those are the curves that spend their back half on frames that
    // rasterise identically.
    expect(u).toBeLessThan(0.92);
  });

  it("never spends a frame on travel you cannot see", () => {
    // The rule from the motion-quality skill: a settle worth one frame is a
    // settle, a settle worth five is a freeze. Measured on the rendered line —
    // 20px type, 700px wide at full size — the width must keep moving.
    const width = (t: number) => 700 * (zoomScale(t, PUSH) / PUSH.to);
    let stalled = 0;
    for (let f = 0; f < PUSH.dur * 30; f++) {
      const d = width(PUSH.at + (f + 1) / 30) - width(PUSH.at + f / 30);
      if (d < 1) stalled++;
      expect(d).toBeGreaterThanOrEqual(0); // monotone: no reversal to snap on
    }
    expect(stalled).toBeLessThanOrEqual(1);
  });
});

/** The alphas of a gradient's stops, in order. `rgb(…)` with no alpha is 1. */
function alphasOf(css: string): number[] {
  return [...css.matchAll(/rgba?\(([^)]*)\)/g)].map((m) => {
    const parts = m[1].split(",");
    return parts.length > 3 ? Number.parseFloat(parts[3]) : 1;
  });
}

describe("sheenGradient", () => {
  it("is a gradient, not a fill", () => {
    const g = sheenGradient("#3072db", 0.207, 90);
    expect(g.startsWith("linear-gradient(90deg, ")).toBe(true);
    expect(alphasOf(g).length).toBeGreaterThan(6);
  });

  it("carries the measured 2.8x swing from trough to shine", () => {
    // The reference's selection is 2.8x stronger at its deepest than at its
    // brightest band — R 178 against 222 on a 252 page. The rendered component
    // measures 2.78x, which is that.
    const a = alphasOf(sheenGradient("#3072db", 0.2, 90));
    expect(Math.max(...a) / Math.min(...a)).toBeCloseTo(2.8, 0);
  });

  it("puts the bright band past the middle, where it was measured", () => {
    const g = sheenGradient("#3072db", 0.2, 90);
    const at = [...g.matchAll(/\)\s([\d.]+)%/g)].map(
      (m) => Number.parseFloat(m[1]) / 100,
    );
    const a = alphasOf(g);
    const brightest = at[a.indexOf(Math.min(...a))];
    expect(brightest).toBeGreaterThan(0.5);
    expect(brightest).toBeLessThan(0.7);
  });

  it("clamps rather than emitting an alpha above 1", () => {
    for (const x of alphasOf(sheenGradient("#3072db", 0.9, 90))) {
      expect(x).toBeLessThanOrEqual(1);
    }
  });

  it("takes a sheen of your own, including a flat one", () => {
    const flat = sheenGradient("#3072db", 0.2, 45, [
      [0, 1],
      [1, 1],
    ]);
    expect(flat.startsWith("linear-gradient(45deg, ")).toBe(true);
    expect(alphasOf(flat)).toEqual([0.2, 0.2]);
  });
});

const GLINT = { at: 1.66, dur: 0.62, every: 1.1, width: 0.3 };

describe("shineSweep — the travelling glint", () => {
  it("is nothing until its cue", () => {
    expect(shineSweep(0, GLINT)).toBeNull();
    expect(shineSweep(GLINT.at - 0.001, GLINT)).toBeNull();
    expect(shineSweep(GLINT.at, GLINT)).not.toBeNull();
  });

  it("enters from off the left edge and leaves off the right", () => {
    expect(shineSweep(GLINT.at, GLINT)).toBeCloseTo(-GLINT.width / 2, 6);
    expect(shineSweep(GLINT.at + GLINT.dur, GLINT)).toBeCloseTo(
      1 + GLINT.width / 2,
      6,
    );
  });

  it("travels linearly — a light source passing, not something that settles", () => {
    const step = (f: number) => {
      const a = shineSweep(GLINT.at + f / 30, GLINT);
      const b = shineSweep(GLINT.at + (f + 1) / 30, GLINT);
      return a === null || b === null ? null : b - a;
    };
    const steps = [step(1), step(6), step(12), step(17)].filter(
      (x): x is number => x !== null,
    );
    expect(steps.length).toBe(4);
    for (const d of steps) expect(d).toBeCloseTo(steps[0] as number, 9);
  });

  it("never spends a frame on travel you cannot see", () => {
    // On the rendered demo the box is 1110px, so a step of 0.07 of the box is
    // 78px — measured, and constant across the whole pass.
    const step = (shineSweep(GLINT.at + 1 / 30, GLINT) ?? 0) - -GLINT.width / 2;
    expect(step * 1110).toBeGreaterThan(50);
  });

  it("goes dark between passes and comes back on the period", () => {
    expect(shineSweep(GLINT.at + GLINT.dur + 0.01, GLINT)).toBeNull();
    expect(shineSweep(GLINT.at + GLINT.every - 0.01, GLINT)).toBeNull();
    // A hair past the period, not exactly on it: 1.66 + 1.1 - 1.66 is
    // 1.0999999999999996 in doubles, which is still inside the previous pass.
    const restart = shineSweep(GLINT.at + GLINT.every + 0.005, GLINT);
    expect(restart).not.toBeNull();
    expect(restart as number).toBeLessThan(-0.1); // back off the left edge
  });

  it("shines once and stops when the period is zero", () => {
    const once = { ...GLINT, every: 0 };
    expect(shineSweep(GLINT.at + GLINT.dur / 2, once)).toBeGreaterThan(0);
    expect(shineSweep(GLINT.at + GLINT.dur + 0.01, once)).toBeNull();
    expect(shineSweep(GLINT.at + GLINT.every + 0.005, once)).toBeNull();
  });

  it("is off entirely when the duration is zero", () => {
    expect(shineSweep(5, { ...GLINT, dur: 0 })).toBeNull();
  });
});

describe("shineGradient", () => {
  const G = {
    core: "#ffffff",
    shoulder: "#3072db",
    alpha: 0.5,
    depth: 0.55,
    pos: 0.4,
    width: 0.3,
    angle: 90,
  };

  it("is a bright core with deepened shoulders, not just a light band", () => {
    const css = shineGradient(G);
    const stops = [...css.matchAll(/rgba?\(([^)]*)\)\s([-\d.]+)%/g)].map(
      (m) => {
        const parts = m[1].split(",").map((x) => Number.parseFloat(x));
        return {
          r: parts[0],
          a: parts.length > 3 ? parts[3] : 1,
          at: Number(m[2]),
        };
      },
    );
    expect(stops.length).toBe(5);
    // the core is the light, the shoulders are the selection's own colour
    expect(stops[2]?.r).toBe(255);
    expect(stops[1]?.r).toBe(48);
    expect(stops[3]?.r).toBe(48);
    // and the shoulders actually carry weight (culori rounds alpha to 2dp)
    expect(stops[1]?.a).toBeCloseTo(0.5 * 0.55, 1);
  });

  it("ends on a real colour at zero alpha, never the `transparent` keyword", () => {
    // `transparent` is rgba(0,0,0,0), so a gradient running to it fades through
    // black and leaves a grey bruise either side of the band.
    const css = shineGradient(G);
    expect(css).not.toContain("transparent");
    const ends = [...css.matchAll(/rgba\([^)]*,\s*0\)/g)];
    expect(ends.length).toBe(2);
  });

  it("keeps its stops in order wherever the band is, including off the edges", () => {
    for (const pos of [-0.15, 0, 0.5, 1, 1.15]) {
      const at = [
        ...shineGradient({ ...G, pos }).matchAll(/\s([-\d.]+)%/g),
      ].map((m) => Number.parseFloat(m[1]));
      expect(at.length).toBe(5);
      for (let i = 1; i < at.length; i++) {
        expect(at[i] as number).toBeGreaterThanOrEqual(at[i - 1] as number);
      }
    }
  });

  it("clamps rather than emitting an alpha above 1", () => {
    const css = shineGradient({ ...G, alpha: 0.9, depth: 2 });
    for (const m of css.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)) {
      expect(Number.parseFloat(m[1] as string)).toBeLessThanOrEqual(1);
    }
  });
});
