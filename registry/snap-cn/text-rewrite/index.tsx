"use client";

import { loadFont as loadSans } from "@remotion/google-fonts/Inter";
import { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  getRemotionEnvironment,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  mixOklch,
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
  withAlpha,
} from "@/lib/snap-cn-ui";

// Loaded through @remotion/google-fonts, never a CSS variable — a Remotion
// bundle has none of the app's CSS, so a `var(--font-…)` gets you the right face
// in the Player and a fallback in the mp4 (design-system rule 4).
const { fontFamily: SANS } = loadSans("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

// --- The stage -------------------------------------------------------------
//
// The reference recording is 810×458 and every number below was read off its
// frames, so there is no second conversion to get wrong.

const REF_W = 810;
const REF_H = 458;

// --- Measured proportions --------------------------------------------------

/** The line is set tight — a hair of negative tracking, tighter word gaps. */
const TRACKING = -0.012;
const WORD_GAP = -0.05;

/**
 * The selection box, in em of the type it sits behind: `0.954` tall, bottom
 * `0.083` below the baseline, reaching `0.11` past the type on an unclipped end.
 *
 * Measured at full size: the box is y 200…245 against a baseline at 241, and
 * runs x 174…577 against ink at 180…572.
 */
const SEL_HEIGHT = 0.954;
const SEL_BELOW = 0.083;
const SEL_PAD = 0.11;

/**
 * The mark: `0.4em` clear of the last visible letter, its centre sitting `0.4em`
 * above the baseline — measured, 19.5px above a baseline at 241, at a type size
 * of 48.
 *
 * `markSize` is the *box*, not the ink. The reference's mark inks 36×40px of a
 * 0.83em square; ours fills about 70% of its own box, so 1.15em of box puts the
 * same amount of ink on the line.
 */
const MARK_GAP = 0.4;
const MARK_SIZE = 1.15;
const MARK_RISE = 0.4;

/**
 * The sheen, as `[position, × the base alpha]`.
 *
 * Measured on eight frames spanning three different box widths and two phases —
 * 402px selected, 272px after the rewrite, 193px mid-erase. It lands in the same
 * place every time: **deepest at 0.36, palest at 0.575, a 3.2× swing**. That is
 * a gradient painted on the box, not on the page, which is why it appears to
 * travel as the box is dragged and then eaten.
 */
const SHEEN: readonly (readonly [number, number])[] = [
  [0, 0.93],
  [0.1, 1.19],
  [0.19, 1.24],
  [0.3, 1.49],
  [0.37, 1.56],
  [0.44, 1.03],
  [0.51, 0.57],
  [0.59, 0.49],
  [0.69, 0.59],
  [0.78, 0.75],
  [0.89, 1.03],
  [1, 1.16],
];

/**
 * The curve the erase and the rewrite both run on.
 *
 * Fitted on the recording's own timestamps — it is a 60fps capture with eight
 * dropped frames, so a frame index is not a clock. The erase's clip edge over
 * 29 frames gives **cubic-bezier(0.419, −0.050, 0.184, 1.044)** at rms 0.0086 of
 * the travel; the rewrite, fitted independently on the line's *centre* rather
 * than on any edge, gives **cubic-bezier(0.427, 0.021, 0.193, 0.999)** at rms
 * 0.0059. Two different signals, two different halves of the gesture, the same
 * curve — so it is one ease, and this is it.
 *
 * It is an ease-in-out, and that is the whole character of the move: the edge
 * creeps for four frames, crosses the sentence in twelve, and settles for
 * twelve more. An ease-out would have made it look like a deletion. This looks
 * like something being read and then taken away.
 */
const SWEEP_EASE = Easing.bezier(0.42, 0, 0.19, 1);

/**
 * The selection drag.
 *
 * Measured without touching the gradient at all: take nineteen fixed columns
 * across the line and find the frame the warmth arrives in each. The edge is
 * 28% across by 17ms, 54% by 33ms, 71% by 50ms, 91% by 100ms and 97% by 150ms.
 * That is an `easeOut` of degree **3.5 over 200ms** — a `quint` is far too fast
 * off the mark and misses the first two points by twenty points of travel.
 */
const DRAG_EASE = Easing.out(Easing.poly(3.5));

/** A word's fade, and the settle of the line's width around it. */
const WORD_EASE = Easing.out(Easing.cubic);

/**
 * The snapcn mark, the same outline `public/logo.svg` draws, in a `0 0 100 100`
 * box. `markPath` replaces it with any path drawn in the same box; an empty
 * string leaves the line bare.
 */
export const MARK_PATH =
  "M15.757 15.459c-3.324 0.816 -6.07 2.966 -7.563 5.911 -1.194 2.388 -1.174 1.672 -1.174 24.66 0 19.982 0.02 21.077 0.378 22.132 0.955 2.926 2.946 4.498 6.588 5.215 1.99 0.398 2.528 0.657 3.702 1.732 1.055 0.975 1.473 2.169 1.473 4.219 0.02 2.408 0.836 3.901 2.647 4.856l1.035 0.537 19.505 0.06c17.574 0.06 19.624 0.02 20.739 -0.259 1.493 -0.418 2.647 -1.333 3.403 -2.766l0.537 -1.015 0.06 -6.269c0.04 -3.443 0.04 -6.807 0 -7.444l-0.06 -1.194 -0.617 0.995c-0.717 1.174 -2.01 2.289 -3.383 2.906l-0.975 0.458 -16.121 0.06c-11.763 0.04 -16.42 -0 -17.216 -0.159 -2.548 -0.557 -5.135 -2.408 -6.468 -4.657 -1.294 -2.189 -1.314 -2.548 -1.254 -16.44l0.06 -12.439 0.478 -1.154c0.876 -2.209 2.926 -4.18 5.374 -5.155l1.115 -0.458 16.519 -0.06c16.101 -0.04 16.539 -0.04 17.813 0.358 1.592 0.498 2.966 1.473 3.941 2.826l0.736 1.035 0.06 -6.648c0.06 -7.304 -0.06 -8.319 -1.115 -9.832 -0.597 -0.876 -1.95 -1.811 -3.025 -2.11 -0.438 -0.119 -9.096 -0.199 -23.386 -0.179 -18.37 0.02 -22.908 0.06 -23.804 0.279zM79.665 31.819c-6.508 3.901 -11.902 7.185 -11.981 7.304 -0.08 0.119 -0.139 5.055 -0.1 10.947l0.04 10.748 2.886 1.811c1.592 0.995 4.14 2.587 5.672 3.523 1.533 0.935 5.632 3.463 9.096 5.613 3.463 2.15 6.488 3.901 6.707 3.901 0.219 -0 0.537 -0.139 0.697 -0.318 0.279 -0.279 0.318 -2.806 0.318 -24.958 0 -15.544 -0.08 -24.839 -0.199 -25.157 -0.139 -0.398 -0.318 -0.517 -0.736 -0.517 -0.358 0.02 -4.617 2.448 -12.399 7.105z";

// --- The timeline, as pure functions ---------------------------------------

/**
 * How many words have landed, and how far the newest one has opened the line.
 *
 * The reference does **not** reflow when a word lands. Measured across all four
 * arrivals, both ends of the line move outward by the same amount over the same
 * five frames — +18, +8, +4, +2, +1 on the right and the mirror of that on the
 * left — while the centre never leaves 404 of 810. So the line's *width* is
 * tweened around a fixed centre and the new word is revealed by it, rather than
 * being dropped into a flow that jumps.
 */
export function landed(
  t: number,
  n: number,
  o: { at: number; stagger: number; dur: number },
): { count: number; grow: number } {
  if (t < o.at) return { count: 0, grow: 0 };
  // +1e-6: a cue lands on an exact multiple of the stagger, and in doubles
  // 0.217 + 3 × 0.189 divides back to 2.9999999, which drops a word.
  const raw = Math.floor((t - o.at) / o.stagger + 1e-6) + 1;
  const count = Math.min(n, raw);
  const cue = o.at + (count - 1) * o.stagger;
  const grow =
    o.dur <= 0
      ? 1
      : interpolate(t, [cue, cue + o.dur], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: WORD_EASE,
        });
  return { count, grow };
}

/**
 * A word's ink: its opacity, and how far it has cooled out of the accent.
 *
 * Every word arrives in the accent, holds it for one beat — the same 189ms as
 * the stagger — and cools over the next, so exactly one word is ever coloured
 * and it walks the line ahead of the reader. The last word has no next word to
 * hand off to: on the reference it cools *while the selection is dragged over
 * it*, in half the time the drag takes, and is dark by the time the line is
 * selected.
 */
export function wordInk(
  t: number,
  i: number,
  o: {
    at: number;
    stagger: number;
    dur: number;
    coolDelay: number;
    coolDur: number;
    dragAt?: number;
    dragDur?: number;
    last?: boolean;
  },
): { opacity: number; cool: number } {
  const cue = o.at + i * o.stagger;
  if (t < cue) return { opacity: 0, cool: 0 };
  const opacity = interpolate(t, [cue, cue + o.dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: WORD_EASE,
  });
  const useDrag = o.last === true && o.dragAt !== undefined;
  const from = useDrag ? (o.dragAt as number) : cue + o.coolDelay;
  const span = useDrag ? (o.dragDur ?? o.coolDur) / 2 : o.coolDur;
  const cool = interpolate(t, [from, from + Math.max(1e-4, span)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { opacity, cool };
}

/**
 * The selection being dragged across, as a fraction of the line.
 *
 * 28% across at 17ms, 54% at 33ms, 71% at 50ms — see `DRAG_EASE` for how that
 * was measured without the gradient getting in the way. It starts on the same
 * frame the line comes forward.
 */
export function dragIn(t: number, o: { at: number; dur: number }): number {
  if (o.dur <= 0) return t >= o.at ? 1 : 0;
  return interpolate(t, [o.at, o.at + o.dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: DRAG_EASE,
  });
}

/** A sweep on the measured ease-in-out. Both halves of the rewrite use it. */
export function sweep(t: number, o: { at: number; dur: number }): number {
  if (o.dur <= 0) return t >= o.at ? 1 : 0;
  return interpolate(t, [o.at, o.at + o.dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: SWEEP_EASE,
  });
}

/**
 * The deselect: the highlight's left edge running out to meet its right one.
 *
 * Nine frames, and **linear to within 6% of the travel** — 0.109, 0.233, 0.400,
 * 0.567, 0.691, 0.778, 0.851 against a straight line's 0.22, 0.33, 0.44, 0.55,
 * 0.67, 0.78, 0.89. No named curve does meaningfully better over nine frames,
 * and nothing about it reads as an ease. The selection is simply dropped.
 */
export function deselect(t: number, o: { at: number; dur: number }): number {
  if (o.dur <= 0) return t >= o.at ? 1 : 0;
  return interpolate(t, [o.at, o.at + o.dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/**
 * The forward move, as a scale.
 *
 * On the reference this is a **cut**: 188px of ink on one frame and 453px on the
 * next, with nothing in between anywhere in the recording. `zoomDuration={0}`
 * is that exactly.
 *
 * It is not the default. At 30fps a step in scale does not read as *coming
 * forward*, it reads as an edit — so the default is a short ramp on a moderate
 * decelerate, pivoted on the measured baseline because the rasteriser gives
 * glyph origins no vertical sub-pixel precision and any pivot that moves the
 * baseline makes the type climb the grid in whole-pixel jumps.
 */
export function zoomScale(
  t: number,
  o: { at: number; dur: number; to: number },
): number {
  if (o.dur <= 0) return t >= o.at ? o.to : 1;
  return interpolate(t, [o.at, o.at + o.dur], [1, o.to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.2, 0.6, 0.35, 1),
  });
}

/** The sheen as a CSS gradient, in `color` at `alpha` times each stop. */
export function sheenGradient(
  color: string,
  alpha: number,
  angle: number,
  stops: readonly (readonly [number, number])[] = SHEEN,
): string {
  const list = stops
    .map(
      ([u, k]) =>
        `${withAlpha(color, Math.min(1, alpha * k))} ${(u * 100).toFixed(1)}%`,
    )
    .join(", ");
  return `linear-gradient(${angle}deg, ${list})`;
}

// --- Props -----------------------------------------------------------------

export interface TextRewriteProps {
  /** The line that writes itself, one word at a time. */
  headline?: string;
  /**
   * How many words off the end of `headline` survive the erase. The rest are
   * swept away from the left, and `append` is typed onto what is left.
   */
  keep?: number;
  /** What gets written onto the surviving words. Empty leaves them alone. */
  append?: string;

  /** Seconds at which the mark appears, ahead of the first word. */
  markAt?: number;
  /** Seconds at which the first word lands. */
  wordAt?: number;
  /** Seconds between words — also how long a word holds the accent. */
  wordStagger?: number;
  /** How long a word takes to fade up and open the line. */
  wordDuration?: number;
  /** How long a word holds the accent before it starts cooling. */
  coolDelay?: number;
  /** How long the accent takes to become the foreground. */
  coolDuration?: number;

  /** Seconds at which the line comes forward. */
  cutAt?: number;
  /** How long the forward move takes. 0 is the reference's single-frame cut. */
  zoomDuration?: number;
  /** How far forward it goes. */
  zoom?: number;

  /** Seconds at which the selection starts being dragged across. */
  dragAt?: number;
  /** How long the drag takes. */
  dragDuration?: number;
  /** Seconds at which the erase starts eating the line from the left. */
  eraseAt?: number;
  /** How long the erase takes. */
  eraseDuration?: number;
  /** Seconds at which `append` starts being written on. */
  rewriteAt?: number;
  /** How long the rewrite takes. */
  rewriteDuration?: number;
  /** Seconds at which the selection is dropped. */
  deselectAt?: number;
  /** How long the deselect takes. */
  deselectDuration?: number;

  /** Type size before the forward move, in stage px. */
  fontSize?: number;
  /** Weight of the line. Inter ships 400/500/600 here. */
  fontWeight?: number;
  /** Where the line sits down the frame, as a fraction. */
  centerY?: number;
  /** Letter-spacing, in em. */
  tracking?: number;
  /** Word-spacing, in em. */
  wordGap?: number;

  /** Base strength of the selection, before the sheen multiplies it. */
  selectionOpacity?: number;
  /** Angle of the sheen. 90 is the reference's — straight across. */
  selectionAngle?: number;
  /** Override the sheen shape: `[position, × base alpha]` pairs. */
  selectionSheen?: readonly (readonly [number, number])[];
  /** How far the selection reaches past the type on an unclipped end, in em. */
  selectionPad?: number;

  /** The mark that trails the line, as a path in a `0 0 100 100` box. */
  markPath?: string;
  /** Its colour, if it should differ from the accent. */
  markColor?: string;
  /** Its height, in em. 0 leaves the line bare. */
  markSize?: number;

  /** The soft wash behind the line. */
  glow?: boolean;
  /** Colour of the wash, if it should differ from the accent. */
  glowColor?: string;
  /** Strength of the wash. */
  glowOpacity?: number;

  /** The colour a word arrives in, and the colour the sheen is painted from. */
  accentColor?: string;
  /** Token overrides. */
  theme?: Partial<SnapCnTheme>;
  /** Which token set to resolve against. */
  mode?: "light" | "dark";
  /**
   * The face this scene paints its words in — a label from `fonts.ts`
   * ("Inter", "Space Grotesk", "Instrument Serif") or a CSS family you have
   * loaded yourself. Unset, the scene keeps the face it was designed around.
   *
   * Overrides `theme.fontFamily`, which is how a brand kit re-skins a whole
   * timeline from one value.
   */
  fontFamily?: string;
  /** Multiplies the frame clock. */
  speed?: number;
}

/**
 * A line that writes itself, is selected, has its opening swept away and a new
 * ending written on — the gesture of a claim being corrected in front of you.
 *
 * Everything here came off the recording frame by frame. The three things worth
 * knowing before you change anything:
 *
 * 1. **The erase is a clip, not a deletion.** Letters are cut in half by a
 *    vertical edge as it passes — "Or" becomes ")r" becomes "r" — and the words
 *    that survive never move. A word-by-word delete would have re-laid the line
 *    out on every step, and the recording plainly does not.
 * 2. **The rewrite is the same edge run the other way**, over a line that is
 *    sliding to its new centre at the same time. Fitted separately, the slide
 *    and the reveal land on one shared progress to within 0.001.
 * 3. **The mark rides the edge**, not the end of the line — it sits `0.4em`
 *    clear of the last *visible* letter through all of it, which is what keeps
 *    the gesture reading as one object rather than a line and a decoration.
 */
export function TextRewrite({
  headline = "Or just add snapcn",
  keep = 1,
  append = "registry",

  markAt = 0.117,
  wordAt = 0.217,
  wordStagger = 0.189,
  wordDuration = 0.085,
  coolDelay = 0.189,
  coolDuration = 0.189,

  cutAt = 1.033,
  zoomDuration = 0,
  zoom = 2.41,

  dragAt = 1.033,
  dragDuration = 0.2,
  eraseAt = 1.45,
  eraseDuration = 0.517,
  rewriteAt = 2.0,
  rewriteDuration = 0.533,
  deselectAt = 2.85,
  deselectDuration = 0.15,

  fontSize = 20,
  fontWeight = 500,
  centerY = 0.4902,
  tracking = TRACKING,
  wordGap = WORD_GAP,

  selectionOpacity = 0.21,
  selectionAngle = 90,
  selectionSheen = SHEEN,
  selectionPad = SEL_PAD,

  markPath = MARK_PATH,
  markColor,
  markSize = MARK_SIZE,

  glow = true,
  glowColor,
  glowOpacity = 0.075,

  accentColor,
  theme,
  mode,
  fontFamily,
  speed = 1,
}: TextRewriteProps) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily ?? t.fontFamily) ?? SANS;
  const accent = accentColor ?? t.primary;
  const wash = glowColor ?? accent;
  const mark = markColor ?? accent;

  const now = (frame * speed) / fps;
  const stageScale = Math.min(width / REF_W, height / REF_H);
  const words = headline.split(/\s+/).filter(Boolean);
  const kept = Math.max(0, Math.min(words.length, Math.round(keep)));
  const cut = words.length - kept;
  const lineHeight = Math.round(fontSize * 1.35);

  // --- measurement -------------------------------------------------------
  //
  // Every position below is arithmetic on real widths, because the gesture
  // needs geometry the flow cannot give it: where the surviving words sat in
  // the *old* layout, how far a clip has to travel to reach them, and where the
  // mark goes when the last visible letter is halfway through being eaten. A
  // canvas ruler is no use — it knows nothing about CSS tracking or
  // word-spacing — so the widths come from a hidden copy of the real line.
  const probeRef = useRef<HTMLSpanElement>(null);
  const baselineRef = useRef<HTMLSpanElement>(null);
  const [handle] = useState(() => delayRender("text-rewrite: measure line"));
  const [m, setM] = useState<{
    word: number[];
    space: number;
    append: number;
    baseline: number;
  } | null>(null);

  useEffect(() => {
    const probe = probeRef.current;
    if (!probe) {
      continueRender(handle);
      return;
    }
    const parts = Array.from(probe.querySelectorAll<HTMLElement>("[data-w]"));
    const word = parts
      .filter((p) => p.dataset.w === "word")
      .map((p) => p.offsetWidth);
    const space =
      parts.find((p) => p.dataset.w === "space")?.offsetWidth ??
      fontSize * 0.28;
    const app = parts.find((p) => p.dataset.w === "append")?.offsetWidth ?? 0;
    setM({
      word,
      space,
      append: app,
      baseline: baselineRef.current?.offsetTop ?? lineHeight * 0.8,
    });
  }, [handle, fontSize, lineHeight]);

  useEffect(() => {
    if (m) continueRender(handle);
  }, [m, handle]);

  const W = m?.word ?? words.map((w) => w.length * fontSize * 0.5);
  const SP = m?.space ?? fontSize * 0.28;
  const APP = m?.append ?? append.length * fontSize * 0.5;
  const baseline = m?.baseline ?? lineHeight * 0.8;

  /** Left edge of word `i` inside the line, and the line's width at `n` words. */
  const offset = (i: number) => W.slice(0, i).reduce((a, b) => a + b + SP, 0);
  const runWidth = (n: number) => (n <= 0 ? 0 : offset(n) - SP);

  // --- timeline ----------------------------------------------------------
  const pad = fontSize * selectionPad;
  const gap = fontSize * MARK_GAP;
  const markW = fontSize * markSize;
  const tail = markPath ? gap + markW : 0;

  const { count, grow } = landed(now, words.length, {
    at: wordAt,
    stagger: wordStagger,
    dur: wordDuration,
  });
  const drag = dragIn(now, { at: dragAt, dur: dragDuration });
  const erase = sweep(now, { at: eraseAt, dur: eraseDuration });
  const write = sweep(now, { at: rewriteAt, dur: rewriteDuration });
  const drop = deselect(now, { at: deselectAt, dur: deselectDuration });
  const scale = zoomScale(now, { at: cutAt, dur: zoomDuration, to: zoom });

  // Phase 1–2 layout. The line's *centring* width tweens around a fixed centre
  // as each word opens it — measured, the ink's centre never leaves 404 of 810
  // while its ends move ±34 over five frames. The word itself is drawn at full
  // width from its first frame and fades: on the reference it lands whole and
  // pale, overlapping the mark, and the mark slides clear over the next four
  // frames. Nothing is ever clipped while the line is being written.
  const opening = count > 0 ? (count > 1 ? SP : 0) + (W[count - 1] ?? 0) : 0;
  const grown = runWidth(Math.max(0, count - 1)) + opening * grow;
  const drawn = runWidth(count);
  const full = runWidth(words.length);

  // Layout A: the opening line, centred. Layout B: what it is rewritten into.
  const aLeft = REF_W / 2 - (full + tail) / 2;
  const keptLeft = aLeft + offset(cut);
  const keptWidth = full - offset(cut);
  const newWidth = keptWidth + (append ? SP + APP : 0);
  const bLeft = REF_W / 2 - (newWidth + tail) / 2;

  // Before the rewrite the line sits where it was written; after it, where its
  // new content belongs. Fitted separately, the slide and the reveal land on
  // one shared progress to within 0.001 of the travel.
  const rewriting = write > 0;
  const left = rewriting
    ? keptLeft + (bLeft - keptLeft) * write
    : REF_W / 2 - (grown + tail) / 2;

  // The clip window. Its left edge is the erase, its right edge the rewrite —
  // and nothing else touches it, which is why a letter gets cut in half by the
  // edge instead of being deleted and re-laid-out.
  const k0 = rewriting ? left : left + offset(cut) * erase;
  const k1 = rewriting
    ? left + keptWidth + (append ? SP + APP : 0) * write
    : left + drawn;

  // The selection is its own rectangle, not a lining inside the window: the
  // drag sweeps it across a line that is entirely visible the whole time, and
  // the deselect runs its left edge out to meet its right one over a line the
  // clip has finished with.
  const selFrom = erase > 0 || rewriting ? k0 : left - pad;
  const selTo = rewriting ? k1 : left + drawn + pad;
  const s1 = selFrom + (selTo - selFrom) * drag;
  const s0 = selFrom + (s1 - selFrom) * drop;
  const selShown = drag > 0 && drop < 1;

  // The mark rides the end of what is *visible*, not the end of the line.
  const markX = rewriting ? k1 : left + grown;

  // A cut has no in-between frame to judder on, so it pivots on the line's
  // optical centre — which is what the reference does: its small line and its
  // full-size line share a centre at y 224 of 458, not a baseline. A *ramp*
  // does have in-between frames, and there the pivot has to be the measured
  // baseline: the rasteriser gives glyph origins no vertical sub-pixel
  // precision, so any pivot that moves the baseline makes the type climb the
  // pixel grid in whole-pixel jumps.
  const pivot = zoomDuration > 0 ? `${baseline}px` : "50%";

  const isRendering = getRemotionEnvironment().isRendering;
  const moving = now > cutAt && now < cutAt + zoomDuration;
  const willChange =
    !isRendering && moving ? ("transform" as const) : undefined;

  const boxTop = centerY * REF_H - lineHeight / 2;
  const textStyle = {
    fontFamily: face,
    fontSize,
    fontWeight,
    lineHeight: `${lineHeight}px`,
    letterSpacing: `${tracking}em`,
    wordSpacing: `${wordGap}em`,
    whiteSpace: "pre" as const,
    // Hinting bends each glyph so its stems land on whole pixels, so as the size
    // slides every stem re-snaps and the letterforms boil. This draws the
    // outline as it actually is.
    textRendering: "geometricPrecision" as const,
  };

  return (
    <AbsoluteFill style={{ background: t.background }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: REF_W,
          height: REF_H,
          transform: `translate(-50%, -50%) scale(${stageScale})`,
          overflow: "hidden",
        }}
      >
        {glow ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(46% 34% at 50% ${centerY * 100}%, ${withAlpha(wash, glowOpacity)} 0%, ${withAlpha(wash, 0)} 100%)`,
            }}
          />
        ) : null}

        {/* The ruler. Hidden, laid out once, read for the widths the geometry
            above is built from — and for the baseline, which is never guessed
            from a line-height ratio. */}
        <span
          ref={probeRef}
          aria-hidden
          style={{
            ...textStyle,
            position: "absolute",
            left: 0,
            top: 0,
            visibility: "hidden",
            pointerEvents: "none",
          }}
        >
          {words.map((word, i) => (
            <span data-w="word" key={`${word}-${i}`}>
              {word}
            </span>
          ))}
          <span data-w="space"> </span>
          <span data-w="append">{append}</span>
          <span
            ref={baselineRef}
            style={{ display: "inline-block", width: 0, height: 0 }}
          />
        </span>

        {/* The line, its selection and its mark in one group, so the forward
            move carries all three. The scale is pivoted on the measured
            baseline: the rasteriser gives glyph origins no vertical sub-pixel
            precision, so any pivot that moves the baseline makes the type climb
            the pixel grid in whole-pixel jumps. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: boxTop,
            height: lineHeight,
            transform: `scale(${scale})`,
            transformOrigin: `50% ${pivot}`,
            willChange,
          }}
        >
          {/* The selection. Its own rectangle, outside the window, because it
              is painted over a line the window is not yet touching. */}
          {selShown ? (
            <div
              style={{
                position: "absolute",
                left: s0,
                top: baseline + fontSize * SEL_BELOW - fontSize * SEL_HEIGHT,
                width: Math.max(0, s1 - s0),
                height: fontSize * SEL_HEIGHT,
                background: sheenGradient(
                  accent,
                  selectionOpacity,
                  selectionAngle,
                  selectionSheen,
                ),
              }}
            />
          ) : null}

          {/* The window. `overflow: hidden` is the erase and the rewrite both —
              the text inside never moves relative to the line, so a letter is
              cut in half by the edge rather than removed. */}
          <div
            style={{
              position: "absolute",
              left: k0,
              top: 0,
              width: Math.max(0, k1 - k0),
              height: lineHeight,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                ...textStyle,
                position: "absolute",
                left: left - k0,
                top: 0,
                width: "max-content",
              }}
            >
              {(rewriting
                ? [...words.slice(cut), ...(append ? [append] : [])]
                : words.slice(0, count)
              ).map((word, i) => {
                const idx = rewriting ? cut + i : i;
                const ink = wordInk(now, idx, {
                  at: wordAt,
                  stagger: wordStagger,
                  dur: wordDuration,
                  coolDelay,
                  coolDur: coolDuration,
                  dragAt,
                  dragDur: dragDuration,
                  last: idx === words.length - 1,
                });
                return (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: words repeat, so the index is what makes each key unique
                    key={`${word}-${i}`}
                    style={{
                      color: rewriting
                        ? t.foreground
                        : mixOklch(accent, t.foreground, ink.cool),
                      opacity: rewriting ? 1 : ink.opacity,
                    }}
                  >
                    {i > 0 ? " " : null}
                    {word}
                  </span>
                );
              })}
            </div>
          </div>

          {/* The mark rides the window's right edge, not the end of the line. */}
          {markPath && now >= markAt ? (
            <svg
              viewBox="0 0 100 100"
              width={markW}
              height={markW}
              aria-hidden
              style={{
                position: "absolute",
                left: markX + gap,
                top: baseline - fontSize * MARK_RISE - markW / 2,
                overflow: "visible",
              }}
            >
              <path d={markPath} fill={mark} />
            </svg>
          ) : null}
        </div>
      </div>
    </AbsoluteFill>
  );
}

export default TextRewrite;
