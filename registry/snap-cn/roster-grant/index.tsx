"use client";

import { loadFont as loadSans } from "@remotion/google-fonts/Inter";
import { type CSSProperties, forwardRef, type ReactNode, useMemo } from "react";
import {
  AbsoluteFill,
  getRemotionEnvironment,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Item,
  mixOklch,
  parseColor,
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
  withAlpha,
} from "@/lib/snap-cn-ui";

/**
 * Three rows of roster cards drifting past a pill, a pointer that clicks it,
 * and then the roster lighting up one card at a time.
 *
 * It is the "and everyone gets it" shot: the outer rows stream in opposite
 * directions, the middle row parts around a single call to action, a pointer
 * walks in and presses it, the pill flips to the accent, and a beat later the
 * monograms start turning over — not left to right but sprinkled, one every
 * seven frames, so it reads as a system granting rather than a list iterating.
 *
 * Beat by beat, measured off the reference at 30fps:
 *
 * | beat | seconds | what moves |
 * | --- | --- | --- |
 * | settle | 0 – 3.0 | camera 1.184 → 1, the middle row closing on the pill |
 * | approach | 0 – 1.32 | pointer (123, 90) → (104, −3) |
 * | press | 1.62 – 2.33 | pill 1 → 0.931 → 1 |
 * | flip | 1.69 | pill goes accent, on one frame |
 * | leave | 2.05 – 3.1 | pointer out to (178, 79) |
 * | grant | 2.333 + n/30 × 7 | one monogram per step |
 * | push | 3.0 – 4.0 | the whole scene pans left, accelerating |
 *
 * The camera and the middle row settle on the **same shape** — a plain
 * `exp(-t / τ)`, no knots — and on nearly the same clock: τ = 0.75 for the
 * pull-back, 0.80 and 0.91 for the gap the middle row leaves either side of the
 * pill. Near enough that the two read as one settle; far enough that forcing
 * them onto one number leaves a card 5px wide through the first half second.
 *
 * The outer rows do **not** run off that clock, and that is the whole texture
 * of the shot. Row 1 covers 372px in four seconds and row 3 covers 355, but row
 * 3 spends a quarter of its travel in the first 0.3s and row 1 does not — so
 * the two are never symmetric about the pill and the frame never reads as a
 * pattern. Fitting both to a shared exponential was tried; it came out 10px
 * wrong through the middle of the shot, which is a third of a card gap, and the
 * rows visibly locked into step. They are measured knots because they are not a
 * formula.
 */

const { fontFamily: SANS } = loadSans("normal", {
  weights: ["400", "500"],
  subsets: ["latin"],
});

/* ─────────────────────────────────────────────────────────────────────────
   Geometry, in the reference's own 712×398 pixels
   ───────────────────────────────────────────────────────────────────────── */

export const REF_W = 712;
export const REF_H = 398;

/**
 * What the pull-back scales about, and what every content coordinate below is
 * measured from.
 *
 * Horizontally it is where the pill's centre sits for the first fifty frames of
 * the reference without moving a pixel — 356, the middle of the frame. It is
 * the camera's fixed point by measurement, not by assumption.
 */
export const ORIGIN = { x: 356, y: 200 };

/** Row centre to row centre, at scale 1. */
export const ROW_PITCH = 109.5;

/**
 * A card, at scale 1.
 *
 * Fixed width, left-aligned content — worth stating because the reference only
 * makes it obvious once: its longest name ends 134px short of the card's right
 * edge. Content-sized chips would have made the rows ragged and the pitch
 * unmeasurable, and the pitch is what the whole marquee is fitted to.
 */
export const CARD = { w: 286, h: 76, radius: 8, gap: 26 };
export const CARD_PITCH = CARD.w + CARD.gap;

/** Inside a card. */
export const AVATAR = { size: 48, padX: 17.5, initials: 24 };
export const TEXT_X = AVATAR.padX + AVATAR.size + 12;
/** Line boxes at `lineHeight: 1`, offset from the card's top edge. */
export const NAME = { size: 20, top: 16.7, weight: 500 };
export const ROLE = { size: 13, top: 43.3, weight: 400 };

/** The pill. Content-sized: the padding is measured, the width follows the label. */
export const PILL = {
  h: 43,
  radius: 8,
  padX: 43,
  label: 20,
  /** The reference sets "Give access" with a double word space. */
  wordSpacing: 5,
  iconGap: 22,
  iconW: 24,
  iconH: 20,
};

/**
 * The pointer — lucide's `MousePointer2`, and where its tip sits in that icon's
 * own 24×24 box.
 *
 * 22, not the reference's 14: the reference draws a plain disc, and an arrow of
 * the same *height* reads smaller because most of its box is empty. 22 puts the
 * arrow's ink at about the disc's weight.
 */
export const CURSOR = { size: 22, tip: { x: 4.04, y: 4.69 } };

/* ─────────────────────────────────────────────────────────────────────────
   Curves — every number below was read off the reference's own frames
   ───────────────────────────────────────────────────────────────────────── */

/** The camera's clock. The middle row settles on the same shape a shade slower. */
export const TAU = 0.753;
export const ZOOM = 0.184;

export function ease(t: number): number {
  return Math.exp(-Math.max(0, t) / TAU);
}

/**
 * The camera, as a multiple of the settled scale.
 *
 * 1.184 at the first frame down to 1 — fitted, not knotted, because a pure
 * exponential lands inside a pixel at every one of the eleven frames it was
 * checked against. It never actually arrives, which is the point: this shot is
 * still shedding scale at frame 90, and a shot that truly settles reads as a
 * freeze-frame with a marquee glued on.
 */
export function cameraScale(t: number): number {
  return 1 + ZOOM * ease(t);
}

function knots(
  ts: readonly number[],
  vs: readonly number[],
  t: number,
): number {
  return interpolate(t, ts as number[], vs as number[], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/**
 * The top row, streaming left, in content px — its **own** drift, with the
 * camera and the exit pan both taken out.
 *
 * Tracked by aligning each frame against the next *in content space*, undoing
 * the camera first, so what is left is the row's motion and nothing else. A
 * plain screen-space correlation cannot tell a row sliding left from a camera
 * pulling back, and cheerfully reports a decelerating drift for a scene that
 * has none.
 *
 * Then the pan is subtracted, and that subtraction is the check on the whole
 * decomposition: the raw track runs to −372 and never flattens, but −372 minus
 * the pan lands on −258.8 at 3.73 and stays there to the last frame. The rows
 * stop; the camera does not. Left in as measured, the pan gets counted twice
 * and the top row is 34px past the reference by the final second.
 */
export const ROW1_T = [
  0, 0.322, 0.564, 0.964, 1.455, 1.964, 3.172, 3.497, 3.73, 4.005,
];
export const ROW1_V = [
  0, -69.7, -104.5, -144.2, -178.2, -204.5, -242.8, -248.9, -254.8, -258.8,
];

/** The bottom row, streaming right — front-loaded where the top row is not. */
export const ROW3_T = [
  0, 0.164, 0.247, 0.322, 0.564, 0.805, 1.047, 1.405, 1.855, 2.447, 3.047,
  3.364, 4.005,
];
export const ROW3_V = [
  0, 58.2, 93.6, 119.7, 175.8, 216.2, 247.4, 282.6, 314.5, 342.2, 357.9, 363,
  365,
];

/** Where a row sits, in content px. The middle row does not drift at all. */
export function rowDrift(row: 0 | 1 | 2, t: number): number {
  if (row === 0) return knots(ROW1_T, ROW1_V, t);
  if (row === 2) return knots(ROW3_T, ROW3_V, t);
  return 0;
}

/**
 * Where each outer row's slot 0 starts, so the first frame frames like the
 * reference's.
 *
 * Free parameters — the content is ours, so which card sits where is a choice —
 * but not arbitrary ones: these put every monogram within 10px of the
 * reference's for all 121 frames, which is what lets the two clips be diffed
 * on top of each other rather than only compared beat for beat.
 */
export const ROW_PHASE = [-118, 0, -142.3];

/**
 * The push out of the shot, in content px.
 *
 * Zero for three seconds and then everything — rows, pill, pointer — leaves
 * together, which is what makes it read as a camera and not as more marquee.
 * Measured on the pill's own centre, the one thing in frame with no drift of
 * its own to subtract first.
 */
export const PAN_T = [
  0, 2.95, 3.014, 3.247, 3.447, 3.564, 3.73, 3.814, 3.93, 3.972, 4.005,
];
export const PAN_V = [
  0, 0, -1, -6.5, -16.5, -25.5, -43.4, -55.9, -82.4, -95.4, -113.4,
];

export function pan(t: number): number {
  return knots(PAN_T, PAN_V, t);
}

/**
 * How much room the middle row leaves either side of the pill, in content px,
 * as `[floor, amplitude, time constant]`.
 *
 * Its two flanking cards close in — 91 → 51 on the left, 123 → 65 on the right
 * — on the same shape as the camera and, near enough, the same clock: 0.80s and
 * 0.91s against the camera's 0.75s. Near enough to read as one settle, far
 * enough that sharing the camera's number literally puts the right-hand card 5px
 * wide through the first half second.
 *
 * They are asymmetric and stay asymmetric, which is why this is two rows and not
 * one gap: forcing them equal put the right-hand card 14px wrong for a whole
 * second, and a card 14px out of place beside a pill that never moves is the one
 * misalignment the eye finds.
 *
 * This is also the reading that killed "the middle row is a marquee too". Over
 * four seconds its left card travels *right* by 40px while its right card
 * travels left by 58, and no single translation does that.
 */
export const CLEARANCE = {
  left: [51, 57.3, 0.805],
  right: [65, 79.7, 0.91],
} as const;

export function clearance(side: "left" | "right", t: number): number {
  const [floor, amp, tau] = CLEARANCE[side];
  return floor + amp * Math.exp(-Math.max(0, t) / tau);
}

/**
 * The pill's own scale under the press.
 *
 * Down in 0.18s, back in 0.53s — three times as long coming up as going down,
 * which is the whole reason a click feels like a click. Symmetric, it feels
 * like a bounce.
 */
export const PRESS_T = [
  1.622, 1.689, 1.764, 1.805, 1.897, 1.964, 2.047, 2.122, 2.205, 2.255, 2.33,
];
export const PRESS_V = [
  1, 0.969, 0.946, 0.931, 0.949, 0.958, 0.968, 0.977, 0.986, 0.995, 1,
];

export function pressScale(t: number): number {
  return knots(PRESS_T, PRESS_V, t);
}

/** When the pill turns over. Instant in the reference — no crossfade to find. */
export const FLIP_AT = 1.689;

/**
 * The pointer, in content px from `ORIGIN`.
 *
 * It arrives in two moves, not one: a fast approach that eases out to a hover
 * about 30px below the pill around t = 0.9, then a second, *accelerating* drop
 * onto the target. That second move peaks at 112px/s — quicker than anything in
 * the first — and it is what makes the click read as a decision rather than as
 * an arrival.
 */
export const CURSOR_T = [
  0, 0.164, 0.247, 0.322, 0.414, 0.489, 0.564, 0.722, 0.889, 0.93, 1.047, 1.164,
  1.289, 1.405, 2.03, 2.089, 2.172, 2.255, 2.33, 2.414, 2.505, 2.605, 2.73,
  2.897, 3.089, 3.289, 3.497, 3.689, 4.005,
];
export const CURSOR_X = [
  123, 117.8, 110.6, 106, 103.8, 102.3, 101.7, 101.3, 101.6, 101.6, 101.8,
  102.5, 103.6, 103.7, 104.9, 107, 112.1, 121.1, 133, 143, 150.2, 158, 163.6,
  168.8, 173, 175.4, 177.9, 178.4, 178.2,
];
export const CURSOR_Y = [
  89.5, 85.4, 76.1, 65.6, 56.6, 49.1, 43.2, 35.4, 30.2, 28.2, 22.2, 13.8, -0.2,
  -2.6, -2.6, 0.5, 5.8, 16.4, 29.6, 40.4, 48.3, 56.8, 62.7, 65.6, 72.9, 75.8,
  77.6, 78.5, 78.7,
];

/**
 * How far inside the pill's trailing edge the pointer comes to rest, in
 * reference px.
 *
 * Measured: it stops 104px right of centre on a pill 122px wide either side —
 * 18px in from the edge, past the icon rather than on it. Kept as an *inset*
 * rather than as an absolute x, because the pill is content-sized and a short
 * label would otherwise leave the pointer clicking thin air beside it.
 */
export const LAND_INSET = 18;
/** The pill the track was measured against, half-width in content px. */
export const REF_PILL_HALF = 122;

/**
 * The pointer's place at `t`, in content px from `ORIGIN`.
 *
 * The measured track is the track everywhere except over the pill: there x is
 * pulled in to the pill's own trailing edge, and the pull fades in across the
 * pill's height so no frame ever jumps. Scaling the *whole* track by the pill's
 * width instead moved the pointer's entry and exit too — 13px at the first
 * frame, on a path that has nothing to do with how wide the button is.
 */
export function cursorAt(
  t: number,
  pillHalf: number,
): { x: number; y: number } {
  const x = knots(CURSOR_T, CURSOR_X, t);
  const y = knots(CURSOR_T, CURSOR_Y, t);
  const over = Math.min(1, Math.max(0, (PILL.h * 1.5 - Math.abs(y)) / PILL.h));
  const pull = Math.max(0, x - (pillHalf - LAND_INSET));
  return { x: x - pull * over, y };
}

/**
 * When the first monogram turns over, and how often after that.
 *
 * Seven frames, not the 7.25 the five measured onsets average to. Four of those
 * five land on a 7-frame grid off 2.333 to the frame; averaging instead put
 * three of them a frame late to buy back one that is two frames early, and a
 * cascade that is consistently a frame behind is worse than one that is right
 * four times out of five.
 */
export const GRANT_AT = 70 / 30;
export const GRANT_STEP = 7 / 30;

export function granted(order: number, t: number): boolean {
  // A frame's worth of slack, because `70 / 30 + 2 * (7 / 30)` is 2.8000000000000003
  // and the frame it is supposed to fire on is 2.8. Without it the third turn
  // lands one frame late and nothing in the code says why.
  return t + 1e-6 >= GRANT_AT + GRANT_STEP * order;
}

/* ─────────────────────────────────────────────────────────────────────────
   Content
   ───────────────────────────────────────────────────────────────────────── */

export interface RosterEntry {
  /** Shown large. */
  name: string;
  /** Shown small, under it. */
  role: string;
  /** Two characters at most. Derived from `name` when omitted. */
  initials?: string;
}

/**
 * What snapcn is granting: its own registry.
 *
 * Four per row, because at this pitch a row shows three cards at once and a
 * roster of three tiles visibly across the frame.
 */
export const SNAPCN_ROSTER: readonly (readonly RosterEntry[])[] = [
  [
    { name: "Text Reveal", role: "Animation" },
    { name: "Prompt Send", role: "Composition" },
    { name: "Logo Drift", role: "Background" },
    { name: "Word Flip", role: "Animation" },
  ],
  [
    { name: "Count Grid", role: "Composition" },
    { name: "Agent Steps", role: "Composition" },
    { name: "Type Morph", role: "Animation" },
    { name: "Text Swell", role: "Animation" },
  ],
  [
    { name: "Karaoke Captions", role: "Composition" },
    { name: "Search Typing", role: "Composition" },
    { name: "Text Highlight", role: "Animation" },
    { name: "Orbit Gallery", role: "Composition" },
  ],
];

/**
 * Which turn each row takes, over two passes of the three rows.
 *
 * The reference goes top, middle, bottom, top, **bottom, middle** — the second
 * pass swaps the last two, so no row ever grants twice running and the sixth
 * monogram does not land where the third did. Six is the whole visible cascade;
 * it repeats from there.
 */
export const TURNS = [
  [0, 3],
  [1, 5],
  [2, 4],
] as const;

export function turnOf(row: number, step: number): number {
  return 6 * Math.floor(step / 2) + (TURNS[row % 3]?.[step % 2] ?? 0);
}

/**
 * Which roster entry a row starts its cascade on.
 *
 * Not entry 0. The marquee has moved 200-odd pixels by the time anything is
 * granted, so whichever entry sits at slot 0 is wherever the drift table left
 * it — keyed on entry 0, the cascade opened on a card whose avatar was 73px off
 * the left edge, and the reference's frame-70 grant did not appear until frame
 * 78. Seeding on the entry nearest the middle of the frame at `GRANT_AT` puts
 * the first monogram where a viewer is already looking, for any phase, any
 * drift and any roster length.
 *
 * Keyed on the roster entry rather than on the marquee slot, so every copy of a
 * card on screen turns over on the same frame: a component is installed once,
 * not once per place it is drawn.
 */
export function grantSeed(
  row: 0 | 1 | 2,
  len: number,
  pillHalf: number,
): number {
  // The *monogram's* distance from the middle, not the card's: a card can be
  // half on screen with its avatar 65px past the left edge, and a grant nobody
  // can see is a grant that did not happen. Seeding on the card instead put the
  // second turn nine frames behind the reference's.
  const reach = REF_W / 2 / cameraScale(GRANT_AT);
  let left = Number.NEGATIVE_INFINITY;
  let leftSlot: number | null = null;
  let near = Number.POSITIVE_INFINITY;
  let nearSlot = 0;
  for (const { slot, u } of slotsFor(row, GRANT_AT, pillHalf)) {
    const disc = u - CARD.w / 2 + AVATAR.padX + AVATAR.size / 2;
    if (Math.abs(disc) > reach - AVATAR.size / 2) continue;
    if (disc <= 0 && disc > left) {
      left = disc;
      leftSlot = slot;
    }
    if (Math.abs(disc) < near) {
      near = Math.abs(disc);
      nearSlot = slot;
    }
  }
  // The nearest monogram *left* of centre, not simply the nearest — because the
  // next entry in the roster is one slot to the right, and a cascade seeded on
  // the right-hand card sends its own second turn off the right edge. That is
  // what the reference does in all three rows, and the one row where it cannot
  // (the middle: the pill hides the card to its left) is the one row it seeds on
  // the right.
  const best = leftSlot ?? nearSlot;
  return ((best % len) + len) % len;
}

export function grantOrderOf(
  row: 0 | 1 | 2,
  entryIndex: number,
  len: number,
  seed: number,
): number {
  return turnOf(row, (((entryIndex - seed) % len) + len) % len);
}

export function initialsOf(entry: RosterEntry): string {
  if (entry.initials) return entry.initials;
  return entry.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

/* ─────────────────────────────────────────────────────────────────────────
   Layout
   ───────────────────────────────────────────────────────────────────────── */

/**
 * Inter's advance widths, in em, for the characters a button label uses.
 *
 * The pill is drawn `width: max-content`, so the *drawn* pill is always exactly
 * its content plus its padding and no label can ever be cramped. This table is
 * for everything that has to know how wide that pill will be **before** it is
 * drawn — where the middle row's cards sit either side of it, and where the
 * pointer lands on it.
 *
 * It replaced "0.52em to the character", which read a 130px label as 216 and
 * left the pill 30px wider than its own contents: balanced padding, and 15px
 * too much of it on each side. A per-character table is 30 lines of data and it
 * gets "Install all" to within a pixel; a single average cannot get any label
 * right, because the whole point of a label is that you do not know it yet.
 */
const ADVANCE: Record<string, number> = {
  " ": 0.26,
  "-": 0.35,
  ".": 0.27,
  ",": 0.27,
  "'": 0.19,
  "!": 0.29,
  a: 0.541,
  b: 0.578,
  c: 0.512,
  d: 0.578,
  e: 0.541,
  f: 0.34,
  g: 0.578,
  h: 0.552,
  i: 0.24,
  j: 0.24,
  k: 0.512,
  l: 0.24,
  m: 0.827,
  n: 0.552,
  o: 0.571,
  p: 0.578,
  q: 0.578,
  r: 0.351,
  s: 0.501,
  t: 0.35,
  u: 0.552,
  v: 0.499,
  w: 0.753,
  x: 0.501,
  y: 0.499,
  z: 0.474,
  A: 0.665,
  B: 0.654,
  C: 0.677,
  D: 0.7,
  E: 0.6,
  F: 0.578,
  G: 0.72,
  H: 0.71,
  I: 0.273,
  J: 0.531,
  K: 0.644,
  L: 0.57,
  M: 0.872,
  N: 0.73,
  O: 0.747,
  P: 0.635,
  Q: 0.747,
  R: 0.635,
  S: 0.614,
  T: 0.601,
  U: 0.71,
  V: 0.665,
  W: 0.948,
  X: 0.632,
  Y: 0.619,
  Z: 0.601,
};
/** Digits are one width in Inter, and anything unlisted gets a lowercase mean. */
const ADVANCE_FALLBACK = (ch: string) => (/[0-9]/.test(ch) ? 0.6 : 0.55);

/** How wide the label's text runs, in reference px. */
export function labelWidth(label: string): number {
  let em = 0;
  let spaces = 0;
  for (const ch of label) {
    em += ADVANCE[ch] ?? ADVANCE_FALLBACK(ch);
    if (ch === " ") spaces++;
  }
  return em * PILL.label + spaces * PILL.wordSpacing;
}

/** The pill's width, in reference px — content plus the measured padding. */
export function pillWidth(label: string): number {
  return PILL.padX * 2 + labelWidth(label.trim()) + PILL.iconGap + PILL.iconW;
}

/**
 * Where a card sits at rest, in reference px — before the row's own motion.
 *
 * Rows 0 and 2 are plain marquees on a pitch. Row 1 is two stacks anchored to
 * the pill's edges at their *closed* clearance, with the slot behind the pill
 * left empty — see `CLEARANCE` for why it cannot be a marquee.
 */
export function slotRest(
  row: 0 | 1 | 2,
  slot: number,
  pillHalf: number,
): number {
  if (row !== 1) return (ROW_PHASE[row] ?? 0) + slot * CARD_PITCH;
  const edge = pillHalf + CARD.w / 2;
  return slot < 0
    ? -(edge + CLEARANCE.left[0]) + (slot + 1) * CARD_PITCH
    : edge + CLEARANCE.right[0] + slot * CARD_PITCH;
}

/**
 * How far a row (or, for the middle row, one of its two stacks) has moved from
 * rest at `t` — the one number that is animated, per group, per frame.
 */
export function rowShift(row: 0 | 1 | 2, slot: number, t: number): number {
  if (row !== 1) return rowDrift(row, t);
  const side = slot < 0 ? "left" : "right";
  const open = clearance(side, t) - CLEARANCE[side][0];
  return side === "left" ? -open : open;
}

/** Where a card actually is at `t`, in reference px. */
export function slotsFor(
  row: 0 | 1 | 2,
  t: number,
  pillHalf: number,
): { slot: number; u: number }[] {
  return slotRange(row, pillHalf).map((slot) => ({
    slot,
    u: slotRest(row, slot, pillHalf) + rowShift(row, slot, t),
  }));
}

/**
 * Every slot of a row that reaches the frame at **any** point in the clip.
 *
 * Fixed, so the DOM never changes: a card that is drawn is drawn for all 120
 * frames and only its group's `translateX` moves. Mounting and unmounting cards
 * as they cross the edge is a layout pass on a frame that also has to composite
 * a camera move, and it lands on exactly the frames a marquee is least able to
 * hide it — the ones where something is entering.
 */
export function slotRange(row: 0 | 1 | 2, pillHalf: number): number[] {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  // 0.05s is a quarter of the fastest thing in the clip; the union cannot open
  // and close again between two samples.
  for (let t = 0; t <= 4.2; t += 0.05) {
    const reach = REF_W / 2 / cameraScale(t) + CARD.w;
    lo = Math.min(lo, -pan(t) - reach);
    hi = Math.max(hi, -pan(t) + reach);
  }
  // The middle row's stacks are indexed -1, -2, … and 0, 1, … — there is no
  // centre slot to skip, because the pill *is* the gap.
  const out: number[] = [];
  for (let slot = -12; slot <= 12; slot++) {
    let seen = false;
    for (let t = 0; t <= 4.2 && !seen; t += 0.05) {
      const u = slotRest(row, slot, pillHalf) + rowShift(row, slot, t);
      if (u > lo && u < hi) seen = true;
    }
    if (seen) out.push(slot);
  }
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────────────────────────────── */

export interface RosterGrantProps {
  /** Three rows of cards. Each row repeats across the frame. */
  rows?: readonly (readonly RosterEntry[])[];
  /** The pill's label. */
  label?: string;
  /** Overrides the design system's `primary` for the pill and the monograms. */
  accentColor?: string;
  /** Design-system token overrides. */
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
  /**
   * The face this scene paints its words in — a label from `fonts.ts` or a CSS
   * family you have loaded yourself. Overrides `theme.fontFamily`.
   */
  fontFamily?: string;
  /** 1 is the measured speed. */
  speed?: number;
}

export function RosterGrant({
  rows = SNAPCN_ROSTER,
  label = "Install all",
  accentColor,
  theme,
  mode,
  fontFamily,
  speed = 1,
}: RosterGrantProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  // `frame * speed`, so 2 is twice as fast — the convention every other timed
  // scene in this registry uses.
  const t = (frame * speed) / fps;

  const th = useSnapCnTheme(theme, mode);
  const accent = accentColor ?? th.primary;
  const face = resolveFont(fontFamily ?? th.fontFamily) ?? SANS;

  // Reference px → render px. The whole scene is laid out once in the
  // reference's own 712×398 and then scaled here, so nothing below this line
  // depends on the render size.
  const k = Math.min(width / REF_W, height / REF_H);
  const ox = (width - REF_W * k) / 2;
  const oy = (height - REF_H * k) / 2;

  const half = pillWidth(label) / 2;
  const point = cursorAt(t, half);

  // A hairline that belongs to the palette: the token walked most of the way
  // back toward the fill it edges, because `border` at full strength is a
  // shadcn *control* border and these are 76px chips, not controls.
  const edge = mixOklch(th.secondary, th.border, 0.55);

  // `will-change` is right for the Player and wrong for the render. One
  // continuous tab with an 8ms budget wants the camera handed to the
  // compositor; a render is spread across parallel tabs, each of which would
  // inherit a stale raster from whatever scale *it* drew last.
  const live = !getRemotionEnvironment().isRendering
    ? { willChange: "transform" as const }
    : null;

  // Fixed for the whole clip, so this is a `useMemo` and not a per-frame scan.
  const ranges = useMemo(
    () => [slotRange(0, half), slotRange(1, half), slotRange(2, half)],
    [half],
  );

  const groups: ReactNode[] = [];
  // An entry's index in `rows` read row by row — what Studio calls it by.
  let base = 0;
  for (const row of [0, 1, 2] as const) {
    const roster = rows[row] ?? [];
    const first = base;
    base += roster.length;
    if (roster.length === 0) continue;
    const seed = grantSeed(row, roster.length, half);
    // A row repeats its entries across the frame. Studio outlines the copy
    // nearest the middle of the frame; the others are only pictures of it.
    const nearest = new Map<number, number>();
    const held = new Map<number, number>();
    for (const slot of ranges[row] ?? []) {
      const i = ((slot % roster.length) + roster.length) % roster.length;
      const d = Math.abs(
        slotRest(row, slot, half) + rowShift(row, slot, t) + pan(t),
      );
      if (d < (held.get(i) ?? Number.POSITIVE_INFINITY)) {
        held.set(i, d);
        nearest.set(i, slot);
      }
    }
    const y = ORIGIN.y + (row - 1) * ROW_PITCH - CARD.h / 2;
    // One group per thing that moves: a whole row, or — for the middle row —
    // each side of the pill, which close in at different rates.
    const sides = row === 1 ? ([-1, 1] as const) : ([0] as const);
    for (const side of sides) {
      const slots = (ranges[row] ?? []).filter((n) =>
        row === 1 ? (side < 0 ? n < 0 : n >= 0) : true,
      );
      if (slots.length === 0) continue;
      groups.push(
        <div
          key={`${row}:${side}`}
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateX(${rowShift(row, side, t)}px)`,
            ...live,
          }}
        >
          {slots.map((slot) => {
            const i = ((slot % roster.length) + roster.length) % roster.length;
            const entry = roster[i];
            if (!entry) return null;
            return (
              <Item
                key={slot}
                index={first + i}
                primary={nearest.get(i) === slot}
              >
                <Card
                  accent={accent}
                  edge={edge}
                  entry={entry}
                  left={slotRest(row, slot, half) + ORIGIN.x - CARD.w / 2}
                  on={granted(grantOrderOf(row, i, roster.length, seed), t)}
                  th={th}
                  top={y}
                />
              </Item>
            );
          })}
        </div>,
      );
    }
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: th.background,
        fontFamily: face,
        // Hinting re-snaps every stem as the camera scale slides and the
        // letterforms boil. This is the fix, and it is not optional in a scene
        // that never stops scaling.
        textRendering: "geometricPrecision",
        overflow: "hidden",
      }}
    >
      {/* A transparent page asks for no page, and the backdrop is the page. */}
      {parseColor(th.background).alpha !== 0 && (
        <Backdrop accent={accent} th={th} />
      )}
      <div
        style={{
          position: "absolute",
          left: ox,
          top: oy,
          width: REF_W,
          height: REF_H,
          transform: `scale(${k})`,
          transformOrigin: "0 0",
        }}
      >
        {/* The camera. Everything under it is laid out once, at scale 1, and
            nothing in the scene animates a size or a position — only this
            transform and one `translateX` per row. Transforms do not reflow;
            an animated `fontSize` re-shapes every glyph in the frame on every
            frame, which is the most expensive thing a browser can be asked to
            do per frame and the reason the same scene can measure correct and
            still look like it is sticking. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `translateX(${pan(t) * cameraScale(t)}px) scale(${cameraScale(t)})`,
            transformOrigin: `${ORIGIN.x}px ${ORIGIN.y}px`,
            ...live,
          }}
        >
          {groups}
          <Pill
            accent={accent}
            label={label}
            on={t >= FLIP_AT}
            press={pressScale(t)}
            th={th}
          />
          <Pointer color={th.foreground} rim={th.background} at={point} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Pieces — all laid out in reference px, none of them animated
   ───────────────────────────────────────────────────────────────────────── */

/**
 * One roster card. Takes a `ref` and a `style` on top of its own so Remotion
 * Studio can outline it and nudge it (see `Item`).
 */
const Card = forwardRef<
  HTMLDivElement,
  {
    accent: string;
    edge: string;
    entry: RosterEntry;
    left: number;
    on: boolean;
    th: SnapCnTheme;
    top: number;
    style?: CSSProperties;
  }
>(function Card({ accent, edge, entry, left, on, th, top, style }, ref) {
  return (
    <div
      ref={ref}
      style={{
        ...style,
        position: "absolute",
        left,
        top,
        width: CARD.w,
        height: CARD.h,
        borderRadius: CARD.radius,
        background: th.secondary,
        // A hairline and nothing else. A drop shadow under nine light chips on
        // a light page is nine grey smears — and the reference's own card edge
        // is five levels of luma, which is a border, not a shadow.
        boxShadow: `inset 0 0 0 1px ${edge}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: AVATAR.padX,
          top: (CARD.h - AVATAR.size) / 2,
          width: AVATAR.size,
          height: AVATAR.size,
          borderRadius: "50%",
          background: on ? accent : th.card,
          color: on ? th.primaryForeground : th.foreground,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: AVATAR.initials,
          fontWeight: 500,
          lineHeight: 1,
        }}
      >
        {initialsOf(entry)}
      </div>
      <div
        style={{
          position: "absolute",
          left: TEXT_X,
          top: NAME.top,
          right: 10,
          fontSize: NAME.size,
          fontWeight: NAME.weight,
          lineHeight: 1,
          color: th.foreground,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {entry.name}
      </div>
      <div
        style={{
          position: "absolute",
          left: TEXT_X,
          top: ROLE.top,
          right: 10,
          fontSize: ROLE.size,
          fontWeight: ROLE.weight,
          lineHeight: 1,
          color: th.mutedForeground,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {entry.role}
      </div>
    </div>
  );
});

function Pill({
  accent,
  label,
  on,
  press,
  th,
}: {
  accent: string;
  label: string;
  on: boolean;
  press: number;
  th: SnapCnTheme;
}) {
  const fill = on ? accent : th.foreground;
  return (
    <div
      style={{
        position: "absolute",
        left: ORIGIN.x,
        top: ORIGIN.y,
        // `max-content`, so the pill is its own contents plus the measured
        // padding and a long label can never be cramped inside a guessed width.
        width: "max-content",
        height: PILL.h,
        padding: `0 ${PILL.padX}px`,
        boxSizing: "border-box",
        transform: `translate(-50%, -50%) scale(${press})`,
        borderRadius: PILL.radius,
        background: fill,
        color: on ? th.primaryForeground : th.background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: PILL.iconGap,
        fontSize: PILL.label,
        fontWeight: 500,
        wordSpacing: PILL.wordSpacing,
        lineHeight: 1,
        whiteSpace: "nowrap",
        // A 1px lighter rim along the top, which is what the reference has and
        // what stops a saturated pill reading as a sticker, plus a glow in the
        // pill's *own* colour — so it can never be the grey smear a neutral
        // drop shadow would be on this page.
        boxShadow: [
          `inset 0 1px 0 ${withAlpha("#ffffff", 0.22)}`,
          `0 10px 26px -6px ${withAlpha(fill, 0.34)}`,
        ].join(", "),
      }}
    >
      <span>{label}</span>
      <svg
        width={PILL.iconW}
        height={PILL.iconH}
        viewBox="0 0 24 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <title>Install</title>
        <path d="M12 1.5v10.5" />
        <path d="M7.5 7.5 12 12l4.5-4.5" />
        <path d="M3.5 14.5v3a1.5 1.5 0 0 0 1.5 1.5h14a1.5 1.5 0 0 0 1.5-1.5v-3" />
      </svg>
    </div>
  );
}

/**
 * The pointer — lucide's `MousePointer2`, filled, with a rim in the page colour
 * so it reads over a card, over the pill and over the backdrop alike.
 *
 * Positioned by its **tip**, not its centre: the reference's pointer is a plain
 * disc and the tracked point is that disc's middle, but an arrow's hotspot is
 * the point it is drawn from. Anchoring the box instead puts the click a third
 * of the glyph away from where the reference clicked.
 */
function Pointer({
  at,
  color,
  rim,
}: {
  at: { x: number; y: number };
  color: string;
  rim: string;
}) {
  return (
    <svg
      width={CURSOR.size}
      height={CURSOR.size}
      viewBox="0 0 24 24"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: `translate(${ORIGIN.x + at.x - CURSOR.tip.x * (CURSOR.size / 24)}px, ${ORIGIN.y + at.y - CURSOR.tip.y * (CURSOR.size / 24)}px)`,
        overflow: "visible",
      }}
      aria-hidden
    >
      <title>Pointer</title>
      <path
        d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"
        fill={color}
        stroke={rim}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The page under it all.
 *
 * The reference's backdrop is a mesh: white through the middle of the top edge,
 * a wash of its brand indigo climbing out of the bottom-right, and a lighter
 * core right behind the pill. Its *shape* is worth keeping and its paint is
 * not — so the wash here is the accent, at the alphas measured off the
 * reference, and it follows a user's theme instead of a stranger's brand.
 */
function Backdrop({ accent, th }: { accent: string; th: SnapCnTheme }) {
  return (
    <AbsoluteFill
      style={{
        background: [
          `radial-gradient(58% 44% at 50% 46%, ${withAlpha(th.card, 0.9)} 0%, ${withAlpha(th.card, 0)} 100%)`,
          `radial-gradient(78% 62% at 64% 116%, ${withAlpha(accent, 0.42)} 0%, ${withAlpha(accent, 0)} 100%)`,
          `radial-gradient(52% 46% at -4% -8%, ${withAlpha(accent, 0.16)} 0%, ${withAlpha(accent, 0)} 100%)`,
          th.background,
        ].join(", "),
      }}
    />
  );
}

export default RosterGrant;
