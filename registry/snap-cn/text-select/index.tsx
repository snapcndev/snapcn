"use client";

import { loadFont as loadSans } from "@remotion/google-fonts/Inter";
import { Fragment, useEffect, useRef, useState } from "react";
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
// The reference recording is 810×458 — near enough 16:9 — and every number
// below was read off its frames, so there is no second conversion to get wrong.

const REF_W = 810;
const REF_H = 458;

// --- Measured proportions --------------------------------------------------

/** The line is set tight: a hair of negative tracking and tighter word gaps. */
const TRACKING = -0.012;
const WORD_GAP = -0.07;
/** Selection box: 0.941em tall, sitting 0.120em below the baseline. */
const SEL_HEIGHT = 0.941;
const SEL_BELOW = 0.12;
/** …and reaching 0.063em past the type on each side, as a caret's would. */
const SEL_PAD = 0.063;

/**
 * The sheen, read straight off the reference.
 *
 * The selection is **not a flat fill**. Sampled column by column with the glyphs
 * masked out, its blue deepens to a trough a third of the way across, opens into
 * a bright band at 59%, and closes again toward the right edge — a swing of 2.8×
 * in strength from the palest point to the deepest. Each pair is `[position,
 * multiple of the base alpha]`.
 *
 * It is anchored to the **box**, not to the page: through the whole drag the
 * bright band sits at 0.58 of whatever width the box has reached that frame
 * (measured: 0.584, 0.571, 0.580, 0.603, 0.585, 0.576, 0.589 …), which is what a
 * CSS gradient on a growing element does for free — and it is why the sheen
 * appears to travel while the selection is being pulled across.
 */
const SHEEN: readonly (readonly [number, number])[] = [
  [0, 0.72],
  [0.1, 0.95],
  [0.19, 1.12],
  [0.3, 1.42],
  [0.37, 1.44],
  [0.44, 1.22],
  [0.51, 0.78],
  [0.59, 0.51],
  [0.69, 0.74],
  [0.78, 0.88],
  [0.89, 1.05],
  [1, 1.2],
];

// --- Measured timeline, in seconds -----------------------------------------

/** A word lands every 208ms, and each one resolves in 130ms. */
const WORD_STAGGER = 0.208;
const WORD_DUR = 0.13;
/** The line arrives from 0.475em to the right on every word, and settles. */
const SHIFT_X = 0.475;
const SHIFT_Y = 0.085;
/** Barely a blur — 1px at 20px type. It softens the landing, nothing more. */
const WORD_BLUR = 1;
/** A word stays accent-coloured for one beat, then cools over another. */
const COOL_DELAY = 0.208;
const COOL_DUR = 0.208;

/** Fitted to the ink: half the distance in the first eighth of the move. */
const WORD_EASE = Easing.out(Easing.poly(4));
/** The drag. Harder still — it is a hand pulling a selection, not a tween. */
const SELECT_EASE = Easing.out(Easing.poly(5));
/**
 * The push forward.
 *
 * A *moderate* decelerate on purpose. Quint- and expo-out cover 99% of their
 * travel in the first third and then crawl, and on a frame clock that crawl is
 * not a settle, it is identical frames — measured elsewhere in this repo, five
 * of fourteen frames moved under half a pixel and the type visibly stopped dead
 * partway. This curve arrives at a standstill without spending frames on travel
 * you cannot see.
 */
const ZOOM_EASE = Easing.bezier(0.2, 0.6, 0.35, 1);

// --- Pure helpers (unit-tested) --------------------------------------------

export interface WordInk {
  /** 0 before its cue, 1 once it has landed. */
  opacity: number;
  /** How far through the accent → foreground cool-down it is. */
  cool: number;
  blur: number;
}

/**
 * One word's arrival and its cool-down.
 *
 * The entrance is a **fade**, not the scale-and-blur of a title reveal: measure
 * the ink and its second moment barely moves (11.87px → 11.79px rms), so there
 * is no scale worth the name and about a pixel of blur. What does move is the
 * whole line — see `lineShift`.
 *
 * The colour is the other half. A word arrives in the accent, holds it for one
 * beat while it is the newest thing on the line, and cools to the foreground
 * over the next — which is what makes the eye follow the line left to right
 * instead of reading it all at once.
 */
export function wordInk(
  t: number,
  index: number,
  o: {
    at: number;
    stagger: number;
    dur: number;
    coolDelay: number;
    coolDur: number;
    blur: number;
    /** Set on the last word: it cools on the drag, not on a word that never comes. */
    selectAt?: number;
    selectDur?: number;
  },
): WordInk {
  const cue = o.at + index * o.stagger;
  if (t < cue) return { opacity: 0, cool: 0, blur: o.blur };
  const p = interpolate(t, [cue, cue + o.dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: WORD_EASE,
  });
  // Every word cools one beat after it lands — one beat being exactly the
  // stagger, so the accent walks the line. The last word has no next word to
  // hand off to, and on the reference it cools as the selection is dragged
  // across, in half the time the drag takes.
  const usesDrag = o.selectAt !== undefined && o.selectAt > cue;
  const coolFrom = usesDrag ? (o.selectAt as number) : cue + o.coolDelay;
  const coolOver = usesDrag ? (o.selectDur as number) / 2 : o.coolDur;
  const cool = interpolate(t, [coolFrom, coolFrom + coolOver], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { opacity: p, cool, blur: o.blur * (1 - p) };
}

/**
 * How far right the whole line still is, in em.
 *
 * This is the measurement that took the longest to see. When the second word
 * lands, the first one moves — but so does the second, by the *same* 10px, and
 * a line that grew a word would not do that. It is not the layout re-centring
 * and it is not the new word widening into place: the entire line arrives half
 * an em to the right on every word and settles back, which reads as the line
 * being nudged along rather than stretched.
 */
export function lineShift(
  t: number,
  words: number,
  o: { at: number; stagger: number; dur: number },
): number {
  if (t < o.at) return 1;
  const landed = Math.min(words - 1, Math.floor((t - o.at) / o.stagger));
  const cue = o.at + landed * o.stagger;
  return (
    1 -
    interpolate(t, [cue, cue + o.dur], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: WORD_EASE,
    })
  );
}

/**
 * The push forward, as a scale.
 *
 * On the reference this is a **cut**: 215px of ink on one frame and 516px on the
 * next, with the single dropped frame between them the only place an in-between
 * could have hidden. Set `dur` to 0 and you get that exactly.
 *
 * It defaults to a ramp because a cut is the one thing a 30fps composition
 * cannot make read as *coming forward* — at that frame rate a step reads as an
 * edit, not a move. The ramp is a moderate decelerate for the reason in
 * `ZOOM_EASE`, and it is a **transform**, never an animated `font-size`:
 * font-size reflows every frame *and* still hits glyph snapping.
 */
export function zoomScale(
  t: number,
  o: { at: number; dur: number; to: number },
): number {
  if (o.dur <= 0) return t >= o.at ? o.to : 1;
  return interpolate(t, [o.at, o.at + o.dur], [1, o.to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ZOOM_EASE,
  });
}

/**
 * The selection, as a fraction of the line it has covered.
 *
 * A drag, not a wipe: it is 31% across in the first frame and spends the back
 * half of its time covering the last 5%. Fitted to the sweep edge on fourteen
 * frames, `easeOutQuint` over 220ms is what that is.
 */
export function selectionSweep(
  t: number,
  o: { at: number; dur: number },
): number {
  return interpolate(t, [o.at, o.at + o.dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: SELECT_EASE,
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

/**
 * Where the travelling glint sits, as a fraction of the selection box — or
 * `null` on the frames between passes.
 *
 * The sheen above is *anchored* to the box: it stretches as the box grows,
 * which is what the reference does, and it is the right description of a
 * selection being pulled across. But it stops the instant the drag lands, and a
 * highlight that stops moving stops shining. So a second, narrow band is swept
 * across the finished box on its own clock.
 *
 * It travels **linearly**. A specular is a light source passing a surface, not
 * something that settles, and a constant velocity is also the only curve that
 * cannot spend frames on travel too small to rasterise: at the defaults the
 * band covers 58px a frame from the first frame to the last.
 *
 * The range is `[-width/2, 1 + width/2]` so the band enters from off the left
 * edge and leaves off the right, rather than being born and dying inside the
 * box.
 */
export function shineSweep(
  t: number,
  o: { at: number; dur: number; every: number; width: number },
): number | null {
  if (o.dur <= 0 || t < o.at) return null;
  const since = t - o.at;
  const u = (o.every > 0 ? since % o.every : since) / o.dur;
  if (u > 1) return null;
  return -o.width / 2 + u * (1 + o.width);
}

/**
 * The glint as a CSS gradient: a soft band centred on `pos`, `width` wide.
 *
 * It is **not** just a light band. A white band over a light page has almost no
 * room to work in — measured on the render, white at 0.34 over a fill sitting at
 * R 230 lifts it eight levels, against the static sheen's own ±15. The glint was
 * quieter than the gradient it was supposed to be shining on.
 *
 * So it is shaped like a real specular on a coloured gel: a bright core with
 * **deepened shoulders** either side, where the light compresses the film. The
 * shoulders are painted in the selection's own colour, and there is plenty of
 * room downward — the same measurement gives them −17. A 25-level band, moving.
 *
 * The ends are at **zero alpha of a real colour**, never the keyword
 * `transparent` — `transparent` is `rgba(0,0,0,0)`, so a gradient running to it
 * fades through black and leaves a grey bruise on either side of the band.
 */
export function shineGradient(o: {
  /** The light itself, at the centre of the band. */
  core: string;
  /** What the shoulders deepen with — the selection's own colour. */
  shoulder: string;
  /** Strength of the core. */
  alpha: number;
  /** Strength of the shoulders, as a fraction of the core's. */
  depth: number;
  /** Centre of the band, as a fraction of the box. */
  pos: number;
  /** Width of the band, as a fraction of the box. */
  width: number;
  angle: number;
}): string {
  const half = o.width / 2;
  const at = (x: number) => `${(x * 100).toFixed(1)}%`;
  const edge = Math.min(1, o.alpha * o.depth);
  const s0 = withAlpha(o.shoulder, 0);
  const s1 = withAlpha(o.shoulder, edge);
  return (
    `linear-gradient(${o.angle}deg, ${s0} ${at(o.pos - half)}, ` +
    `${s1} ${at(o.pos - half * 0.55)}, ` +
    `${withAlpha(o.core, Math.min(1, o.alpha))} ${at(o.pos)}, ` +
    `${s1} ${at(o.pos + half * 0.55)}, ${s0} ${at(o.pos + half)})`
  );
}

// --- Props -----------------------------------------------------------------

export interface TextSelectProps {
  /** The line that writes itself, one word at a time. */
  headline?: string;

  // --- Timing, in seconds. ---
  /** When the first word lands, and the gap between words. */
  wordAt?: number;
  wordStagger?: number;
  /** How long a word takes to resolve. */
  wordDuration?: number;
  /** How far right the line arrives on each word, and how far down, in em. */
  shiftX?: number;
  shiftY?: number;
  /** How soft a word arrives, in px at `fontSize`. */
  wordBlur?: number;
  /** How long a word holds the accent, and how long it takes to cool. */
  coolDelay?: number;
  coolDuration?: number;
  /** When the line starts coming forward, how long it takes, and how far. */
  cutAt?: number;
  zoomDuration?: number;
  zoom?: number;
  /** When the selection is dragged across, and how long the drag takes. */
  selectAt?: number;
  selectDuration?: number;

  // --- Size and paint. ---
  /** Type size before the push, in stage px. */
  fontSize?: number;
  fontWeight?: number;
  /** Where the line's box sits down the frame, as a fraction. */
  centerY?: number;
  /** Tracking and word gap, in em. */
  tracking?: number;
  wordGap?: number;
  /** Base strength of the selection, before the sheen multiplies it. */
  selectionOpacity?: number;
  /** Angle of the sheen. 90 is the reference's — straight across. */
  selectionAngle?: number;
  /** Override the sheen shape entirely: `[position, × base alpha]` pairs. */
  selectionSheen?: readonly (readonly [number, number])[];
  /** How far the selection reaches past the type on each side, in em. */
  selectionPad?: number;
  /** The travelling glint's colour. Light, not accent — a specular adds. */
  shineColor?: string;
  /** How strong the glint's core is. 0 turns the whole thing off. */
  shineOpacity?: number;
  /** How hard the shoulders either side deepen, as a fraction of the core. */
  shineDepth?: number;
  /** How wide the glint is, as a fraction of the selection. */
  shineWidth?: number;
  /** Seconds at which the first pass starts. Defaults to the drag landing. */
  shineAt?: number;
  /** How long one pass takes to cross. */
  shineDuration?: number;
  /** Seconds between passes. 0 shines once and stops. */
  shineEvery?: number;
  /** The soft wash behind the line. */
  glow?: boolean;
  glowColor?: string;
  glowOpacity?: number;
  /** The colour a word arrives in, before it cools. Defaults to `theme.primary`. */
  accentColor?: string;
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
  speed?: number;
}

// --- Main composition ------------------------------------------------------

/**
 * A line that writes itself a word at a time, comes forward, and gets selected —
 * the beat before somebody copies it.
 *
 * ## Four measurements, and they are the component
 *
 * **The newest word is the accent.** Every word arrives in the accent colour,
 * holds it for exactly one beat — 208ms, the same as the stagger — and cools to
 * the foreground over the next. So there is always exactly one coloured word,
 * and it walks the line ahead of the reader.
 *
 * **The whole line arrives half an em to the right on every word**, not just the
 * new one. Both words move by the same ten pixels when the second lands, which a
 * line that had merely grown a word would not do.
 *
 * **The selection is a drag.** It is 31% across on its first frame and spends the
 * back half of its time on the last 5% — `easeOutQuint` over 220ms, fitted to the
 * sweep edge across fourteen frames — and it has a hard vertical right edge,
 * because that is what a caret dragging through text leaves behind.
 *
 * **And the selection is not a flat fill.** Sample it column by column with the
 * glyphs masked out and the blue deepens to a trough a third of the way across,
 * opens into a bright band at 59%, and closes again at the right edge: a 2.8×
 * swing. The band is anchored to the *box*, so it sits at 0.58 of whatever width
 * the selection has reached on every frame of the drag — which is why it reads as
 * a shine travelling ahead of the caret.
 *
 * ## The one place this departs from the reference
 *
 * On the recording the size change is a **cut** — 215px of ink on one frame and
 * 516px on the next, with a single dropped frame the only place an in-between
 * could have hidden. Here it defaults to a 420ms push instead, because at 30fps a
 * step reads as an edit rather than as the line coming forward. `zoomDuration={0}`
 * gives you the measured cut back.
 *
 * Because it is a push, it is a **transform pivoted on the baseline**, measured
 * off the font's real metrics rather than guessed from a line-height ratio. That
 * is not a detail: the rasteriser gives glyph origins no vertical sub-pixel
 * precision at all, so a scale that moves the baseline makes the type climb the
 * pixel grid in whole-pixel jumps — sit still, jump, sit still. Pivot on the
 * baseline and there is nothing to snap. `text-rendering: geometricPrecision`
 * turns hinting off for the same reason: hinting re-snaps every stem as the size
 * slides, and the letterforms boil.
 *
 * ## What is not measured
 *
 * The colours and the wording. The reference is a specific product with a
 * specific blue; none of that belongs in a component that ships to strangers
 * (design-system rule 5). The paint is the shadcn token set, the accent and the
 * selection are `theme.primary` unless you say otherwise, and the line is a prop.
 */
export function TextSelect({
  headline = "One command into your project.",
  wordAt = 0.066,
  wordStagger = WORD_STAGGER,
  wordDuration = WORD_DUR,
  shiftX = SHIFT_X,
  shiftY = SHIFT_Y,
  wordBlur = WORD_BLUR,
  coolDelay = COOL_DELAY,
  coolDuration = COOL_DUR,
  cutAt = 1.13,
  zoomDuration = 0.42,
  zoom = 2.39,
  selectAt = 1.4,
  selectDuration = 0.26,
  fontSize = 20,
  fontWeight = 500,
  centerY = 0.5116,
  tracking = TRACKING,
  wordGap = WORD_GAP,
  selectionOpacity = 0.207,
  selectionAngle = 90,
  selectionSheen = SHEEN,
  selectionPad = SEL_PAD,
  shineColor = "#ffffff",
  shineOpacity = 0.5,
  shineDepth = 0.55,
  shineWidth = 0.3,
  shineAt,
  shineDuration = 0.62,
  shineEvery = 1.1,
  glow = true,
  glowColor,
  glowOpacity = 0.075,
  accentColor,
  theme,
  mode,
  speed = 1,
}: TextSelectProps) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const accent = accentColor ?? t.primary;
  const wash = glowColor ?? accent;

  const now = (frame * speed) / fps;
  const stageScale = Math.min(width / REF_W, height / REF_H);
  const words = headline.split(/\s+/).filter(Boolean);
  const lineHeight = fontSize * 1.2;

  // --- measure, once, behind delayRender ----------------------------------
  //
  // A hidden probe carries the *whole* line at the base size, so its width is
  // the real rendered width — tracking, word-spacing and kerning included. That
  // is a measurement `measureText` on a canvas cannot give: it knows nothing
  // about CSS letter-spacing or word-spacing, and sizing the selection from it
  // draws the box to a width the line does not have.
  //
  // The zero-sized inline-block inside it sits with its bottom edge on the text
  // baseline, so its `offsetTop` reads the baseline off the font's real metrics.
  const probeRef = useRef<HTMLSpanElement>(null);
  const baselineRef = useRef<HTMLSpanElement>(null);
  const [handle] = useState(() => delayRender("text-select: measure line"));
  const [metrics, setMetrics] = useState<{
    lineWidth: number;
    baseline: number;
  } | null>(null);

  useEffect(() => {
    const probe = probeRef.current;
    if (!probe) {
      continueRender(handle);
      return;
    }
    setMetrics({
      lineWidth: probe.offsetWidth,
      baseline: baselineRef.current?.offsetTop ?? lineHeight * 0.8,
    });
  }, [handle, lineHeight]);

  // Release the render only once the measurement has re-rendered, so the very
  // first captured frame already carries the correct geometry.
  useEffect(() => {
    if (metrics) continueRender(handle);
  }, [metrics, handle]);

  const lineWidth = metrics?.lineWidth ?? headline.length * fontSize * 0.5;
  const baseline = metrics?.baseline ?? lineHeight * 0.8;
  const boxTop = centerY * REF_H - lineHeight / 2;

  // --- timeline -----------------------------------------------------------
  const shift = lineShift(now, words.length, {
    at: wordAt,
    stagger: wordStagger,
    dur: wordDuration,
  });
  const scale = zoomScale(now, { at: cutAt, dur: zoomDuration, to: zoom });
  const sweep = selectionSweep(now, { at: selectAt, dur: selectDuration });

  const pad = fontSize * selectionPad;
  const selWidth = (lineWidth + pad * 2) * sweep;

  // The glint runs on the finished box by default — during the drag the sheen
  // is already travelling, because a gradient painted on a growing element
  // travels for free, and two moving highlights at once is a busy frame.
  const shinePos = shineSweep(now, {
    at: shineAt ?? selectAt + selectDuration,
    dur: shineDuration,
    every: shineEvery,
    width: shineWidth,
  });

  // `will-change` hands the scale to the compositor, which resamples a bitmap
  // instead of re-rasterising real type. That is the right trade in the Player
  // (one tab, an 8ms budget) and the wrong one in a render (parallel tabs, each
  // inheriting a stale raster). And it is only worth paying *while the push is
  // running* — hold the line at 2.39× under a promoted layer and you are looking
  // at a 20px raster blown up.
  const isRendering = getRemotionEnvironment().isRendering;
  const pushing = now > cutAt && now < cutAt + zoomDuration;
  const willChange =
    !isRendering && pushing ? ("transform" as const) : undefined;

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
          background: t.background,
        }}
      >
        {/* The wash. Static — it does not move, breathe or answer the push on
            the reference, and a glow that animates under a headline reads as a
            mistake rather than as light. It sits outside the scaled group
            because it belongs to the page, not to the line. */}
        {glow ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(${0.46 * REF_W}px ${0.36 * REF_H}px at 50% ${centerY * 100}%, ${withAlpha(wash, glowOpacity)} 0%, transparent 74%)`,
            }}
          />
        ) : null}

        {/* The hidden ruler: the full line at the base size, laid out but never
            painted, so the width and the baseline are the real ones. */}
        <span
          ref={probeRef}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            visibility: "hidden",
            whiteSpace: "pre",
            fontFamily: SANS,
            fontSize,
            fontWeight,
            lineHeight: `${lineHeight}px`,
            letterSpacing: `${tracking}em`,
            wordSpacing: `${wordGap}em`,
          }}
        >
          {headline}
          <span
            style={{ display: "inline-block", width: 0, height: 0 }}
            ref={baselineRef}
          />
        </span>

        {/* The line and its selection, in one group so the push moves both.
            The scale is pivoted on the **baseline**: the rasteriser gives glyph
            origins no vertical sub-pixel precision, so any pivot that moves the
            baseline makes the type climb the pixel grid in whole-pixel jumps. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: boxTop,
            height: lineHeight,
            transform: `translate(${shift * fontSize * shiftX}px, ${shift * fontSize * shiftY}px) scale(${scale})`,
            transformOrigin: `50% ${baseline}px`,
            willChange,
          }}
        >
          {/* The selection, behind the type. A hard right edge and no rounding:
              this is a caret's drag, not a marker pen. The gradient is painted
              on the box itself, so it stretches as the box grows — which is what
              puts the sheen at 0.58 of the current width on every frame. */}
          {sweep > 0 ? (
            <div
              style={{
                position: "absolute",
                left: REF_W / 2 - lineWidth / 2 - pad,
                top: baseline + fontSize * SEL_BELOW - fontSize * SEL_HEIGHT,
                width: selWidth,
                height: fontSize * SEL_HEIGHT,
                // Two layers, glint first: CSS paints background layers
                // front to back, so the specular sits over the fill rather
                // than replacing it.
                background: [
                  shinePos === null || shineOpacity <= 0
                    ? null
                    : shineGradient({
                        core: shineColor,
                        shoulder: accent,
                        alpha: shineOpacity,
                        depth: shineDepth,
                        pos: shinePos,
                        width: shineWidth,
                        angle: selectionAngle,
                      }),
                  sheenGradient(
                    accent,
                    selectionOpacity,
                    selectionAngle,
                    selectionSheen,
                  ),
                ]
                  .filter(Boolean)
                  .join(", "),
              }}
            />
          ) : null}

          {/* The line. Only landed words are in the flow, so it grows and
              re-centres exactly as the reference's does. Normal flow, not flex:
              a flex container drops whitespace-only text nodes, so the spaces
              between the words would vanish and the line would render narrower
              than the ruler says it is. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              textAlign: "center",
              fontFamily: SANS,
              fontSize,
              fontWeight,
              lineHeight: `${lineHeight}px`,
              letterSpacing: `${tracking}em`,
              wordSpacing: `${wordGap}em`,
              whiteSpace: "pre",
              // Hinting bends each glyph so its stems land on whole pixels, so
              // as the size slides every stem re-snaps and the letterforms boil.
              // This turns it off and draws the outline as it actually is —
              // fifteen times steadier, measured on the shape invariant.
              textRendering: "geometricPrecision",
            }}
          >
            {words.map((word, i) => {
              const w = wordInk(now, i, {
                at: wordAt,
                stagger: wordStagger,
                dur: wordDuration,
                coolDelay,
                coolDur: coolDuration,
                blur: wordBlur,
                ...(i === words.length - 1
                  ? { selectAt, selectDur: selectDuration }
                  : {}),
              });
              if (w.opacity <= 0) return null;
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: words in a headline repeat, so the index is what makes each key unique
                <Fragment key={`${word}-${i}`}>
                  {i > 0 ? " " : null}
                  <span
                    style={{
                      display: "inline-block",
                      color: mixOklch(accent, t.foreground, w.cool),
                      opacity: w.opacity,
                      filter: w.blur > 0.02 ? `blur(${w.blur}px)` : undefined,
                    }}
                  >
                    {word}
                  </span>
                </Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}
