/**
 * The showcase wall's geometry.
 *
 * Run with:  pnpm vitest run "app/(home)/components/sections/__tests__/showcase-wall.test.ts"
 *
 * One scale field is the whole design. Every card reads its two edge heights out
 * of it, which is what makes the row one continuous ribbon rather than a set of
 * skewed rectangles — and it fails silently in a browser, where a wall that is
 * subtly wrong throws no errors at all.
 *
 * Plus the one that says why the card art is drawn rather than transformed: the
 * surface bows several pixels clear of the chord any CSS transform would have
 * given it.
 */

import { describe, expect, it } from "vitest";
import {
  mod,
  WALL,
  wallGeometry,
  wallOffset,
  wallScale,
} from "../showcase-wall";

const LAPTOP = 1512;
const CARDS = 11;

describe("wallGeometry", () => {
  it("shows about five cards across a laptop", () => {
    // Deliberately looser than the reference's ~5.5: its cards are screenshots,
    // ours are the product and have to be readable. A range, not a figure — this
    // is a design knob, and a test that pins it just has to be edited in step.
    const { pitch } = wallGeometry(LAPTOP, CARDS);
    expect(LAPTOP / pitch).toBeGreaterThan(4.4);
    expect(LAPTOP / pitch).toBeLessThan(5.2);
  });

  it("leaves enough cards on the bend for it to read as a wall", () => {
    // Two flat and one bent is a carousel with a broken card in it. The bend
    // needs company, which is what caps how large the cards can go.
    const geo = wallGeometry(LAPTOP, CARDS);
    expect(((1 - geo.foldStart) * LAPTOP) / geo.pitch).toBeGreaterThan(2.5);
  });

  it("starts the fold two cards in, wherever that lands", () => {
    for (const stage of [1280, 1512, 1920, 2560]) {
      const { pitch, foldStart } = wallGeometry(stage, CARDS);
      expect((foldStart * stage) / pitch).toBeCloseTo(WALL.flatCards, 6);
    }
  });

  it("gives up on the wall when there is no room to bend in", () => {
    const { foldStart } = wallGeometry(390, CARDS);
    expect(foldStart).toBeGreaterThanOrEqual(1);
    expect(wallScale(0.99, foldStart)).toBe(1);
  });

  it("never fills the stage with a single card", () => {
    // The right-hand edge is the one you watch cards arrive at, and on a row
    // that never stops it shows ~52% of a card whatever the size — so bigger
    // cards are the only way to show more of it. The one thing that must not
    // happen is a stage so narrow that one card is the whole wall.
    for (const stage of [360, 390, 430, 768, 1024, LAPTOP, 1800]) {
      const { pitch } = wallGeometry(stage, CARDS);
      expect(stage / pitch).toBeGreaterThan(1.4);
    }
  });

  it("only reserves headroom on a stage that can actually fold", () => {
    // Room for a curve that cannot happen is a hole above the row, and it is
    // invisible in code review because it is empty space.
    expect(wallGeometry(390, CARDS).headroom).toBe(WALL.flatHeadroom);
    expect(wallGeometry(768, CARDS).headroom).toBe(WALL.headroom);
    expect(wallGeometry(LAPTOP, CARDS).headroom).toBe(WALL.headroom);
  });
});

describe("wallScale", () => {
  it("is flat up to the fold and exactly 2x at the far edge", () => {
    const { foldStart } = wallGeometry(LAPTOP, CARDS);
    expect(wallScale(0, foldStart)).toBe(1);
    expect(wallScale(foldStart, foldStart)).toBe(1);
    expect(wallScale(1, foldStart)).toBeCloseTo(2, 6);
  });

  it("holds past the right edge instead of running away", () => {
    // Cards wrap a full span to the right of the stage; without the clamp the
    // field goes singular and then negative out there.
    const { foldStart } = wallGeometry(LAPTOP, CARDS);
    expect(wallScale(3, foldStart)).toBeCloseTo(2, 6);
  });

  it("bows well clear of the chord a CSS transform would have drawn", () => {
    // Why the card art is painted rather than transformed: every CSS transform
    // maps a straight edge to a straight edge, so it can only ever draw the
    // chord. This is how far that chord misses by on the last card on stage.
    const geo = wallGeometry(LAPTOP, CARDS);
    const half = (geo.width * 9) / 16 / 2;
    const x = LAPTOP - geo.width; // the last card that fits on stage
    const at = (px: number) => wallScale(px / LAPTOP, geo.foldStart);
    const chord = (at(x) + at(x + geo.width)) / 2;
    expect((chord - at(x + geo.width / 2)) * half).toBeGreaterThan(3);
  });

  it("tracks the field measured off the reference", () => {
    // (u, scale) sampled off the reference frame, ±0.025 — against the fold the
    // reference itself had. Using our own would make this a test of the current
    // card size instead of the fitted curve, and it would drift every time the
    // wall is retuned.
    const foldStart = 0.355;
    for (const [u, s] of [
      [0.5, 1.058],
      [0.67, 1.158],
      [0.844, 1.421],
      [0.955, 1.778],
    ]) {
      expect(wallScale(u, foldStart)).toBeCloseTo(s, 1);
    }
  });
});

describe("the surface", () => {
  const geo = wallGeometry(LAPTOP, CARDS);

  it("bends toward the viewer going right, and never back", () => {
    // The near edge is always the right one. A dip anywhere in the field would
    // put a kink in the ribbon and read as a mistake rather than as depth.
    let last = 0;
    for (let x = 0; x < LAPTOP * 1.5; x += 7) {
      const s = wallScale(x / LAPTOP, geo.foldStart);
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
  });
});

describe("wallOffset", () => {
  const { pitch, span } = wallGeometry(LAPTOP, CARDS);

  it("puts every card where moving each card on its own did", () => {
    for (let k = 0; k < 500; k++) {
      const travelled = k * 37.77 * pitch; // several cycles, off the seams
      const travel = mod(travelled, span);
      for (let i = 0; i < CARDS; i++) {
        expect(wallOffset(i, pitch, span, travel) - travel).toBeCloseTo(
          mod(-travelled - i * pitch, span) - pitch,
          6,
        );
      }
    }
  });

  it("only changes when a card wraps", () => {
    // The whole point: the track moves every frame, a card is written about
    // twice a cycle (its own wrap, and the track's).
    const last: number[] = [];
    let writes = 0;
    for (let f = 0; f < 2000; f++) {
      const travel = mod((f * span) / 1000, span); // two cycles
      for (let i = 0; i < CARDS; i++) {
        const o = wallOffset(i, pitch, span, travel);
        if (last[i] !== o) writes++;
        last[i] = o;
      }
    }
    expect(writes).toBeLessThanOrEqual(CARDS * 5);
  });
});
