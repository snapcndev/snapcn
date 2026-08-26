/**
 * Unit tests for the pure helpers in registry/snap-cn/text-rewrite/index.tsx.
 *
 * Run with:
 *   pnpm vitest run registry/snap-cn/text-rewrite/__tests__/text-rewrite.test.ts
 *
 * The numbers are the ones measured off the reference recording — on its own
 * timestamps, because it is a 60fps capture with eight dropped frames and a
 * frame index is therefore not a clock. A regression in any of them is a
 * regression against the frames themselves.
 */

import { describe, expect, it } from "vitest";

import {
  deselect,
  dragIn,
  landed,
  sheenGradient,
  sweep,
  wordInk,
  zoomScale,
} from "../index";

const AT = 0.217;
const STAGGER = 0.189;
const DUR = 0.085;
const BASE = {
  at: AT,
  stagger: STAGGER,
  dur: DUR,
  coolDelay: 0.189,
  coolDur: 0.189,
};
const DRAG = { at: 1.033, dur: 0.2 };
const ERASE = { at: 1.45, dur: 0.517 };
const WRITE = { at: 2.0, dur: 0.533 };
const DROP = { at: 2.85, dur: 0.15 };
const PUSH = { at: 1.033, dur: 0, to: 2.41 };

describe("landed — the line opens around a fixed centre", () => {
  it("holds every word off screen until its cue", () => {
    expect(landed(0, 4, BASE).count).toBe(0);
    expect(landed(AT - 0.001, 4, BASE).count).toBe(0);
    expect(landed(AT, 4, BASE).count).toBe(1);
  });

  it("adds a word every measured 189ms and then stops", () => {
    for (let i = 0; i < 4; i++) {
      expect(landed(AT + i * STAGGER + 0.001, 4, BASE).count).toBe(i + 1);
    }
    expect(landed(AT + 9 * STAGGER, 4, BASE).count).toBe(4);
  });

  it("opens the line over 85ms, decelerating", () => {
    const cue = AT + 3 * STAGGER;
    expect(landed(cue, 4, BASE).grow).toBeCloseTo(0, 6);
    expect(landed(cue + DUR, 4, BASE).grow).toBeCloseTo(1, 6);
    // Measured on the fourth arrival: the ends move +18, +8, +4, +2, +1 px of a
    // 34px opening over five frames at 60fps — better than half way in one.
    expect(landed(cue + 1 / 60, 4, BASE).grow).toBeGreaterThan(0.45);
    expect(landed(cue + 2 / 60, 4, BASE).grow).toBeGreaterThan(0.72);
    expect(landed(cue + 3 / 60, 4, BASE).grow).toBeGreaterThan(0.85);
  });

  it("keeps the opening finished once the last word is in", () => {
    expect(landed(5, 4, BASE).grow).toBeCloseTo(1, 6);
  });
});

describe("wordInk — the accent walks the line", () => {
  it("fades a word up over the same 85ms the line opens in", () => {
    expect(wordInk(AT - 0.001, 0, BASE).opacity).toBe(0);
    expect(wordInk(AT + DUR, 0, BASE).opacity).toBeCloseTo(1, 6);
  });

  it("holds the accent for exactly one beat, then cools over another", () => {
    const cue = AT + STAGGER;
    expect(wordInk(cue + 0.05, 1, BASE).cool).toBe(0);
    expect(wordInk(cue + STAGGER, 1, BASE).cool).toBeCloseTo(0, 6);
    expect(wordInk(cue + STAGGER + STAGGER, 1, BASE).cool).toBeCloseTo(1, 6);
  });

  it("leaves exactly one word accent-coloured at a time", () => {
    for (let i = 1; i < 4; i++) {
      const justBefore = AT + i * STAGGER - 0.001;
      expect(wordInk(justBefore, i - 1, BASE).cool).toBeCloseTo(0, 2);
      if (i >= 2) {
        expect(wordInk(justBefore, i - 2, BASE).cool).toBeGreaterThan(0.99);
      }
    }
  });

  it("cools the last word on the drag, since no word follows it", () => {
    const last = {
      ...BASE,
      last: true,
      dragAt: DRAG.at,
      dragDur: DRAG.dur,
    };
    // Measured: still fully accent on the frame the line comes forward, dark
    // five frames later, which is half the drag.
    expect(wordInk(DRAG.at, 3, last).cool).toBe(0);
    expect(wordInk(DRAG.at + DRAG.dur / 2, 3, last).cool).toBeCloseTo(1, 6);
  });
});

describe("dragIn — the selection is pulled across", () => {
  it("is nothing before the cue and whole after it", () => {
    expect(dragIn(DRAG.at - 0.001, DRAG)).toBe(0);
    expect(dragIn(DRAG.at + DRAG.dur, DRAG)).toBeCloseTo(1, 6);
  });

  it("matches the column onsets measured across the line", () => {
    // 28% by 17ms, 54% by 33ms, 71% by 50ms, 91% by 100ms, 97% by 150ms —
    // measured by finding the frame the warmth arrives in nineteen fixed
    // columns, which needs nothing from the gradient's own shape.
    expect(dragIn(DRAG.at + 0.017, DRAG)).toBeGreaterThan(0.24);
    expect(dragIn(DRAG.at + 0.017, DRAG)).toBeLessThan(0.34);
    expect(dragIn(DRAG.at + 0.033, DRAG)).toBeGreaterThan(0.44);
    expect(dragIn(DRAG.at + 0.05, DRAG)).toBeGreaterThan(0.6);
    expect(dragIn(DRAG.at + 0.1, DRAG)).toBeGreaterThan(0.87);
    expect(dragIn(DRAG.at + 0.15, DRAG)).toBeGreaterThan(0.97);
  });

  it("is monotonic", () => {
    let prev = -1;
    for (let f = 0; f <= 102; f++) {
      const v = dragIn(f / 30, DRAG);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("sweep — the erase and the rewrite share one ease", () => {
  it("is an ease-in-out: it creeps, crosses, and settles", () => {
    expect(sweep(ERASE.at + ERASE.dur * 0.15, ERASE)).toBeLessThan(0.12);
    expect(sweep(ERASE.at + ERASE.dur * 0.5, ERASE)).toBeGreaterThan(0.5);
    expect(sweep(ERASE.at + ERASE.dur * 0.85, ERASE)).toBeGreaterThan(0.96);
  });

  it("tracks the erase measured on the reference's own timestamps", () => {
    // The clip edge as a fraction of its travel, at eighths of the sweep, read
    // off the nearest frame to each — which is where the slack below comes
    // from: the recording only has a frame every 17ms.
    const want = [0.033, 0.236, 0.512, 0.772, 0.902, 0.967, 0.992];
    want.forEach((u, i) => {
      const got = sweep(ERASE.at + (ERASE.dur * (i + 1)) / 8, ERASE);
      expect(Math.abs(got - u)).toBeLessThan(0.06);
    });
  });

  it("gives the rewrite the same shape at the same fractions", () => {
    for (const f of [0.15, 0.3, 0.5, 0.7, 0.9]) {
      expect(sweep(WRITE.at + WRITE.dur * f, WRITE)).toBeCloseTo(
        sweep(ERASE.at + ERASE.dur * f, ERASE),
        6,
      );
    }
  });

  it("is a threshold when the duration is zero", () => {
    expect(sweep(ERASE.at - 0.001, { ...ERASE, dur: 0 })).toBe(0);
    expect(sweep(ERASE.at, { ...ERASE, dur: 0 })).toBe(1);
  });
});

describe("deselect — the selection is dropped", () => {
  it("runs straight, to within the 6% the frames allow", () => {
    for (const f of [0.25, 0.5, 0.75]) {
      expect(deselect(DROP.at + DROP.dur * f, DROP)).toBeCloseTo(f, 6);
    }
  });

  it("is gone by the end of its window", () => {
    expect(deselect(DROP.at - 0.001, DROP)).toBe(0);
    expect(deselect(DROP.at + DROP.dur, DROP)).toBeCloseTo(1, 6);
    expect(deselect(99, DROP)).toBeCloseTo(1, 6);
  });
});

describe("zoomScale — the forward move", () => {
  it("is the reference's cut by default: one frame, nothing between", () => {
    expect(zoomScale(PUSH.at - 0.001, PUSH)).toBe(1);
    expect(zoomScale(PUSH.at, PUSH)).toBe(PUSH.to);
    // there is no frame on which it is halfway
    const seen = new Set<number>();
    for (let f = 0; f <= 102; f++) seen.add(zoomScale(f / 30, PUSH));
    expect([...seen].sort()).toEqual([1, PUSH.to]);
  });

  it("becomes a ramp the moment you give it a duration", () => {
    const ramp = { ...PUSH, dur: 0.2 };
    const mid = zoomScale(PUSH.at + 0.1, ramp);
    expect(mid).toBeGreaterThan(1);
    expect(mid).toBeLessThan(PUSH.to);
    expect(zoomScale(PUSH.at + 0.2, ramp)).toBeCloseTo(PUSH.to, 6);
  });
});

describe("sheenGradient", () => {
  const alphas = (css: string) =>
    [...css.matchAll(/rgba?\(([^)]*)\)/g)].map((m) => {
      const p = m[1].split(",");
      return p.length > 3 ? Number.parseFloat(p[3]) : 1;
    });

  it("is a gradient, not a fill", () => {
    const g = sheenGradient("#3072db", 0.21, 90);
    expect(g.startsWith("linear-gradient(90deg, ")).toBe(true);
    expect(alphas(g).length).toBeGreaterThan(6);
  });

  it("carries the 3.2x swing measured across three box widths", () => {
    const a = alphas(sheenGradient("#3072db", 0.2, 90));
    expect(Math.max(...a) / Math.min(...a)).toBeCloseTo(3.2, 0);
  });

  it("puts the deepest point early and the palest just past the middle", () => {
    const g = sheenGradient("#3072db", 0.2, 90);
    const at = [...g.matchAll(/\)\s([\d.]+)%/g)].map(
      (m) => Number.parseFloat(m[1]) / 100,
    );
    const a = alphas(g);
    expect(at[a.indexOf(Math.max(...a))]).toBeCloseTo(0.37, 1);
    expect(at[a.indexOf(Math.min(...a))]).toBeCloseTo(0.59, 1);
  });

  it("clamps rather than emitting an alpha above 1", () => {
    for (const x of alphas(sheenGradient("#3072db", 0.9, 90))) {
      expect(x).toBeLessThanOrEqual(1);
    }
  });
});

describe("the choreography holds together", () => {
  it("has every word landed before the line comes forward", () => {
    expect(landed(PUSH.at, 4, BASE).count).toBe(4);
    expect(landed(PUSH.at, 4, BASE).grow).toBeCloseTo(1, 6);
  });

  it("runs its beats in order and finishes inside the composition", () => {
    expect(DRAG.at).toBeGreaterThanOrEqual(PUSH.at);
    expect(ERASE.at).toBeGreaterThan(DRAG.at + DRAG.dur);
    expect(WRITE.at).toBeGreaterThanOrEqual(ERASE.at + ERASE.dur - 0.07);
    expect(DROP.at).toBeGreaterThan(WRITE.at + WRITE.dur);
    expect(DROP.at + DROP.dur).toBeLessThan(102 / 30);
  });

  it("still works for a headline of any length", () => {
    for (const n of [1, 3, 12]) {
      const last = AT + (n - 1) * STAGGER;
      expect(landed(last + DUR, n, BASE).count).toBe(n);
      expect(wordInk(last + DUR, n - 1, BASE).opacity).toBeCloseTo(1, 6);
    }
  });
});
