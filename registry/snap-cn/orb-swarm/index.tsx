"use client";

import { getInfo } from "@remotion/google-fonts/InterTight";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  oklchToRgb,
  parseColor,
  resolveFont,
  rgbToOklch,
} from "@/lib/snap-cn-ui";

/**
 * A sentence told one beat at a time while a field of glass orbs splits,
 * swarms, and threads itself into a ring around the last words.
 *
 * Four orbs burst out of the first line, split into eight, then sixteen; the
 * sixteen drift out, wind into a vortex, collapse into a knot, pay out as a
 * chain, and the chain loops around the closing card before it shrinks away
 * bead by bead.
 *
 * ## Everything is on the reference's clock
 *
 * The choreography was measured off a 24fps recording, beat by beat, so every
 * table below is indexed in *beats* (1/24 s) and read at fractional beats —
 * a 30fps composition samples between them and gets motion the recording
 * could not show, rather than a pulldown judder it did.
 *
 * ## The orbs are drawn, not styled
 *
 * Each orb carries a band texture that scrolls down its face once every
 * fourteen beats, and the bands bow toward the rim like latitude lines on a
 * sphere. A CSS gradient cannot bend, so the orbs are shaded per pixel into a
 * canvas — the same function the reference was fitted with, which is the only
 * way the two can agree to the pixel.
 */

/**
 * Inter Tight, registered as the variable face it is. The reference sets it a
 * hair under 500, and a canvas has no `font-variation-settings` — the weight
 * has to come from the face's own range, so the face declares the whole range.
 */
const FACE = "Orb Swarm Inter Tight";
export const WEIGHT = 490;
let faceLoad: Promise<unknown> | null = null;
function loadFace(): Promise<unknown> {
  if (faceLoad) return faceLoad;
  const url = getInfo().fonts.normal?.["500"]?.latin;
  if (typeof FontFace === "undefined" || !url) {
    faceLoad = Promise.resolve();
    return faceLoad;
  }
  const face = new FontFace(FACE, `url(${url}) format("woff2")`, {
    weight: "100 900",
  });
  document.fonts.add(face);
  faceLoad = face.load().catch(() => undefined);
  return faceLoad;
}

/* ─────────────────────────────────────────────────────────────────────────
   The card, in the reference's own 714 × 392 pixels
   ───────────────────────────────────────────────────────────────────────── */

export const REF_W = 714;
export const REF_H = 392;
/** The recording's frame rate: one beat. */
export const BEATS_PER_SECOND = 24;
/** The recording runs out here. */
export const END_BEAT = 128;

/* ─────────────────────────────────────────────────────────────────────────
   Tables
   ───────────────────────────────────────────────────────────────────────── */

type Table = readonly number[];

/**
 * Catmull-Rom through a table sampled at whole beats, clamped at both ends.
 * A frame between two beats gets the curve between them, not a straight line
 * with a corner at every beat.
 */
export function sample(table: Table, at: number): number {
  const n = table.length;
  if (n === 0) return 0;
  if (at <= 0) return table[0] as number;
  if (at >= n - 1) return table[n - 1] as number;
  const i = Math.floor(at);
  const t = at - i;
  const p0 = table[Math.max(0, i - 1)] as number;
  const p1 = table[i] as number;
  const p2 = table[i + 1] as number;
  const p3 = table[Math.min(n - 1, i + 2)] as number;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   The orb shader
   ───────────────────────────────────────────────────────────────────────── */

/** Radius the tables below are measured at, in card pixels. */
export const ORB_R = 20.12;
/**
 * The band texture, one period, 32 RGB stops. Read with Catmull-Rom so the
 * bands have no facets however large the orb is drawn.
 */
const TEX: Table = [
  227.8, 187.4, 247.2, 223.8, 183.2, 248.2, 220.8, 178.5, 247.4, 215.0, 173.3,
  249.4, 210.4, 167.4, 249.1, 203.6, 161.0, 250.2, 196.9, 153.9, 250.2, 190.1,
  146.9, 249.1, 182.7, 139.5, 249.2, 176.8, 132.8, 247.3, 169.6, 127.1, 247.9,
  166.0, 122.7, 247.7, 161.7, 120.9, 247.8, 160.5, 119.9, 248.9, 159.3, 120.7,
  248.6, 159.3, 122.5, 249.0, 160.7, 125.2, 250.3, 162.8, 130.6, 249.0, 168.1,
  136.1, 252.8, 173.5, 145.6, 249.4, 181.0, 153.3, 253.1, 187.8, 162.6, 251.7,
  196.0, 171.2, 252.9, 203.1, 179.4, 253.2, 211.3, 186.9, 252.9, 217.0, 192.7,
  253.9, 223.1, 196.4, 252.2, 225.7, 198.1, 251.9, 228.6, 197.8, 250.7, 229.7,
  196.6, 249.2, 230.2, 194.3, 248.6, 229.4, 191.3, 247.9,
];
const TEX_N = TEX.length / 3;
/**
 * How far the bands lag behind at radius r (every 2px from the centre), in
 * card pixels. Zero through the middle and nine at the rim: the bands bow.
 */
const WARP: Table = [
  0.95, 0.9, 0.84, 0.75, 0.68, 0.68, 0.93, 1.95, 4.17, 7.59, 11.02, 11.14,
];
/** One band period, in card pixels, and the beats it takes to scroll by. */
const PERIOD = 40.98;
const SCROLL_BEATS = 14;
/**
 * Coverage of the silhouette from r = 14.5 to 23 in half pixels: the orb's
 * edge is two pixels soft in the recording, and that softness is the look.
 * The last few pixels inside it are faintly see-through, which is what reads
 * as glass rather than paint.
 */
const COVER: Table = [
  1, 0.9698, 0.9633, 0.9566, 0.949, 0.9435, 0.9351, 0.9343, 0.9346, 0.9115,
  0.8077, 0.5824, 0.3101, 0.1139, 0.0331, 0, 0, 0,
];
/**
 * And a shade added on top across the same band, as a multiple of
 * `SHADE_TINT`: a dark ring just inside the edge, a breath of light outside.
 */
const SHADE: Table = [
  0, -1.517, -1.692, -2.088, -2.275, -2.52, -2.843, -2.97, -2.758, -1.804,
  -0.457, -0.016, -0.013, -0.206, 0.352, 0.088, 0.17, 0.211,
];
const SHADE_TINT = [2.87, 1.67, 1.43] as const;
const COVER_FROM = 14.5;

/**
 * The colour the orbs were measured in: the deep band of the texture. Every
 * accent in the scene — the bands, the letter tints, the washes — is turned
 * about the hue wheel by however far `orbColor` sits from this, in OKLCH, and
 * its chroma scaled the same way, so the glass keeps every one of its
 * lightnesses and only the colour changes.
 */
export const MEASURED_ORB = "#9f77f8";

export type Recolour = (
  rgb: readonly [number, number, number],
) => [number, number, number];

export function recolourer(target: string): Recolour {
  const from = rgbToOklch(parseColor(MEASURED_ORB));
  const to = rgbToOklch(parseColor(target));
  const turn = (to.h ?? 0) - (from.h ?? 0);
  const gain = from.c > 0 ? to.c / from.c : 1;
  if (Math.abs(turn) < 0.01 && Math.abs(gain - 1) < 0.001) {
    return ([r, g, b]) => [r, g, b];
  }
  return ([r, g, b]) => {
    const o = rgbToOklch({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 });
    const c = oklchToRgb(o.l, o.c * gain, (o.h ?? 0) + turn);
    return [c.r * 255, c.g * 255, c.b * 255];
  };
}

function recolourTable(tex: Table, f: Recolour): number[] {
  const out: number[] = [];
  for (let i = 0; i < tex.length; i += 3) {
    out.push(
      ...f([tex[i] as number, tex[i + 1] as number, tex[i + 2] as number]),
    );
  }
  return out;
}

function recolourHex(hex: string, f: Recolour): string {
  const c = parseColor(hex);
  const [r, g, b] = f([c.r * 255, c.g * 255, c.b * 255]);
  const h = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function texel(tex: Table, s: number, out: Float32Array) {
  const x = (((s % 1) + 1) % 1) * TEX_N;
  const i = Math.floor(x);
  const t = x - i;
  const t2 = t * t;
  const t3 = t2 * t;
  const a = (((i - 1) % TEX_N) + TEX_N) % TEX_N;
  const b = i % TEX_N;
  const c = (i + 1) % TEX_N;
  const d = (i + 2) % TEX_N;
  for (let k = 0; k < 3; k++) {
    const p0 = tex[a * 3 + k] as number;
    const p1 = tex[b * 3 + k] as number;
    const p2 = tex[c * 3 + k] as number;
    const p3 = tex[d * 3 + k] as number;
    out[k] =
      0.5 *
      (2 * p1 +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }
}

function linear(table: Table, step: number, from: number, r: number) {
  const x = (r - from) / step;
  if (x <= 0) return table[0] as number;
  const n = table.length - 1;
  if (x >= n) return table[n] as number;
  const i = Math.floor(x);
  const t = x - i;
  return (table[i] as number) * (1 - t) + (table[i + 1] as number) * t;
}

/* ─────────────────────────────────────────────────────────────────────────
   Choreography
   ───────────────────────────────────────────────────────────────────────── */

type Pt = readonly [number, number];
type Bead = { x: number; y: number; scale: number };

/** Four orbs burst out of the first line: each on its own ease. */
const BURST: readonly { s: Pt; d: Pt; p: Table }[] = [
  {
    s: [259.135, 148.78],
    d: [-52.97, -18.2],
    p: [
      0, 0.5593, 0.6832, 0.7541, 0.7975, 0.8274, 0.8509, 0.8667, 0.8808, 0.891,
      0.9002, 0.9096, 0.9176, 0.9245, 0.9323, 0.9399, 0.9459, 0.9532, 0.9617,
      0.9692, 0.9769, 0.9828, 0.9894, 1,
    ],
  },
  {
    s: [408.715, 157.87],
    d: [34.78, -31.73],
    p: [
      0, 0.3817, 0.5072, 0.5909, 0.6524, 0.7043, 0.7449, 0.7807, 0.8101, 0.8347,
      0.853, 0.8753, 0.8929, 0.9108, 0.926, 0.9383, 0.9522, 0.9618, 0.972,
      0.9807, 0.9866, 0.9925, 0.9952, 1,
    ],
  },
  {
    s: [266.665, 218.19],
    d: [-22.67, 55.67],
    p: [
      0, 0.4574, 0.5882, 0.6615, 0.7157, 0.7561, 0.7902, 0.8165, 0.8397, 0.8626,
      0.881, 0.8962, 0.911, 0.9216, 0.9324, 0.9419, 0.9488, 0.9548, 0.9628,
      0.9706, 0.9768, 0.9844, 0.9903, 1,
    ],
  },
  {
    s: [381.535, 239.21],
    d: [37.81, 48.15],
    p: [
      0, 0.3837, 0.5085, 0.5894, 0.6517, 0.6991, 0.7415, 0.7754, 0.806, 0.8347,
      0.8593, 0.8795, 0.8984, 0.9123, 0.9254, 0.9374, 0.9476, 0.9568, 0.9652,
      0.9728, 0.9794, 0.9875, 0.9928, 1,
    ],
  },
];
const BURST_AT = 10;

/** Eight: every orb splits in two, and the halves share one ease. */
const SPLIT_AT = 34;
const SPLIT_S: Table = [
  212.635, 110.64, 407.595, 119.44, 478.395, 122.11, 185.205, 148.69, 437.065,
  247.54, 477.325, 275.42, 207.395, 277.85, 271.865, 299.96,
];
const SPLIT_D: Table = [
  11.69, -37.49, -65.36, -13.05, 63.35, -8.18, -37.95, 31.45, 32.18, -73.37,
  105.26, -22.8, -66.18, 6.36, 50.69, 46.02,
];
const SPLIT_P: Table = [
  0, 0.2336, 0.4063, 0.5442, 0.6568, 0.7497, 0.8261, 0.8881, 0.9371, 0.9742, 1,
];

/** Sixteen: split again, drift out, then wind into a vortex. */
const SWARM_AT = 45;
const SWARM_S: Table = [
  211.205, 57.29, 359.035, 87.85, 317.405, 96, 566.885, 99.48, 207.045, 104.52,
  524.555, 122.65, 451.925, 158.7, 492.015, 192.36, 590.495, 228.02, 602.175,
  268.76, 176.965, 286.1, 122.135, 299.41, 290.055, 347.33, 353.835, 346.23,
  121.685, 158.39, 144.305, 153.96,
];
const SWARM_D: Table = [
  -39.77, -48.89, 51.39, -56.79, -74.84, -31.73, 76.25, -44.24, -52.26, 93.87,
  -52.11, 26.16, -52.21, -47.74, 68.83, 54.85, 23.81, -74.78, 58.97, 48.87,
  107.98, 5.27, -58.13, 45.24, -99.09, 3.39, 94.09, -0.04, -77.21, -67.1, -9.15,
  -80.84,
];
const SWARM_P: Table = [
  0, 0.1423, 0.2519, 0.3426, 0.4214, 0.4906, 0.5529, 0.6089, 0.6597, 0.7054,
  0.7474, 0.7853, 0.8198, 0.8509, 0.8788, 0.9037, 0.9259, 0.9452, 0.962, 0.9765,
  0.9888, 0.9996,
];
/** The vortex: degrees clockwise and scale about the centre, per beat. */
const VORTEX_AT = 63;
const VORTEX_CENTRE: Pt = [358.79, 198.69];
const VORTEX_TURN: Table = [
  0, 0.336, 0.822, 1.541, 2.539, 3.859, 5.563, 7.73, 10.461, 13.917, 18.355,
  24.062, 31.779, 42.811, 60.412,
];
const VORTEX_SCALE: Table = [
  1, 1, 1.0001, 0.9998, 0.999, 0.9962, 0.9912, 0.9834, 0.9723, 0.9569, 0.9359,
  0.907, 0.8662, 0.8047, 0.6993,
];
const CHAIN_AT = 76;

function swarm(beat: number): Bead[] {
  const out: Bead[] = [];
  const p = sample(SWARM_P, beat - SWARM_AT);
  const v = beat - VORTEX_AT;
  const turn = v > 0 ? (sample(VORTEX_TURN, v) * Math.PI) / 180 : 0;
  const k = v > 0 ? sample(VORTEX_SCALE, v) : 1;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  // The orbs shrink with the vortex, a fifth as fast: they fall away as well
  // as in.
  const size = 0.81 + 0.19 * k;
  for (let i = 0; i < SWARM_S.length / 2; i++) {
    const x = (SWARM_S[2 * i] as number) + (SWARM_D[2 * i] as number) * p;
    const y =
      (SWARM_S[2 * i + 1] as number) + (SWARM_D[2 * i + 1] as number) * p;
    const dx = x - VORTEX_CENTRE[0];
    const dy = y - VORTEX_CENTRE[1];
    out.push({
      x: VORTEX_CENTRE[0] + k * (cos * dx - sin * dy),
      y: VORTEX_CENTRE[1] + k * (sin * dx + cos * dy),
      scale: size,
    });
  }
  return out;
}

/**
 * The constellation is turned this far about the vortex centre, in degrees
 * (negative is counter-clockwise), while the orbs are free — so the layout is
 * this scene's own, not the reference's; only the motion is measured. It eases
 * back to zero as they collapse into the knot, turning the same way the vortex
 * already spins, and the chain and the ring are exactly as measured.
 *
 * Twelve degrees is the most either way that keeps every orb on screen and no
 * closer to the type than the reference's own layout comes, within 2px.
 */
export const LAYOUT_TURN = -12;
const TURN_UNTIL = 82;
const TURN_EASE = 6;

/** Every orb on screen at `beat`, bottom first. */
export function orbsAt(beat: number, turn: number = LAYOUT_TURN): Bead[] {
  const beads = measuredAt(beat);
  const f = Math.min(1, Math.max(0, (TURN_UNTIL - beat) / TURN_EASE));
  const a = (turn * f * Math.PI) / 180;
  if (a === 0) return beads;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return beads.map((b) => {
    const dx = b.x - VORTEX_CENTRE[0];
    const dy = b.y - VORTEX_CENTRE[1];
    return {
      x: VORTEX_CENTRE[0] + cos * dx - sin * dy,
      y: VORTEX_CENTRE[1] + sin * dx + cos * dy,
      scale: b.scale,
    };
  });
}

function measuredAt(beat: number): Bead[] {
  if (beat < BURST_AT) return [];
  if (beat < SPLIT_AT) {
    return BURST.map(({ s, d, p }) => {
      const q = sample(p, beat - BURST_AT);
      return { x: s[0] + d[0] * q, y: s[1] + d[1] * q, scale: 1 };
    });
  }
  if (beat < SWARM_AT) {
    const q = sample(SPLIT_P, beat - SPLIT_AT);
    const out: Bead[] = [];
    for (let i = 0; i < SPLIT_S.length / 2; i++) {
      out.push({
        x: (SPLIT_S[2 * i] as number) + (SPLIT_D[2 * i] as number) * q,
        y: (SPLIT_S[2 * i + 1] as number) + (SPLIT_D[2 * i + 1] as number) * q,
        scale: 1,
      });
    }
    return out;
  }
  if (beat < CHAIN_AT) return swarm(beat);
  return chainAt(beat);
}

/**
 * The chain, bead by bead: position and size per beat, head first.
 *
 * From the collapse to the last bead there is no rule the recording follows
 * closely enough to be worth a formula — the knot pays out as a stack, the
 * stack is swept left while its head swings round, the chain reaches round the
 * last card and shrinks away from the tail — so this is the measurement
 * itself, sixteen beads a beat, read with the same curve as every other table.
 */
const CHAIN_BEATS = 52;
const CHAIN: Table = [
  // 76
  231.89, -36.56, 0.963, 295.34, 2.29, 0.963, 352.17, -16.08, 0.963, 363.62,
  55.8, 0.963, 238.47, 86.94, 0.963, 430.84, 169.3, 0.963, 480.83, 127.97,
  0.963, 453.1, 231.4, 0.963, 534.38, 311.6, 0.963, 264.41, 212.99, 0.963,
  451.45, 337.8, 0.963, 104.89, 123.65, 0.963, 176.52, 196.68, 0.963, 330.64,
  334.49, 0.963, 472.15, 434.23, 0.963, 604.98, 269.5, 0.963,
  // 77
  315.5, -29.53, 0.943, 357.19, 18.33, 0.947, 409.53, 17.86, 0.942, 400.21,
  80.66, 0.943, 287.4, 74.23, 0.941, 426.57, 192.62, 0.947, 479.19, 171.25,
  0.943, 428.85, 250.15, 0.944, 475.86, 338.09, 0.945, 276.04, 185.98, 0.943,
  399.62, 338.47, 0.945, 166.15, 70.12, 0.942, 206.88, 149.55, 0.944, 299.51,
  304.4, 0.943, 390.8, 423.58, 0.943, 545.85, 321.3, 0.94,
  // 78
  411.48, 41.63, 0.905, 420.56, 86.89, 0.903, 453.11, 105.09, 0.901, 425.15,
  140.46, 0.903, 357.92, 96.76, 0.901, 401.75, 218.83, 0.901, 441.81, 224.08,
  0.901, 382.75, 255.13, 0.903, 380.54, 325.89, 0.901, 311.29, 161.65, 0.901,
  333.42, 299.18, 0.902, 284.59, 51.53, 0.903, 281.59, 114.78, 0.902, 283.8,
  242.97, 0.902, 298.2, 349.21, 0.904, 429.65, 340.14, 0.904,
  // 79
  428.61, 133.66, 0.861, 420.18, 159.59, 0.875, 432.74, 179.44, 0.792, 406.51,
  188.43, 0.862, 384.75, 146.18, 0.862, 371.38, 221.96, 0.862, 390.33, 236.25,
  0.862, 350.7, 234.86, 0.863, 328.79, 270.71, 0.862, 341.66, 165.76, 0.863,
  312.34, 243.13, 0.86, 360.38, 101.36, 0.86, 340.14, 133.04, 0.86, 303.42,
  199.61, 0.861, 279.41, 258.52, 0.86, 349.75, 292.49, 0.86,
  // 80
  407.88, 172.4, 0.836, 404.23, 186.67, 0.514, 400.44, 200.26, 0.866, 383.05,
  202.31, 0.841, 379.47, 172.44, 0.849, 356.35, 219.26, 0.987, 363.63, 228.7,
  0.857, 340.21, 219.84, 0.866, 314.88, 238.09, 0.705, 349.17, 180.94, 1.1,
  325.22, 219.34, 1.083, 371.4, 138.99, 0.844, 353.79, 155.71, 0.908, 316.86,
  189.74, 0.864, 290.05, 221.41, 0.843, 327.3, 256.38, 0.841,
  // 81
  384.87, 188.05, 0.759, 373.83, 205.28, 0.904, 374.42, 200.36, 0.834, 363.32,
  205.89, 0.826, 381.75, 189.07, 0.837, 330.94, 212.24, 0.844, 345.95, 221.33,
  0.815, 343.23, 211.54, 0.849, 317.68, 234.94, 0.82, 341.66, 183.53, 0.843,
  322.5, 212.49, 1.1, 362.99, 161.21, 0.827, 349.52, 173.03, 1.011, 319.36,
  188.8, 0.863, 296.67, 206.22, 0.822, 318.36, 221.14, 1.036,
  // 82
  363.41, 194.89, 0.578, 354.73, 205.18, 0.959, 361.27, 207.01, 0.993, 349.74,
  204.27, 0.974, 358.07, 197.25, 0.848, 320.05, 207.07, 0.83, 329.37, 215.37,
  0.778, 308.62, 221.21, 0.802, 309.55, 214.36, 0.968, 323.93, 187.06, 0.718,
  322.68, 202.19, 1.1, 346.33, 174.98, 0.816, 338.28, 184.29, 1.1, 315.83,
  193.52, 1.037, 296.33, 199.83, 0.814, 307.39, 222.72, 0.75,
  // 83
  365.43, 220.18, 0.596, 366.92, 215.6, 0.684, 361.34, 211.92, 0.931, 367.65,
  211.9, 0.656, 360.06, 214.16, 0.94, 356.43, 213.71, 0.87, 350.76, 209.49,
  1.003, 347.56, 208.96, 0.93, 341.77, 206.27, 0.997, 339.03, 206.52, 0.918,
  329.53, 202.16, 1.033, 313.67, 201.82, 1.096, 319.94, 203.15, 0.758, 311.07,
  192.31, 1.096, 290, 198.16, 0.901, 299.82, 207.85, 1.065,
  // 84
  359.41, 221.69, 0.989, 354.89, 220.22, 0.968, 348.72, 217.63, 1, 344.69,
  216.32, 0.941, 337.96, 213.58, 0.993, 333.01, 211.77, 0.966, 327.1, 209.53,
  0.994, 322.39, 207.67, 0.967, 316.42, 205.83, 0.985, 310.4, 203.7, 0.995,
  305.86, 202.84, 0.947, 299.82, 201.59, 0.94, 294.96, 190.41, 0.879, 290.41,
  203.59, 0.875, 279.87, 190.9, 0.708, 275.3, 201.44, 1.079,
  // 85
  355.88, 231.99, 0.992, 347.7, 229.23, 1.01, 334, 224.09, 1.005, 325.98,
  221.08, 0.989, 309.48, 214.58, 0.988, 318.5, 218.49, 0.993, 297.61, 210.25,
  1.002, 304.32, 213.53, 0.958, 287.95, 206.87, 0.995, 278.96, 202.58, 0.924,
  280.77, 204.63, 0.978, 272.74, 201.84, 0.989, 265.4, 200.46, 0.969, 260.06,
  196.73, 0.994, 249, 199.44, 1.035, 249.8, 201.37, 0.883,
  // 86
  349.51, 243.07, 0.992, 339.17, 240.2, 0.999, 328.64, 236.93, 1, 319.55,
  234.69, 0.951, 318.36, 232.13, 0.928, 308.53, 230.22, 0.995, 298.01, 226.27,
  0.995, 288, 222.69, 0.997, 277.73, 218.84, 0.992, 267.53, 214.8, 0.995,
  257.42, 211.16, 0.992, 247.43, 207.29, 0.991, 237.29, 203.85, 0.993, 226.48,
  200.67, 0.996, 215.64, 198.6, 0.995, 208.41, 199.29, 0.946,
  // 87
  339.22, 253.48, 1.002, 325.35, 250.74, 0.998, 311.5, 247.87, 0.996, 297.13,
  249.52, 0.753, 298.11, 243.8, 0.972, 283.83, 240.43, 0.995, 270.36, 236.14,
  0.999, 256.65, 231.62, 0.997, 243.35, 226.79, 0.998, 229.97, 221.91, 1,
  216.62, 216.86, 0.995, 203.05, 211.71, 1, 189.85, 206.85, 0.999, 176.06,
  202.29, 0.999, 162.46, 199.07, 0.995, 154, 199.31, 0.896,
  // 88
  325.39, 258.9, 0.996, 307.09, 258.24, 0.999, 288.61, 256.6, 1.002, 270.03,
  254.02, 1.001, 253.33, 243.44, 0.598, 251.99, 250.66, 0.994, 234.12, 246.53,
  1.002, 216.13, 241.64, 1, 198.2, 236.29, 1.002, 180.7, 230.4, 1.002, 163.61,
  224.25, 0.995, 146.18, 217.67, 1.001, 128.76, 211.08, 0.998, 111.31, 204.78,
  1.001, 93.77, 199.79, 1.003, 81.97, 198.9, 0.848,
  // 89
  312.27, 251.51, 1.003, 287.94, 256.23, 1.034, 253.85, 259.25, 1.1, 218.38,
  258.04, 1.018, 187.57, 254.6, 1.1, 153.76, 248.18, 1.087, 124.47, 240.04,
  1.024, 95.7, 230.44, 1.1, 63.61, 219.14, 1.088, 35.91, 208.6, 1.013, 12.75,
  200.82, 1.004, -19.77, 190.47, 1.089, -47.4, 163.54, 1.061, -72.83, 145.84,
  1.061, -97.92, 126.62, 1.061, -122.7, 105.86, 1.061,
  // 90
  311.54, 219.2, 0.998, 284.19, 232.03, 0.996, 255.97, 243.04, 1, 226.26, 251.8,
  1.022, 186.6, 257.35, 1.1, 143.73, 259.02, 1.1, 107.35, 255.62, 1.013, 77.01,
  250.12, 1.006, 47.57, 242.88, 1.007, 18.4, 233.91, 1.007, -10.8, 223.37,
  1.027, -46.71, 203.51, 1.02, -75.97, 186.53, 1.02, -104.16, 168.11, 1.02,
  -132.49, 147.6, 1.02, -159.74, 126.02, 1.02,
  // 91
  335.25, 163.48, 1.001, 302.76, 183.63, 1.002, 269.88, 202.73, 1.002, 236.15,
  220.56, 1.002, 201.45, 236.25, 1.002, 165.44, 248.64, 1.002, 128.12, 256.2,
  1.004, 90.09, 259, 1.003, 52, 257.54, 1.006, 14.4, 252.14, 1.004, -16.56,
  246.65, 0.985, -50, 237, 1, -82, 230, 1, -113, 222, 1, -143, 215, 1, -174,
  208, 1,
  // 92
  388.42, 94.19, 1.003, 348.25, 119.02, 1.002, 308.54, 144.62, 1.002, 268.71,
  170, 1.001, 228.35, 194.5, 1.003, 186.92, 217.12, 1.003, 143.97, 236.76,
  1.005, 99.05, 251.31, 1.003, 52.26, 258.19, 1.004, 5.23, 258.22, 0.999,
  -29.62, 258.47, 1, -70.53, 258.41, 1, -111.44, 258.35, 1, -152.35, 258.29, 1,
  -193.26, 258.23, 1, -234.17, 258.17, 1,
  // 93
  473.27, 47.97, 1.002, 417.8, 57.86, 0.999, 366.62, 82.42, 1.003, 317.8,
  111.56, 0.999, 270.03, 142.15, 1.001, 222.15, 172.71, 1, 173.35, 201.76,
  1.001, 122.82, 227.68, 1.001, 69.76, 247.93, 1.003, 13.98, 258.06, 0.998,
  -37.86, 268.35, 1, -91.63, 278.42, 1, -145.4, 288.49, 1, -199.17, 298.56, 1,
  -252.94, 308.63, 1, -306.71, 318.7, 1,
  // 94
  554.45, 102.54, 0.999, 503.59, 62.08, 0.998, 439.85, 47.93, 1, 376.27, 61.8,
  0.998, 318.01, 92.04, 0.999, 262.28, 126.72, 0.996, 207.04, 162.24, 0.998,
  151, 196.41, 0.999, 92.93, 226.94, 0.999, 31.42, 249.76, 0.999, -30.18,
  272.85, 1, -91.73, 295.8, 1, -153.28, 318.75, 1, -214.83, 341.7, 1, -276.38,
  364.65, 1, -337.93, 387.6, 1,
  // 95
  559.83, 207.85, 1, 549.14, 136.34, 0.998, 506.63, 78.21, 0.997, 439.96, 50.22,
  0.999, 368.05, 55.77, 0.997, 302.36, 87.3, 0.998, 240.18, 125.58, 0.998,
  178.81, 165, 0.997, 116.23, 202.6, 1, 50.79, 234.94, 0.999, -15.71, 254.5,
  0.858, -80.06, 299.41, 1, -145.48, 331.68, 1, -210.9, 363.95, 1, -276.32,
  396.22, 1, -341.74, 428.49, 1,
  // 96
  515.86, 294.25, 0.997, 541.2, 220.94, 0.999, 533.88, 143.4, 1, 490.35, 79.37,
  0.997, 418.57, 49.61, 1, 341.5, 58.99, 1, 271.65, 94.84, 0.999, 205.13,
  136.75, 1, 138.82, 178.89, 0.997, 70.41, 217.54, 0.997, -2.08, 247.46, 0.995,
  -54.82, 277.3, 1, -117.42, 307.17, 1, -180.02, 337.04, 1, -242.62, 366.91, 1,
  -305.22, 396.78, 1,
  // 97
  444.69, 338.22, 0.999, 507.61, 287.2, 0.999, 529.1, 208.44, 1.001, 514.97,
  127.94, 0.998, 460.32, 67.77, 0.998, 380.95, 47.76, 0.999, 302.35, 70.7,
  0.997, 230.78, 111.97, 0.998, 161.18, 156.63, 0.998, 90.61, 199.64, 0.997,
  16.54, 236.32, 0.996, -55.73, 272.8, 1, -128.88, 309.39, 1, -202.03, 345.98,
  1, -275.18, 382.57, 1, -348.33, 419.16, 1,
  // 98
  376.97, 349.09, 0.999, 458.52, 327.06, 0.997, 510.52, 261.7, 0.999, 519.17,
  177.68, 0.999, 488.39, 99.46, 0.999, 417.84, 53.93, 0.997, 333.7, 53.92,
  0.999, 256.86, 90.59, 0.998, 184.5, 135.81, 0.998, 112.42, 181.5, 0.994,
  37.77, 222.79, 0.988, -37.04, 263.93, 1, -111.72, 305.21, 1, -186.4, 346.49,
  1, -261.08, 387.77, 1, -335.76, 429.05, 1,
  // 99
  322.95, 345.61, 0.999, 409.11, 344.24, 0.998, 482.62, 301.22, 0.997, 513.26,
  221.55, 0.996, 503.47, 136.32, 0.998, 449.61, 70.24, 0.996, 366.97, 47.64,
  0.998, 284.54, 72.09, 0.996, 209.64, 115.85, 0.996, 136.66, 162.72, 0.989,
  62.16, 207.16, 0.982, -19.29, 243.58, 1.1, -87.07, 295.71, 1, -161.63, 340.07,
  1, -236.19, 384.43, 1, -310.75, 428.79, 1,
  // 100
  282.45, 333.52, 0.997, 367.3, 349.04, 1, 450.38, 326.5, 0.998, 502.23, 258.97,
  0.998, 509.43, 173.03, 0.998, 475.17, 94.57, 0.999, 400.82, 51.9, 0.997,
  315.19, 57.04, 0.995, 237.67, 96.45, 0.991, 164.17, 142.95, 0.984, 90.43,
  189.15, 0.971, 13.35, 229.8, 0.955, -59.83, 270.25, 1, -134.96, 310.85, 1,
  -210.09, 351.45, 1, -285.22, 392.05, 1,
  // 101
  252.94, 314.94, 0.999, 331.47, 347.44, 1, 416.99, 341.01, 1, 485.5, 291.51, 1,
  509.84, 209.93, 0.999, 494.79, 125.88, 0.998, 436.03, 64.87, 0.995, 352.29,
  47.81, 0.989, 271.47, 76.6, 0.982, 197.37, 120.84, 0.971, 124.73, 167.46,
  0.956, 50.33, 211.22, 0.935, -24.15, 254.98, 1, -98.57, 298.78, 1, -172.99,
  342.58, 1, -247.41, 386.38, 1,
  // 102
  234.21, 294.27, 1, 302.5, 341.5, 1, 386.54, 347.36, 1, 463.87, 315.84, 1,
  505.37, 243.77, 1, 506.14, 159.77, 0.996, 466.53, 86.48, 0.994, 391.31, 50.16,
  0.983, 308.32, 59.26, 0.971, 233.22, 98.44, 0.957, 161.74, 143.82, 0.935,
  89.94, 188.7, 0.908, 15.06, 228.44, 0.871, -58.26, 268.23, 0, -132.36, 307.95,
  0, -206.46, 347.67, 0,
  // 103
  222.91, 274.73, 1, 279.46, 332.59, 1, 359.7, 349.13, 1, 439.69, 331.85, 1,
  495.54, 273.33, 0.996, 509.98, 192.88, 0.993, 488.55, 114.27, 0.985, 427.38,
  60.86, 0.974, 346.51, 48.52, 0.959, 269.65, 77.57, 0.938, 198.84, 119.95,
  0.907, 129.34, 164.55, 0.868, 58.41, 206.82, 0.807, -12.52, 249.18, 0, -83.42,
  291.45, 0, -154.32, 333.72, 0,
  // 104
  216.38, 258.17, 1, 262.16, 322.1, 1, 337.15, 348.04, 1, 416.66, 341.02, 0.998,
  481.79, 296.64, 0.994, 508.82, 222.24, 0.985, 501.64, 143.02, 0.978, 456.71,
  78.08, 0.961, 382.92, 49.01, 0.939, 304.61, 60.77, 0.91, 233.69, 98.15, 0.867,
  165.94, 141.14, 0.809, 98.14, 183.85, 0.708, 27.84, 222.66, 0.503, -42.34,
  261.5, 0, -112.56, 300.19, 0,
  // 105
  212.72, 245.03, 1, 249.87, 312.15, 1, 319.21, 345.54, 1, 396.88, 345.86,
  0.996, 466.65, 313.27, 0.988, 504.67, 246.67, 0.976, 507.89, 169.34, 0.96,
  477.6, 98.61, 0.939, 413.7, 55.74, 0.91, 336.68, 50.25, 0.872, 264.87, 80.19,
  0.807, 198.07, 120.48, 0.706, 132.47, 162.71, 0.501, 65.53, 202.98, 0.301,
  -0.96, 243.23, 0, -67.61, 283.34, 0,
  // 106
  210.7, 235.34, 1, 241.57, 303.59, 0.999, 305.56, 342.48, 0.993, 380.99,
  348.15, 0.986, 452.44, 324.46, 0.973, 498.74, 265.78, 0.957, 509.96, 191.24,
  0.939, 491.02, 118.53, 0.911, 437.77, 65.98, 0.866, 364.66, 47.8, 0.808,
  291.69, 66.55, 0.705, 225.31, 103.37, 0.503, 161.18, 144.47, 0.297, 96.59,
  184.93, 0.194, 32.3, 225.18, 0, -32.12, 265.45, 0,
  // 107
  209.68, 228.78, 0.998, 236.2, 297.08, 0.991, 295.68, 339.49, 0.985, 368.92,
  349.04, 0.973, 440.45, 331.56, 0.959, 492.25, 280.19, 0.937, 509.83, 208.82,
  0.907, 499.07, 136.19, 0.868, 455.53, 77.39, 0.807, 387.42, 49.78, 0.706,
  314.52, 57.02, 0.504, 248.11, 89.82, 0.295, 185.36, 128.95, 0.199, 122.06,
  167.97, 0, 59.09, 206.95, 0, -3.88, 245.93, 0,
  // 108
  209.22, 225.08, 0.989, 233.05, 292.73, 0.983, 289.11, 337.04, 0.972, 360.21,
  349.31, 0.958, 431.09, 335.99, 0.935, 486.21, 290.54, 0.908, 508.82, 222.44,
  0.865, 503.84, 150.65, 0.806, 468.26, 88.43, 0.705, 405.57, 53.58, 0.501,
  333.9, 51.08, 0.307, 267, 79.02, 0.209, 200.02, 107.42, 0, 133.17, 135.52, 0,
  66.32, 163.62, 0, -0.53, 191.72, 0,
  // 109
  208.91, 222.65, 0.98, 230.95, 289.5, 0.971, 284.3, 334.99, 0.955, 353.49,
  349.23, 0.935, 423.58, 338.91, 0.908, 480.75, 298.18, 0.866, 507.41, 233.17,
  0.804, 506.66, 162.55, 0.702, 477.49, 98.56, 0.5, 420.16, 58.16, 0.29, 350.06,
  48.49, 0.194, 279.79, 38.81, 0, 209.7, 29.15, 0, 139.61, 19.49, 0, 69.52,
  9.83, 0, -0.57, 0.17, 0,
  // 110
  208.65, 220.38, 0.968, 229.22, 286.58, 0.956, 280.15, 333.02, 0.934, 347.81,
  349.01, 0.905, 417.03, 341.15, 0.864, 475.63, 304.39, 0.804, 505.79, 242.25,
  0.705, 508.47, 172.76, 0.5, 484.48, 107.94, 0.296, 431.96, 62.7, 0.199, 379.1,
  18.24, 0, 326.48, -26.52, 0, 273.86, -71.28, 0, 221.24, -116.04, 0, 168.62,
  -160.8, 0, 116, -205.56, 0,
  // 111
  208.57, 218.23, 0.954, 227.61, 283.88, 0.932, 276.55, 331.17, 0.904, 342.83,
  348.68, 0.864, 411.38, 342.76, 0.804, 470.96, 309.39, 0.701, 504.08, 249.89,
  0.502, 509.68, 181.49, 0.297, 489.93, 116.01, 0.209, 469.6, 50.8, 0, 449.77,
  -14.48, 0, 429.94, -79.76, 0, 410.11, -145.04, 0, 390.28, -210.32, 0, 370.45,
  -275.6, 0, 350.62, -340.88, 0,
  // 112
  208.38, 216.13, 0.932, 226.26, 281.39, 0.905, 273.43, 329.44, 0.865, 338.47,
  348.35, 0.804, 406.42, 344.02, 0.703, 466.72, 313.59, 0.502, 502.25, 256.41,
  0.301, 510.03, 188.98, 0.209, 517.45, 121.54, 0, 525.2, 54.21, 0, 532.95,
  -13.12, 0, 540.7, -80.45, 0, 548.45, -147.78, 0, 556.2, -215.11, 0, 563.95,
  -282.44, 0, 571.7, -349.77, 0,
  // 113
  208.24, 214.25, 0.904, 225.06, 279.06, 0.864, 270.57, 327.73, 0.802, 334.69,
  347.92, 0.705, 402.16, 345.11, 0.505, 463.11, 317.22, 0.304, 500.49, 262,
  0.197, 537.52, 206.37, 0, 574.9, 151.19, 0, 612.28, 96.01, 0, 649.66, 40.83,
  0, 687.04, -14.35, 0, 724.42, -69.53, 0, 761.8, -124.71, 0, 799.18, -179.89,
  0, 836.56, -235.07, 0,
  // 114
  208.12, 212.24, 0.863, 223.99, 276.94, 0.805, 268.12, 326.21, 0.705, 331.35,
  347.57, 0.501, 398.37, 345.86, 0.3, 459.46, 319.93, 0.196, 520.13, 293.43, 0,
  581.16, 267.36, 0, 642.19, 241.29, 0, 703.22, 215.22, 0, 764.25, 189.15, 0,
  825.28, 163.08, 0, 886.31, 137.01, 0, 947.34, 110.94, 0, 1008.37, 84.87, 0,
  1069.4, 58.8, 0,
  // 115
  208.03, 210.4, 0.804, 223, 274.88, 0.706, 265.9, 324.95, 0.505, 328.37,
  347.36, 0.302, 394.91, 346.62, 0.206, 461.17, 345.52, 0, 527.65, 344.75, 0,
  594.13, 343.98, 0, 660.61, 343.21, 0, 727.09, 342.44, 0, 793.57, 341.67, 0,
  860.05, 340.9, 0, 926.53, 340.13, 0, 993.01, 339.36, 0, 1059.49, 338.59, 0,
  1125.97, 337.82, 0,
  // 116
  207.92, 208.25, 0.705, 222.21, 272.76, 0.504, 263.98, 323.5, 0.311, 325.69,
  346.7, 0.208, 386.92, 369.81, 0, 448.46, 393.16, 0, 510, 416.51, 0, 571.54,
  439.86, 0, 633.08, 463.21, 0, 694.62, 486.56, 0, 756.16, 509.91, 0, 817.7,
  533.26, 0, 879.24, 556.61, 0, 940.78, 579.96, 0, 1002.32, 603.31, 0, 1063.86,
  626.66, 0,
  // 117
  207.9, 205.78, 0.502, 221.41, 270.17, 0.3, 262.03, 321.64, 0.218, 302.67,
  372.28, 0, 343.35, 423.39, 0, 384.03, 474.5, 0, 424.71, 525.61, 0, 465.39,
  576.72, 0, 506.07, 627.83, 0, 546.75, 678.94, 0, 587.43, 730.05, 0, 628.11,
  781.16, 0, 668.79, 832.27, 0, 709.47, 883.38, 0, 750.15, 934.49, 0, 790.83,
  985.6, 0,
  // 118
  207.96, 202.75, 0.29, 220.54, 266.99, 0.198, 233.19, 330.94, 0, 245.93,
  394.99, 0, 258.67, 459.04, 0, 271.41, 523.09, 0, 284.15, 587.14, 0, 296.89,
  651.19, 0, 309.63, 715.24, 0, 322.37, 779.29, 0, 335.11, 843.34, 0, 347.85,
  907.39, 0, 360.59, 971.44, 0, 373.33, 1035.49, 0, 386.07, 1099.54, 0, 398.81,
  1163.59, 0,
  // 119
  207.94, 198.97, 0.21, 207.65, 198.96, 0, 207.65, 198.96, 0, 207.65, 198.96, 0,
  207.65, 198.96, 0, 207.65, 198.96, 0, 207.65, 198.96, 0, 207.65, 198.96, 0,
  207.65, 198.96, 0, 207.65, 198.96, 0, 207.65, 198.96, 0, 207.65, 198.96, 0,
  207.65, 198.96, 0, 207.65, 198.96, 0, 207.65, 198.96, 0, 207.65, 198.96, 0,
  // 120
  208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0,
  208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0,
  208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0,
  // 121
  208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0,
  208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0,
  208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0,
  // 122
  208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0,
  208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0,
  208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0,
  // 123
  208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0,
  208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0,
  208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0,
  // 124
  208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0,
  208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0,
  208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0,
  // 125
  208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0,
  208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0,
  208, 200, 0, 208, 200, 0, 208, 200, 0, 208, 200, 0,
  // 126
  305.31, 118.88, 0, 376.91, 118.45, 0, 444.9, 118.65, 0, 516.65, 118.86, 0,
  588.4, 119.07, 0, 660.15, 119.28, 0, 731.9, 119.49, 0, 803.65, 119.7, 0,
  875.4, 119.91, 0, 947.15, 120.12, 0, 1018.9, 120.33, 0, 1090.65, 120.54, 0,
  1162.4, 120.75, 0, 1234.15, 120.96, 0, 1305.9, 121.17, 0, 1377.65, 121.38, 0,
  // 127
  340.65, 61.56, 0, 339.06, 61.24, 0, 339.06, 61.24, 0, 339.06, 61.24, 0,
  339.06, 61.24, 0, 339.06, 61.24, 0, 339.06, 61.24, 0, 339.06, 61.24, 0,
  339.06, 61.24, 0, 339.06, 61.24, 0, 339.06, 61.24, 0, 339.06, 61.24, 0,
  339.06, 61.24, 0, 339.06, 61.24, 0, 339.06, 61.24, 0, 339.06, 61.24, 0,
];
/** Draw order per beat, bottom first, as chain indices in hex. */
const CHAIN_ORDER: readonly string[] = [
  "fedcba9876543210",
  "fedcba9876543210",
  "0123456789abcdef",
  "10dcb9e8a574f362",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "0123456789abcdef",
  "0123456789abcdef",
  "0123456789abcdef",
  "0123456789abcdef",
  "0123456789abcdef",
  "0123456789abcdef",
  "0123456789abcdef",
  "0123456789abcdef",
  "0123456789abcdef",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
  "fedcba9876543210",
];

function chainAt(beat: number): Bead[] {
  const at = Math.min(Math.max(beat - CHAIN_AT, 0), CHAIN_BEATS - 1);
  const i = Math.floor(at);
  const t = at - i;
  const out: Bead[] = [];
  const read = (b: number, k: number, c: number) =>
    CHAIN[Math.max(0, Math.min(CHAIN_BEATS - 1, b)) * 48 + k * 3 + c] as number;
  for (let k = 0; k < 16; k++) {
    const pos = (c: number) => {
      const p0 = read(i - 1, k, c);
      const p1 = read(i, k, c);
      const p2 = read(i + 1, k, c);
      const p3 = read(i + 2, k, c);
      return (
        0.5 *
        (2 * p1 +
          (-p0 + p2) * t +
          (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
          (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
      );
    };
    const scale = Math.max(0, read(i, k, 2) * (1 - t) + read(i + 1, k, 2) * t);
    out.push({ x: pos(0), y: pos(1), scale });
  }
  // While the chain is a stack the tail lies on top; once it opens out, the
  // head. The knot in between is whatever the recording shows.
  const order = CHAIN_ORDER[i] ?? "";
  return Array.from(order, (c) => out[Number.parseInt(c, 16)] as Bead);
}

/* ─────────────────────────────────────────────────────────────────────────
   The canvas
   ───────────────────────────────────────────────────────────────────────── */

/** One letter, ready to paint: card pixels, its baseline, and its scale. */
export type Glyph = {
  ch: string;
  x: number;
  y: number;
  scale: number;
  colour: string;
};

/** The type is drawn this many times finer than the frame, then reduced. */
const TYPE_SUPERSAMPLE = 4;

function Stage({
  beat,
  width,
  height,
  k,
  left,
  top,
  background,
  glyphs,
  font,
  alpha,
  blur,
  tex,
}: {
  beat: number;
  width: number;
  height: number;
  k: number;
  left: number;
  top: number;
  background: readonly [number, number, number];
  glyphs: readonly Glyph[];
  font: string;
  alpha: number;
  blur: number;
  tex: Table;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const typeRef = useRef<HTMLCanvasElement | null>(null);
  const softRef = useRef<HTMLCanvasElement | null>(null);
  const beads = useMemo(() => orbsAt(beat), [beat]);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, width, height);
    paintOrbs(ctx, beads, beat, width, height, k, left, top, background, tex);
    if (glyphs.length === 0 || alpha <= 0) return;
    // Glyph baselines snap to whole device pixels, in a canvas as on the
    // page; drawn four times finer and reduced, they land where they were
    // measured to within a quarter of one.
    const type = typeRef.current ?? document.createElement("canvas");
    typeRef.current = type;
    const tctx = type.getContext("2d");
    if (!tctx) return;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const g of glyphs) {
      x0 = Math.min(x0, g.x - FONT_SIZE * g.scale);
      x1 = Math.max(x1, g.x + 2 * FONT_SIZE * g.scale);
      y0 = Math.min(y0, g.y - 1.4 * FONT_SIZE * g.scale);
      y1 = Math.max(y1, g.y + 0.8 * FONT_SIZE * g.scale);
    }
    const ss = TYPE_SUPERSAMPLE;
    // Whole device pixels at both ends, so the reduction is exact.
    const X0 = Math.floor(left + x0 * k);
    const Y0 = Math.floor(top + y0 * k);
    const W = Math.ceil(left + x1 * k) - X0;
    const H = Math.ceil(top + y1 * k) - Y0;
    type.width = W * ss;
    type.height = H * ss;
    tctx.clearRect(0, 0, type.width, type.height);
    tctx.font = font;
    tctx.textBaseline = "alphabetic";
    for (const g of glyphs) {
      const f = ss * k * g.scale;
      tctx.setTransform(
        f,
        0,
        0,
        f,
        (left + g.x * k - X0) * ss,
        (top + g.y * k - Y0) * ss,
      );
      tctx.fillStyle = g.colour;
      tctx.fillText(g.ch, 0, 0);
    }
    // Blur at the fine scale too: a blur of under a pixel is a no-op in
    // Skia, and a coarse one steps in whole-kernel jumps that a quarter
    // pixel hides.
    let src: HTMLCanvasElement = type;
    if (blur > 0) {
      const soft = softRef.current ?? document.createElement("canvas");
      softRef.current = soft;
      const sctx = soft.getContext("2d");
      if (sctx) {
        soft.width = type.width;
        soft.height = type.height;
        sctx.clearRect(0, 0, soft.width, soft.height);
        sctx.filter = `blur(${blur * k * ss}px)`;
        sctx.drawImage(type, 0, 0);
        src = soft;
      }
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, X0, Y0, W, H);
    ctx.restore();
  }, [
    beads,
    beat,
    width,
    height,
    k,
    left,
    top,
    background,
    glyphs,
    font,
    alpha,
    blur,
    tex,
  ]);
  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width, height }}
    />
  );
}

function paintOrbs(
  ctx: CanvasRenderingContext2D,
  beads: readonly Bead[],
  beat: number,
  width: number,
  height: number,
  k: number,
  left: number,
  top: number,
  background: readonly [number, number, number],
  tex: Table,
) {
  // Each orb's box in device pixels, then boxes that touch merged into one
  // region: overlapping orbs have to be painted into the same pixels in draw
  // order, and orbs that do not overlap should not cost a frame-sized buffer.
  type Box = { x0: number; y0: number; x1: number; y1: number; of: number[] };
  const boxes: Box[] = [];
  beads.forEach((b, i) => {
    if (b.scale <= 0.001) return;
    const reach = (COVER_FROM + 8) * b.scale;
    const x0 = Math.max(0, Math.floor(left + (b.x - reach) * k));
    const y0 = Math.max(0, Math.floor(top + (b.y - reach) * k));
    const x1 = Math.min(width, Math.ceil(left + (b.x + reach) * k));
    const y1 = Math.min(height, Math.ceil(top + (b.y + reach) * k));
    if (x1 > x0 && y1 > y0) boxes.push({ x0, y0, x1, y1, of: [i] });
  });
  for (let merged = true; merged; ) {
    merged = false;
    for (let i = 0; i < boxes.length && !merged; i++) {
      for (let j = i + 1; j < boxes.length && !merged; j++) {
        const a = boxes[i] as Box;
        const c = boxes[j] as Box;
        if (a.x0 < c.x1 && c.x0 < a.x1 && a.y0 < c.y1 && c.y0 < a.y1) {
          a.x0 = Math.min(a.x0, c.x0);
          a.y0 = Math.min(a.y0, c.y0);
          a.x1 = Math.max(a.x1, c.x1);
          a.y1 = Math.max(a.y1, c.y1);
          a.of = a.of.concat(c.of).sort((m, n) => m - n);
          boxes.splice(j, 1);
          merged = true;
        }
      }
    }
  }
  const col = new Float32Array(3);
  const phase = beat / SCROLL_BEATS;
  for (const box of boxes) {
    const w = box.x1 - box.x0;
    const h = box.y1 - box.y0;
    const buf = new Float32Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      buf[i * 3] = background[0];
      buf[i * 3 + 1] = background[1];
      buf[i * 3 + 2] = background[2];
    }
    for (const index of box.of) {
      const b = beads[index] as Bead;
      const reach = (COVER_FROM + 8) * b.scale;
      const bx0 = Math.max(box.x0, Math.floor(left + (b.x - reach) * k));
      const by0 = Math.max(box.y0, Math.floor(top + (b.y - reach) * k));
      const bx1 = Math.min(box.x1, Math.ceil(left + (b.x + reach) * k));
      const by1 = Math.min(box.y1, Math.ceil(top + (b.y + reach) * k));
      for (let py = by0; py < by1; py++) {
        // Card-pixel coordinates of this device pixel's centre, in the
        // orb's own frame (its scale shrinks the whole orb, texture and all).
        const ly = ((py + 0.5 - top) / k - b.y) / b.scale;
        for (let px = bx0; px < bx1; px++) {
          const lx = ((px + 0.5 - left) / k - b.x) / b.scale;
          const r = Math.hypot(lx, ly);
          if (r >= COVER_FROM + 8) continue;
          const cov = linear(COVER, 0.5, COVER_FROM, r);
          const shade = linear(SHADE, 0.5, COVER_FROM, r);
          texel(
            tex,
            (ly - linear(WARP, 2, 0, Math.min(r, 22))) / PERIOD - phase,
            col,
          );
          const o = ((py - box.y0) * w + (px - box.x0)) * 3;
          for (let c = 0; c < 3; c++) {
            buf[o + c] =
              (buf[o + c] as number) * (1 - cov) +
              (col[c] as number) * cov +
              shade * (SHADE_TINT[c] as number);
          }
        }
      }
    }
    const img = ctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      img.data[i * 4] = buf[i * 3] as number;
      img.data[i * 4 + 1] = buf[i * 3 + 1] as number;
      img.data[i * 4 + 2] = buf[i * 3 + 2] as number;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, box.x0, box.y0);
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   Type
   ───────────────────────────────────────────────────────────────────────── */

/** Font size and the line's advance-box centre and baseline, in card pixels. */
export const FONT_SIZE = 28.54;
export const LINE_CX = 358.87;
export const BASELINE = 206.46;
/** The scale pivot: the middle of the x-height, above the baseline. */
const PIVOT = 7.8;

/** One beat of the script: which card, how many of its words are showing. */
type Segment = {
  at: number;
  card: number;
  /** Words of the card on screen; more than the card has means all of them. */
  words: number;
  /** Line scale per beat from `at`, about the middle of the x-height. */
  scale: Table;
  /** Advance-box centre offset from `LINE_CX` per beat from `at`. */
  dx: Table;
  /** Baseline offset from `BASELINE` per beat from `at`. */
  dy?: Table;
  /**
   * Letters thrown off the baseline, in card pixels per beat from `at`. On the
   * way out they alternate up and down by the full amount; on the way in they
   * rise from below by it, weighted per letter by `rise`.
   */
  wave?: { amp: Table; enter: boolean };
  /**
   * The words this segment adds wear these, letter by letter, left to right —
   * a few indigos and a violet, never the same twice in a row — and turn to
   * ink the moment the next word lands.
   */
  tint?: readonly string[];
  /** The whole line in one colour, per beat from `at`; `""` is no override. */
  wash?: readonly string[];
  /** Opacity per beat from `at`. */
  alpha?: Table;
  /** Extra blur in card pixels per beat from `at`. */
  blur?: Table;
};

/**
 * How far each letter of an arriving card sits below the line, relative to
 * the card's mean: every second letter twice as far, and the left of the
 * line lower than the right.
 */
export function rise(j: number, n: number): number {
  const w = (i: number) =>
    (i % 2 ? 2.1 : 1) * (1 - (0.6 * i) / Math.max(1, n - 1));
  let sum = 0;
  for (let i = 0; i < n; i++) sum += w(i);
  return (w(j) * n) / sum;
}

const PINK = "#e5d1e4";
const LAVENDER = "#a495d9";
const WASH = "#8b7cc0";

const SEGMENTS: readonly Segment[] = [
  {
    at: 0,
    card: 0,
    words: 99,
    scale: [
      1.0003, 1.0008, 1.0017, 1.0049, 1.0086, 1.0159, 1.0261, 1.0422, 1.0688,
      1.1476,
    ],
    dx: [0.41],
    wave: {
      amp: [0, 0, 0, 0.02, 0.35, 0.56, 0.85, 1.34, 2.3, 5.4],
      enter: false,
    },
  },
  {
    at: 10,
    card: 1,
    words: 99,
    scale: [
      0.8914, 0.9367, 0.9577, 0.9689, 0.9759, 0.9813, 0.9868, 0.9897, 0.9933,
      0.9965, 0.9997, 1.0004,
    ],
    dx: [0.04, 0, 0, 0.02, -0.02, -0.02, 0, -0.05, -0.18, -0.54, -1.18, -3.8],
    dy: [0.42],
    wave: { amp: [3.94, 2.04, 1.15, 0.71, 0.33, 0.21, 0.08, 0], enter: true },
    tint: ["#232232", "#2b2546", "#503878", "#46347a", "#2e2a4a", "#1d193f"],
  },
  {
    at: 22,
    card: 2,
    words: 1,
    scale: [1.0052, 1.0081, 1.0091, 1.0109, 1.0119, 1.0138],
    dx: [2.2, 1.02, 0.43, -0.12, -1.0, -3.67],
    tint: ["#3a3450", "#625881", "#5c417f", "#432b61", "#30284a"],
  },
  {
    at: 28,
    card: 2,
    words: 2,
    scale: [0.9819, 0.9969, 1.0021, 1.0061, 1.0088, 1.011],
    dx: [1.32, 0.61, 0.2, -0.3, -1.12, -3.78],
    tint: ["#473b61", "#453c6a", "#322c5e"],
  },
  {
    at: 34,
    card: 3,
    words: 1,
    scale: [1.0183, 1.0186, 1.0175],
    dx: [-0.6, -1.41, -3.97],
    tint: ["#433861", "#3d3357"],
  },
  {
    at: 37,
    card: 3,
    words: 2,
    scale: [0.9867, 1.0046, 1.0131, 1.0177, 1.0202, 1.0248, 1.0259, 1.0283],
    dx: [0.85, 0.49, 0.31, 0.23, 0.08, -0.36, -1.12, -3.75],
    tint: ["#2f2941", "#483a5e", "#553f79", "#30274c"],
  },
  {
    at: 45,
    card: 4,
    words: 1,
    scale: [1.0351, 1.0367, 1.0381],
    dx: [1.86, -0.06, -3.13],
    tint: ["#463961", "#4f3b75", "#47376e"],
  },
  {
    at: 48,
    card: 4,
    words: 2,
    scale: [1.0023, 1.0216, 1.0289, 1.0318],
    dx: [1.49, 0.56, -0.51, -3.31],
    tint: ["#372a5b", "#493e6b"],
  },
  {
    at: 52,
    card: 4,
    words: 3,
    scale: [
      1.0193, 1.031, 1.0357, 1.0393, 1.0416, 1.0445, 1.046, 1.0476, 1.0496,
      1.0504, 1.0514, 1.0524, 1.053, 1.0544, 1.0554, 1.0563, 1.0575, 1.0578,
      1.0596, 1.0601,
    ],
    dx: [
      1.15, 0.56, 0.35, 0.24, 0.22, 0.16, 0.12, 0.1, 0.08, 0.05, 0.05, 0.04,
      0.04, 0.04, 0.05, 0.04, 0.03, 0.02, 0.03,
    ],
    tint: ["#322a4c", "#584670", "#78609b", "#5e4a82", "#3a2f58", "#3d3751"],
  },
  {
    // The card washes to lavender and is gone in three beats.
    at: 71,
    card: 4,
    words: 3,
    scale: [1.0601, 1.0601, 1.0608],
    dx: [0.08, 0.08, 0.03],
    wash: [WASH],
    alpha: [1, 1, 0.5, 0],
  },
  { at: 74, card: -1, words: 0, scale: [1], dx: [0] },
  {
    // The last card slides in from the right, holds, and lifts away.
    at: 88,
    card: 5,
    words: 99,
    scale: [1.0023],
    dx: [
      659.98, 362.82, 214.9, 141.01, 96.92, 67.35, 46.34, 31.09, 19.81, 11.74,
      6.09, 2.35, 0.36, -0.22,
    ],
    dy: [
      2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7,
      2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.7, 2.53,
      1.71, 0.27, -1.9, -5.05, -9.35, -15.23, -23.3, -34.65, -51.57, -75,
    ],
    wash: [PINK, PINK, PINK, LAVENDER, LAVENDER, ""],
    blur: [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0.25, 0.45, 0.6, 0.87, 1.2,
    ],
    alpha: [
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.62, 0,
    ],
  },
];

/** Step lookup: the value at the last whole beat, holding past the end. */
function step<T>(list: readonly T[] | undefined, at: number): T | undefined {
  if (!list || list.length === 0) return undefined;
  return list[Math.max(0, Math.min(list.length - 1, Math.floor(at + 1e-6)))];
}

type Letter = { ch: string; x: number; word: number };
/** Letters with their advance from the card's left edge, and the advance
 * width of the card with its first n words showing. */
type LineLayout = { letters: Letter[]; ends: number[] };

function layoutCard(
  words: readonly string[],
  measure: (s: string) => number,
): LineLayout {
  const text = words.join(" ");
  const letters: Letter[] = [];
  let word = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (ch === " ") {
      word++;
      continue;
    }
    letters.push({ ch, x: measure(text.slice(0, i)), word });
  }
  return {
    letters,
    ends: words.map((_, n) => measure(words.slice(0, n + 1).join(" "))),
  };
}

/** Parse `a b | c d | …` into cards of words. */
export function parseScript(script: string): string[][] {
  return script
    .split("|")
    .map((c) => c.trim().split(/\s+/).filter(Boolean))
    .filter((c) => c.length > 0);
}

/* ─────────────────────────────────────────────────────────────────────────
   The component
   ───────────────────────────────────────────────────────────────────────── */

export interface OrbSwarmProps {
  /**
   * Six cards, split with `|`. Cards three to five reveal word by word on the
   * reference's beats; the first, second and last arrive whole.
   */
  script?: string;
  /** The page. */
  background?: string;
  /** The type, once a word has settled. */
  ink?: string;
  /**
   * The orbs' colour. The whole glass — its bands, its rim, and the tints the
   * newest words wear — is turned to this hue and chroma; every lightness
   * stays as measured. `#9f77f8` is the reference's own violet.
   */
  orbColor?: string;
  fontFamily?: string;
  /**
   * How soft the type is, in card pixels of blur. The reference is a screen
   * capture and its type is this soft; 0 is crisp.
   */
  softness?: number;
  speed?: number;
  className?: string;
}

const DEFAULT_SCRIPT =
  "one command | what if | every launch | you shipped | got a video | in seconds";

function hexRgb(hex: string): readonly [number, number, number] {
  const h = hex.replace("#", "");
  const v =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = Number.parseInt(v.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function OrbSwarm({
  script = DEFAULT_SCRIPT,
  background = "#fcf9ff",
  ink = "#000000",
  orbColor = "#3577e0",
  fontFamily,
  softness = 0.7,
  speed = 1,
  className,
}: OrbSwarmProps) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const beat = (frame / fps) * BEATS_PER_SECOND * speed;
  const custom = resolveFont(fontFamily);
  const font = `${WEIGHT} ${FONT_SIZE}px ${custom ?? `"${FACE}"`}`;
  const bg = useMemo(() => hexRgb(background), [background]);
  const tex = useMemo(
    () => recolourTable(TEX, recolourer(orbColor)),
    [orbColor],
  );

  // `cover`, so a 16:9 composition crops the card rather than letterboxing it.
  const k = Math.max(width / REF_W, height / REF_H);
  const left = (width - REF_W * k) / 2;
  const top = (height - REF_H * k) / 2;

  const cards = useMemo(() => parseScript(script), [script]);

  // Letter advances come from the face itself, so the measurement waits for
  // it — and the frame waits for the measurement.
  const [handle] = useState(() => delayRender("orb-swarm: measuring type"));
  const [layouts, setLayouts] = useState<LineLayout[] | null>(null);
  useEffect(() => {
    let live = true;
    const run = async () => {
      await loadFace();
      await document.fonts.load(font).catch(() => undefined);
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx || !live) return;
      ctx.font = font;
      setLayouts(
        cards.map((c) => layoutCard(c, (s) => ctx.measureText(s).width)),
      );
    };
    run();
    return () => {
      live = false;
    };
  }, [cards, font]);
  useEffect(() => {
    if (layouts) continueRender(handle);
  }, [layouts, handle]);

  const { glyphs, alpha, blur } = useMemo(
    () => typeAt(beat, layouts, ink, orbColor),
    [beat, layouts, ink, orbColor],
  );

  return (
    <AbsoluteFill
      className={className}
      style={{ background, overflow: "hidden" }}
    >
      <Stage
        beat={beat}
        width={width}
        height={height}
        k={k}
        left={left}
        top={top}
        background={bg}
        glyphs={glyphs}
        font={font}
        alpha={alpha}
        blur={Math.hypot(blur, softness)}
        tex={tex}
      />
    </AbsoluteFill>
  );
}

/** Every letter on screen at `beat`, and the line's opacity and extra blur. */
export function typeAt(
  beat: number,
  layouts: readonly LineLayout[] | null,
  ink: string,
  orbColor: string = MEASURED_ORB,
): { glyphs: Glyph[]; alpha: number; blur: number } {
  const f = recolourer(orbColor);
  const none = { glyphs: [], alpha: 1, blur: 0 };
  let segment: Segment | null = null;
  for (const seg of SEGMENTS) if (beat >= seg.at) segment = seg;
  if (!layouts || !segment || segment.card < 0) return none;
  const layout = layouts[segment.card];
  if (!layout) return none;
  const local = beat - segment.at;
  const s = sample(segment.scale, local);
  const dx = sample(segment.dx, local);
  const dy = segment.dy ? sample(segment.dy, local) : 0;
  const blur = segment.blur ? Math.max(0, sample(segment.blur, local)) : 0;
  const alpha = segment.alpha
    ? Math.max(0, Math.min(1, step(segment.alpha, local) ?? 1))
    : 1;
  const shown = layout.letters.filter((l) => l.word < segment.words);
  const n = Math.min(segment.words, layout.ends.length);
  const span = layout.ends[n - 1] ?? 0;
  const cx = LINE_CX + dx;
  const x0 = cx - span / 2;
  const y = BASELINE + dy - PIVOT + PIVOT * s;
  const amp = segment.wave ? sample(segment.wave.amp, local) : 0;
  // The words this segment adds, as opposed to the ones already down.
  const before = SEGMENTS.filter(
    (g) => g.card === segment.card && g.at < segment.at,
  ).reduce((m, g) => Math.max(m, Math.min(g.words, layout.ends.length)), 0);
  const fresh = shown.filter((l) => l.word >= before);
  const wash = step(segment.wash, local) || "";
  const glyphs = shown.map((l, i): Glyph => {
    const lift = !segment.wave
      ? 0
      : segment.wave.enter
        ? amp * rise(i, shown.length)
        : i % 2
          ? -amp
          : amp;
    let colour = ink;
    if (wash) colour = recolourHex(wash, f);
    else if (segment.tint && l.word >= before) {
      const j = fresh.indexOf(l);
      const m = segment.tint.length;
      const at =
        fresh.length > 1 ? Math.round((j * (m - 1)) / (fresh.length - 1)) : 0;
      const tint = segment.tint[at];
      colour = tint ? recolourHex(tint, f) : ink;
    }
    return {
      ch: l.ch,
      x: cx + (x0 + l.x - cx) * s,
      y: y + lift,
      scale: s,
      colour,
    };
  });
  return { glyphs, alpha, blur };
}
