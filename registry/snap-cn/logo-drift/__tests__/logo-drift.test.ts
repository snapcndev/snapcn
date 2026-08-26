/**
 * Unit tests for the pure helpers in registry/snap-cn/logo-drift/index.tsx.
 *
 * Run with:
 *   pnpm vitest run registry/snap-cn/logo-drift/__tests__/logo-drift.test.ts
 *
 * No React DOM or Remotion player needed — only pure JS logic is exercised.
 * All tests are fully deterministic (no network, no Date.now).
 *
 * The numbers are the ones fitted to the reference recording, so a regression in
 * any of them is a regression against the frames themselves.
 */

import { describe, expect, it } from "vitest";

import {
  type DriftTile,
  placeTile,
  pullbackScale,
  SNAPCN_STACK,
  wordState,
} from "../index";

const RATE = 0.1762;
const OPTS = { rate: RATE, fade: 0.4, speed: 1, scale: 1 };

describe("pullbackScale", () => {
  it("is one linear ramp, not a perspective dolly", () => {
    // Under perspective it is 1/size that runs straight; the reference's sizes
    // do, so the scale itself is the line.
    const a = pullbackScale(1, RATE);
    const b = pullbackScale(2, RATE);
    const c = pullbackScale(3, RATE);
    expect(a - b).toBeCloseTo(b - c, 10);
  });

  it("matches the rate measured off every tile", () => {
    expect(pullbackScale(0, RATE)).toBe(1);
    expect(pullbackScale(3.35, RATE)).toBeCloseTo(0.4097, 3);
  });

  it("never goes to zero or negative, however long the clip runs", () => {
    for (const t of [10, 100, 1e6]) {
      expect(pullbackScale(t, RATE)).toBeGreaterThan(0);
    }
  });
});

describe("placeTile", () => {
  const tile: DriftTile = {
    glyph: "Rm",
    background: "#000",
    x: 163,
    y: 232,
    vx: -54,
    vy: 12,
    size: 109,
    at: 0.28,
  };

  it("puts the whole field on one scale", () => {
    // Two tiles of different size shrink by the same *factor*, which is the
    // measurement the component hangs off (±0.0016 across seven tiles).
    const big = placeTile({ ...tile, size: 250 }, 2, OPTS);
    const small = placeTile(tile, 2, OPTS);
    expect(big.size / 250).toBeCloseTo(small.size / 109, 10);
  });

  it("reproduces the reference tile it was fitted to", () => {
    // Measured on the recording: 100px wide with its centre at (531, 423) at
    // t=0.45, and 47px wide centred on (398, 341) at t=3.23.
    const early = placeTile(tile, 0.45, OPTS);
    expect(early.size).toBeCloseTo(100, 0);
    expect(early.left + early.size / 2).toBeCloseTo(531, -1);
    const late = placeTile(tile, 3.23, OPTS);
    expect(late.size).toBeCloseTo(47, 0);
    expect(late.left + late.size / 2).toBeCloseTo(398, -1);
    expect(late.top + late.size / 2).toBeCloseTo(341, -1);
  });

  it("drifts as well as scales — a static field is a different picture", () => {
    const drifting = placeTile(tile, 3, OPTS);
    const still = placeTile({ ...tile, vx: 0, vy: 0 }, 3, OPTS);
    // Over three seconds the drift is worth tens of pixels, not a rounding.
    expect(Math.abs(drifting.left - still.left)).toBeGreaterThan(40);
  });

  it("is dark before its cue and never quite settles after it", () => {
    expect(placeTile(tile, 0.27, OPTS).opacity).toBe(0);
    expect(placeTile(tile, 0.28 + 0.4, OPTS).opacity).toBeCloseTo(0.632, 2);
    expect(placeTile(tile, 0.28 + 1.2, OPTS).opacity).toBeCloseTo(0.95, 2);
    expect(placeTile(tile, 30, OPTS).opacity).toBeLessThanOrEqual(1);
  });

  it("scales and speeds the whole field from one knob each", () => {
    const twice = placeTile(tile, 1, { ...OPTS, scale: 2 });
    expect(twice.size).toBeCloseTo(placeTile(tile, 1, OPTS).size * 2, 10);
    const fast = placeTile(tile, 1, { ...OPTS, speed: 2 });
    const norm = placeTile(tile, 1, OPTS);
    expect(fast.left - norm.left).toBeCloseTo(
      pullbackScale(1, RATE) * (tile.vx ?? 0),
      6,
    );
  });
});

describe("wordState", () => {
  const o = {
    at: 0.017,
    stagger: 0.15,
    dur: 0.14,
    scale: 1.216,
    blur: 4.3,
    exitAt: 3.13,
    exitDur: 0.34,
    exitScale: 0.8,
    exitBlur: 6.5,
  };

  it("holds a word off screen until its cue", () => {
    expect(wordState(0, 0, o).opacity).toBe(0);
    expect(wordState(0.4, 3, o).opacity).toBe(0);
    expect(wordState(0.47, 3, o).opacity).toBe(1);
  });

  it("does not fade in — it arrives big and soft", () => {
    // The reference's ink is conserved from the first frame a word exists.
    const first = wordState(0.02, 0, o);
    expect(first.opacity).toBe(1);
    expect(first.scale).toBeGreaterThan(1.2);
    expect(first.blur).toBeGreaterThan(4);
  });

  it("lands in 140ms, sharp and at size", () => {
    const done = wordState(0.017 + 0.14, 0, o);
    expect(done.scale).toBeCloseTo(1, 6);
    expect(done.blur).toBeCloseTo(0, 6);
  });

  it("matches the scale and blur measured two frames in", () => {
    // f2 of the recording: 1.159× and 3.02px; f4: 1.074× and 1.48px.
    const a = wordState(0.033, 0, o);
    expect(a.scale).toBeCloseTo(1.159, 1);
    expect(a.blur).toBeCloseTo(3.02, 0);
    const b = wordState(0.067, 0, o);
    expect(b.scale).toBeCloseTo(1.074, 1);
    expect(b.blur).toBeCloseTo(1.48, 0);
  });

  it("staggers every word by the same beat", () => {
    for (let i = 0; i < 6; i++) {
      const cue = o.at + i * o.stagger;
      expect(wordState(cue - 0.001, i, o).opacity).toBe(0);
      expect(wordState(cue + 0.0001, i, o).opacity).toBe(1);
    }
  });

  it("takes the whole line out together, blurred and receding", () => {
    const mid = wordState(3.3, 0, o);
    expect(mid.opacity).toBeLessThan(1);
    expect(mid.opacity).toBeGreaterThan(0);
    expect(mid.blur).toBeGreaterThan(2);
    expect(mid.scale).toBeLessThan(1);
    const gone = wordState(3.13 + 0.34, 0, o);
    expect(gone.opacity).toBeCloseTo(0, 6);
    expect(gone.scale).toBeCloseTo(0.8, 6);
    expect(gone.blur).toBeCloseTo(6.5, 6);
  });

  it("leaves every word at once, whatever order they arrived in", () => {
    const a = wordState(3.3, 0, o);
    const b = wordState(3.3, 4, o);
    expect(a.opacity).toBeCloseTo(b.opacity, 10);
  });
});

describe("SNAPCN_STACK", () => {
  it("is our own content, not the reference's", () => {
    const labels = SNAPCN_STACK.map((t) => t.label ?? "").join(" ");
    for (const ours of ["Remotion", "shadcn/ui", "React", "Tailwind"]) {
      expect(labels).toContain(ours);
    }
  });

  it("carries the fitted choreography — nine tiles, staggered in", () => {
    expect(SNAPCN_STACK).toHaveLength(9);
    const ats = SNAPCN_STACK.map((t) => t.at ?? 0);
    expect([...ats].sort((a, b) => a - b)).toEqual(ats);
    expect(ats[0]).toBeCloseTo(0.28, 2);
  });

  it("brings every tile in at the rim, never into open middle", () => {
    // Most arrive straddling an edge. One — the tile the reference fades up
    // five pixels inside the right edge — does not, which is what the fade is
    // there for: a tile that has to appear in shot appears softly.
    for (const tile of SNAPCN_STACK) {
      const p = placeTile(tile, tile.at ?? 0, OPTS);
      const gap = Math.min(
        p.left,
        p.top,
        810 - (p.left + p.size),
        458 - (p.top + p.size),
      );
      expect(gap).toBeLessThan(p.size);
    }
  });
});
