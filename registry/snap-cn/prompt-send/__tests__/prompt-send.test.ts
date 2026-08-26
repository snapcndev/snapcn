/**
 * Unit tests for the pure helpers in registry/snap-cn/prompt-send/index.tsx.
 *
 * Run with:
 *   pnpm vitest run registry/snap-cn/prompt-send/__tests__/prompt-send.test.ts
 *
 * No React DOM or Remotion player needed — only pure JS logic is exercised.
 * All tests are fully deterministic (no network, no Date.now).
 *
 * Two things are pinned here. The timing numbers are the ones measured off the
 * reference recording, so a regression in any of them is a regression against
 * the frames themselves. The layout tests are the other half of the job: the
 * defaults have to reproduce that geometry *and* other content has to land
 * somewhere sensible rather than clipping against a constant.
 */

import { describe, expect, it } from "vitest";

import {
  cameraFor,
  caretOn,
  chipList,
  keystrokeAt,
  layoutFor,
  packChipRows,
  typedCount,
  typedProgress,
} from "../index";

const TEXT =
  "Add a text reveal, a soft blur transition, and a gradient background";
const START = 0.915;
const DUR = 3.025;
const N = 69; // the reference's own sentence length, which the timing was fitted to

describe("typedCount — the eased typewriter", () => {
  const c = (t: number) => typedCount(t, START, DUR, N);

  it("types nothing before its cue", () => {
    expect(c(0)).toBe(0);
    expect(c(START)).toBe(0);
  });

  it("is monotonic and clamps at the end of the string", () => {
    let prev = -1;
    for (let f = 0; f <= 165; f++) {
      const v = c(f / 30);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(N);
      prev = v;
    }
    expect(c(10)).toBe(N);
  });

  it("matches the character count read off the reference frames", () => {
    // (seconds, characters visible) — read directly off the recording.
    const measured: [number, number][] = [
      [1.108, 1],
      [1.617, 9],
      [1.958, 19],
      [2.25, 28],
      [2.583, 40],
      [2.942, 53],
      [3.325, 62],
      [3.725, 68],
    ];
    for (const [t, n] of measured) {
      expect(Math.abs(c(t) - n)).toBeLessThanOrEqual(1);
    }
  });

  it("is not a constant rate — it accelerates in and settles out", () => {
    // First second of typing versus the middle second: the reference measures
    // 17 chars/sec at the start and 33 in the middle. A constant-rate
    // typewriter would make these two equal, and that is the thing this
    // component is not.
    const early = c(START + 0.6) - c(START + 0.1);
    const middle = c(START + 1.75) - c(START + 1.25);
    expect(middle).toBeGreaterThan(early * 1.6);
  });

  it("finishes any length of copy in the same window", () => {
    for (const total of [1, 12, TEXT.length, 400]) {
      expect(typedCount(START + DUR, START, DUR, total)).toBe(total);
      expect(typedCount(START - 0.01, START, DUR, total)).toBe(0);
    }
  });
});

describe("typedProgress — what the camera and the field ride", () => {
  it("is continuous where the character count is not", () => {
    // Two adjacent frames mid-sentence: the count may jump by a whole
    // character, but the progress the camera follows must not.
    const a = typedProgress(2.0, START, DUR);
    const b = typedProgress(2.0 + 1 / 30, START, DUR);
    expect(b - a).toBeGreaterThan(0);
    expect(b - a).toBeLessThan(0.02);
  });

  it("spans exactly 0→1 across its window", () => {
    expect(typedProgress(START - 0.5, START, DUR)).toBe(0);
    expect(typedProgress(START, START, DUR)).toBe(0);
    expect(typedProgress(START + DUR, START, DUR)).toBe(1);
    expect(typedProgress(START + DUR + 1, START, DUR)).toBe(1);
  });
});

describe("keystrokeAt — the inverse of the ease", () => {
  it("round-trips the count it came from", () => {
    for (let n = 1; n <= N; n++) {
      const t = keystrokeAt(n - 0.5, START, DUR, N);
      expect(typedCount(t + 1e-6, START, DUR, N)).toBe(n);
    }
  });

  it("puts the last keystroke where the reference's caret starts blinking", () => {
    // The reference's caret goes dark at 4.267s, one blink half-cycle after the
    // final character lands.
    expect(keystrokeAt(N - 0.5, START, DUR, N)).toBeCloseTo(4.267 - 0.474, 1);
  });
});

describe("caretOn", () => {
  it("stays solid for a whole half-cycle after each keystroke", () => {
    for (let d = 0; d < 0.47; d += 0.02)
      expect(caretOn(3 + d, 3, 0.474)).toBe(true);
  });

  it("blinks off, then on, at the measured times", () => {
    const anchor = keystrokeAt(N - 0.5, START, DUR, N);
    expect(caretOn(4.2, anchor, 0.474)).toBe(true);
    expect(caretOn(4.4, anchor, 0.474)).toBe(false);
    expect(caretOn(4.8, anchor, 0.474)).toBe(true);
  });

  it("is dark before the caret exists", () => {
    expect(caretOn(0.5, 0.742, 0.474)).toBe(false);
  });
});

describe("cameraFor — two cuts and a ride", () => {
  const base = {
    cutInAt: 1.975,
    cutOutAt: 4.008,
    zoomIn: 2.327,
    zoomOut: 1.44,
    caretX: 300,
    caretY: 194,
    sendX: 730,
    sendY: 264,
    focusX: 0.573,
    focusY: 0.4881,
    outX: 0.5305,
    outY: 0.5261,
  };

  it("is a step at each cut, never a ramp", () => {
    // Every frame of the whole clip sits at exactly one of the three scales.
    const seen = new Set<number>();
    for (let f = 0; f <= 165; f++) seen.add(cameraFor(f / 30, base).scale);
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 1.44, 2.327]);
  });

  it("cuts in on the frame after the last wide one", () => {
    expect(cameraFor(1.974, base).scale).toBe(1);
    expect(cameraFor(1.975, base).scale).toBe(2.327);
  });

  it("puts the caret on its mark while it rides", () => {
    const s = cameraFor(3, base);
    expect(s.x + s.scale * base.caretX).toBeCloseTo(0.573 * 890, 6);
    expect(s.y + s.scale * base.caretY).toBeCloseTo(0.4881 * 486, 6);
  });

  it("tracks left as the sentence grows", () => {
    const a = cameraFor(3, { ...base, caretX: 300 });
    const b = cameraFor(3, { ...base, caretX: 380 });
    expect(b.x).toBeLessThan(a.x);
    expect(a.x - b.x).toBeCloseTo(80 * 2.327, 6);
  });

  it("lands the send button on its mark after the second cut", () => {
    const s = cameraFor(4.5, base);
    expect(s.x + s.scale * base.sendX).toBeCloseTo(0.5305 * 890, 6);
    expect(s.y + s.scale * base.sendY).toBeCloseTo(0.5261 * 486, 6);
  });

  it("reframes rather than drifting when the panel changes size", () => {
    // Both marks are fractions of the frame, so a component twice as wide still
    // lands its caret in the same place on screen.
    const s = cameraFor(3, { ...base, caretX: 620 });
    expect(s.x + s.scale * 620).toBeCloseTo(0.573 * 890, 6);
  });
});

describe("packChipRows", () => {
  it("keeps a row that fits on one row", () => {
    expect(packChipRows([100, 100, 100], 400, 10)).toEqual([[0, 1, 2]]);
  });

  it("wraps what will not fit, in label order", () => {
    expect(packChipRows([100, 100, 100, 100], 320, 10)).toEqual([
      [0, 1, 2],
      [3],
    ]);
  });

  it("never drops a label, however narrow the panel", () => {
    const widths = [80, 140, 60, 200, 95];
    for (const available of [40, 100, 220, 400, 2000]) {
      const rows = packChipRows(widths, available, 9);
      expect(rows.flat()).toEqual([0, 1, 2, 3, 4]);
    }
  });

  it("gives an empty list no rows at all", () => {
    expect(packChipRows([], 400, 10)).toEqual([]);
  });
});

describe("chipList", () => {
  it("takes an array", () => {
    expect(chipList(["a", "b"])).toEqual(["a", "b"]);
  });

  it("takes the comma-separated string the customizer sends", () => {
    expect(chipList("Add a text reveal, Pick a background")).toEqual([
      "Add a text reveal",
      "Pick a background",
    ]);
  });

  it("drops blanks so a trailing comma is not an empty pill", () => {
    expect(chipList("one, , two,")).toEqual(["one", "two"]);
    expect(chipList("")).toEqual([]);
    expect(chipList(undefined)).toEqual([]);
  });
});

describe("layoutFor", () => {
  const defaults = {
    width: 636.2,
    fieldHeight: 121.2,
    fontSize: 14,
    chipFontSize: 12.3,
    radius: 22,
    sendSize: 27.4,
    chipWidths: [146.8, 141.8, 111.8, 138.8],
  };

  it("reproduces the recording's geometry at its own defaults", () => {
    const L = layoutFor(defaults);
    // Panel 636×167 at y=163; field inset 4.7; text origin 20.4 in and 22.6 down.
    expect(L.panelHeight).toBeCloseTo(166.6, 1);
    expect(L.panelTop).toBeCloseTo(163.0, 1);
    expect(L.lineX).toBeCloseTo(20.4, 1);
    expect(L.lineY).toBeCloseTo(22.6, 1);
    expect(L.lineHeight).toBeCloseTo(17, 1);
    expect(L.caretWidth).toBeCloseTo(2.2, 1);
    expect(L.chipsX).toBeCloseTo(16.1, 1);
    expect(L.chipHeight).toBeCloseTo(24.6, 1);
    expect(L.chipGap).toBeCloseTo(8.7, 1);
    expect(L.chipRows).toEqual([[0, 1, 2, 3]]);
  });

  it("grows the panel by exactly the chip rows it gained", () => {
    const one = layoutFor(defaults);
    const two = layoutFor({
      ...defaults,
      chipWidths: [...defaults.chipWidths, 200, 200],
    });
    expect(two.chipRows.length).toBe(2);
    expect(two.panelHeight - one.panelHeight).toBeCloseTo(
      one.chipHeight + one.chipGap,
      3,
    );
  });

  it("hugs the field when there are no chips", () => {
    const L = layoutFor({ ...defaults, chipWidths: [] });
    expect(L.chipRows).toEqual([]);
    expect(L.panelHeight).toBeCloseTo(4.7 + 121.2 + 4.7, 3);
  });

  it("keeps the panel centred whatever height it ends up", () => {
    for (const chipWidths of [[], defaults.chipWidths, [200, 200, 200, 200]]) {
      const L = layoutFor({ ...defaults, chipWidths });
      expect(L.panelTop + L.panelHeight / 2).toBeCloseTo(486 / 2 + 3.3, 3);
    }
  });

  it("scales the line box with the type, not with a constant", () => {
    const big = layoutFor({ ...defaults, fontSize: 28 });
    const small = layoutFor(defaults);
    expect(big.lineHeight / small.lineHeight).toBeCloseTo(2, 3);
    expect(big.caretWidth / small.caretWidth).toBeCloseTo(2, 3);
    expect(big.lineX - 4.7).toBeCloseTo((small.lineX - 4.7) * 2, 3);
  });

  it("only yields room to the send button when they share a row", () => {
    // Tall field: the button is well below the text, so the line gets it all.
    expect(layoutFor(defaults).lineMaxWidth).toBeCloseTo(636.2 - 20.4 * 2, 1);
    // One-row control: the line has to stop before it runs under the button.
    const compact = layoutFor({ ...defaults, fieldHeight: 52 });
    expect(compact.lineMaxWidth).toBeLessThan(
      layoutFor(defaults).lineMaxWidth - 27.4,
    );
  });
});
