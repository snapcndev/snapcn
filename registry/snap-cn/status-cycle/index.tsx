"use client";

import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  getRemotionEnvironment,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  mixOklch,
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";

const { fontFamily: SANS } = loadInter("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

// ---------------------------------------------------------------------------
// Proportions
//
// Every constant below is a *fraction* of the composition, never a pixel, so
// the scene holds its shape at 720p, 1080p or a vertical crop. They were
// measured off a reference recording at 802x450 by sub-pixel edge integration
// and divided through; the comment on each names what was measured.
// ---------------------------------------------------------------------------

/**
 * Pill height as a multiple of the act-1 type size. Measured 44.21px against an
 * implied 39.2px em, both at 450.
 *
 * Keyed to the type rather than to the frame so that when a long status forces
 * the line to shrink, the pill shrinks with it instead of turning into a slab
 * with a small word floating in it.
 */
const PILL_H = 1.128;
/** Pill centre, as a fraction of frame height. The lockup rides 1.6% low. */
const PILL_CY = 0.5164;
/**
 * Corner radius as a fraction of the pill's own height.
 *
 * Not a stadium. Fitting a circle to the sub-pixel left edge over the pill's
 * top 12 rows gives R/h = 0.222–0.235 at rms 0.07–0.17px; R = h/2 fits the same
 * rows at rms 6.9–7.7px, two orders of magnitude worse. A stadium here reads as
 * a completely different object — it is the single easiest detail to get wrong.
 */
const PILL_R = 0.229;
/** Pill padding either side of the label, as a fraction of pill height. */
const PILL_PAD = 0.19;
/** Prefix-to-pill gap, as a fraction of pill height. Measured 6.5px of 44.2. */
const PILL_GAP = 0.147;
/** Act-1 type size, as a fraction of frame height. Cap 29px / 0.72em of 450. */
const ACT1_EM = 0.087;
/** Act-2 type size, as a fraction of frame height. Cap 72px / 0.72em of 450. */
const ACT2_EM = 0.222;
/** Chip padding, as a fraction of its own type size. */
const CHIP_PAD_X = 0.42;
const CHIP_PAD_Y = 0.165;
/** Chip corner radius and hairline, as fractions of chip height. */
const CHIP_R = 0.162;
const CHIP_BORDER = 0.017;
/** Chip margin from the frame edge, as a fraction of frame width. */
const CHIP_INSET = 0.04;
/** Share of the frame width the act-1 lockup may occupy before it is scaled. */
const ACT1_FIT = 0.92;
/** Gap between stacked chips, as a fraction of frame height. */
const CHIP_GAP = 0.057;

/**
 * The width morph is a **cubic-bezier, not a spring** — the `y2 > 1` control
 * value is the overshoot.
 *
 * This is not a stylistic preference. Fitting Remotion's `spring()` over a full
 * (damping, stiffness, rest) grid lands at rms 19.6px on a 207px travel, and the
 * failure is structural: a spring released from rest is at pi^2/242 = 4.1% of
 * travel one frame into an eleven-frame rise, and the reference is at 0.65%. No
 * triple is six times flatter at the start and still peaks that early. Fitted
 * per morph the reference gives (0.6,0,0.3,1.8) and (0.7,0.4,0.3,1.3); this is
 * their average, at rms 1.1–1.7% of travel.
 */
const WIDTH_EASE = Easing.bezier(0.65, 0.2, 0.3, 1.5);
/** Seconds the width morph runs. Measured 15 and 14 frames on a 24fps clock. */
const WIDTH_SECONDS = 0.6;

/**
 * The label roll: a symmetric ease-in-out, and the tightest fit in the scene.
 * Measured progress at its eight frames is 0.010, 0.053, 0.164, 0.499, 0.833,
 * 0.946, 0.990, 1.000 — dead on 50% at the halfway frame, rms 0.08px on a 48px
 * move.
 */
const ROLL_EASE = Easing.bezier(0.75, 0, 0.25, 1);
/** Seconds the roll runs. Measured 8 frames on a 24fps clock, all three swaps. */
const ROLL_SECONDS = 1 / 3;
/** Roll travel, as a multiple of pill height. Measured 47.1px on a 46.2 pill. */
const ROLL_TRAVEL = 1.02;

/** Seconds the green-to-cream crossfade takes. Measured 18 frames of 60fps. */
const FADE_SECONDS = 0.3;
/** Seconds the lockup takes to leave upward. Measured 0.19s, exponential. */
const EXIT_SECONDS = 0.2;
/** Time constant of the act-2 scroll step, in seconds. Fitted 1-exp(-t/tau). */
const SCROLL_TAU = 0.06;

/**
 * The per-letter intro scale.
 *
 * Measured peak is 1.45x the settled size, and a spring's overshoot is
 * `exp(-pi*zeta/sqrt(1-zeta^2))` — so zeta = 0.25, which at stiffness 100 and
 * mass 1 is damping 5. That is where these numbers come from; they are not a
 * taste setting, and changing the damping moves the peak off the reference.
 */
const LETTER_SPRING = { damping: 5, stiffness: 100, mass: 1 } as const;

/**
 * Pure scheduling and fitting math. Everything above the component is
 * frame-deterministic and side-effect free so it can be unit tested.
 */

/** Accepts an array or the comma-separated string the customizer passes. */
export function toList(value?: string[] | string): string[] {
  const list = typeof value === "string" ? value.split(",") : (value ?? []);
  return list.map((s) => s.trim()).filter(Boolean);
}

/**
 * Exponential ease-out, in frames.
 *
 * The reference's scroll step is not any fixed-duration curve: easeOutCubic
 * predicts 0.977 at t=0.167s against a measured 0.918, and quint/expo are far
 * too fast at the head. `1 - exp(-t/tau)` fits every sample of every step at
 * tau = 0.060s, which is what a lerp-toward-target does, and it never overshoots
 * — the reference's peak progress is exactly 1.000 at every step.
 */
export function settle(frames: number, tau: number): number {
  if (frames <= 0) return 0;
  return 1 - Math.exp(-frames / tau);
}

/**
 * Which status is up at `frame`, and how many frames since it arrived.
 *
 * The index only ever advances, and `since` is relative to the swap that put
 * the current label up — so a swap still settling when the next one starts
 * hands over cleanly instead of compounding.
 */
export function statusAt({
  frame,
  introFrames,
  statusHold,
  count,
}: {
  frame: number;
  introFrames: number;
  statusHold: number;
  count: number;
}): { index: number; since: number } {
  if (count <= 0) return { index: 0, since: 0 };
  let index = 0;
  for (let i = 1; i < count; i += 1) {
    if (frame >= introFrames + (i - 1) * statusHold) index = i;
  }
  return { index, since: frame - (introFrames + (index - 1) * statusHold) };
}

/**
 * How many chips have arrived at `frame`, and how far the step they triggered
 * has run. Clamped to `count`, so the field stops stepping once the last chip
 * is in rather than scrolling the whole column off the top.
 */
export function chipAt({
  frame,
  beat,
  stagger,
  count,
}: {
  frame: number;
  beat: number;
  stagger: number;
  count: number;
}): { arrived: number; since: number } {
  if (count <= 0 || frame < beat) return { arrived: 0, since: 0 };
  const arrived = Math.min(count, Math.floor((frame - beat) / stagger) + 1);
  return { arrived, since: frame - beat - (arrived - 1) * stagger };
}

/**
 * How much a measured line has to shrink to sit inside its budget.
 *
 * Only ever <= 1. Scaling *up* to fill the budget would make a two-word status
 * larger than a five-word one, which is the opposite of a design system.
 */
export function fitScale(measured: number, budget: number): number {
  if (!(measured > 0) || !(budget > 0)) return 1;
  return Math.min(1, budget / measured);
}

export interface StatusCycleMotion {
  /** Easing of the pill's width. `y2 > 1` on a bezier is what gives overshoot. */
  widthEase: (t: number) => number;
  /** Seconds the width morph runs. */
  widthSeconds: number;
  /** Easing of the label roll. */
  rollEase: (t: number) => number;
  /** Seconds the roll runs. */
  rollSeconds: number;
  /** Roll travel, as a multiple of pill height. */
  rollTravel: number;
  /** Seconds the field crossfade takes. */
  fadeSeconds: number;
  /** Seconds the lockup takes to leave upward. */
  exitSeconds: number;
  /** Time constant of an act-2 scroll step, in seconds. */
  scrollTau: number;
  /** Spring the intro's per-letter scale runs on. Damping sets the peak. */
  letterSpring: { damping: number; stiffness: number; mass: number };
  /** Frames between one letter's entry and the next. */
  letterStagger: number;
}

/**
 * Measured defaults. Every one is fitted from frame data — see the constant it
 * reads from — so overriding one is a deliberate departure, not a tweak.
 */
export const STATUS_CYCLE_MOTION: StatusCycleMotion = {
  widthEase: WIDTH_EASE,
  widthSeconds: WIDTH_SECONDS,
  rollEase: ROLL_EASE,
  rollSeconds: ROLL_SECONDS,
  rollTravel: ROLL_TRAVEL,
  fadeSeconds: FADE_SECONDS,
  exitSeconds: EXIT_SECONDS,
  scrollTau: SCROLL_TAU,
  letterSpring: LETTER_SPRING,
  letterStagger: 1,
};

export interface StatusCycleProps {
  /** The line that does not change, to the left of the pill. */
  prefix?: string;
  /** Pill labels, in order. Also accepts a comma-separated string. */
  statuses?: string[] | string;
  /** Act-2 chip labels, in order. Also accepts a comma-separated string. */
  chips?: string[] | string;
  /** Act-1 field. Defaults to the design system's `primary`. */
  fieldColor?: string;
  /** Act-2 field. Defaults to the design system's `background`. */
  pageColor?: string;
  /** Pill fill. Defaults to `foreground`. */
  pillColor?: string;
  /** Pill label. Defaults to a pale tint of the field. */
  pillLabelColor?: string;
  /** Prefix ink. Defaults to `foreground`. */
  prefixColor?: string;
  /**
   * Chip fills, cycled in order. The reference runs a period-3 cycle — a card,
   * a pale tint, a saturated one — and that is what the default builds from the
   * theme. Also accepts a comma-separated string.
   */
  chipFills?: string[] | string;
  /** Chip ink. One colour on every chip, including the saturated one. */
  chipTextColor?: string;
  /** Chip hairline. Defaults to the design system's border, scaled for a
   * surface this size (`mixOklch(border, foreground, 0.28)`). */
  chipBorderColor?: string;
  /** Act-1 type weight. */
  fontWeight?: number;
  /** Act-2 type weight. Measured 400 in the reference — the chips are bigger,
   * not heavier, and bumping this is the usual way to make them look cheap. */
  chipFontWeight?: number;
  /**
   * Pill corner radius in px. Defaults to 0.229 x pill height — which is very
   * nearly shadcn's own `radius` token over a 40px control (10/40 = 0.25), so
   * the default already sits in the design system rather than beside it. Pass
   * `theme.radius` scaled to your own control size to match exactly.
   */
  pillRadius?: number;
  /** Chip corner radius in px. Defaults to 0.162 x chip height. */
  chipRadius?: number;
  /** Chip hairline width in px. Defaults to 0.017 x chip height. */
  chipBorderWidth?: number;
  /** Pill centre, as a fraction of frame height. The reference rides 1.6% low. */
  pillCenterY?: number;
  /** Curve and timing overrides. Merged over {@link STATUS_CYCLE_MOTION}. */
  motion?: Partial<StatusCycleMotion>;
  /** Act-1 type size in px. Defaults to 8.7% of the composition height. */
  fontSize?: number;
  /** Act-2 type size in px. Defaults to 22.2% of the composition height. */
  chipFontSize?: number;
  /** Font stack. Defaults to Inter, loaded through `@remotion/google-fonts`. */
  fontFamily?: string;
  /** Frames from one status swap to the next. */
  statusHold?: number;
  /** Frames the intro cascade is given before the first swap. */
  introFrames?: number;
  /** Frames from one chip's arrival to the next. */
  chipStagger?: number;
  /** Frame the scene starts on. */
  startAt?: number;
  /** Playback rate. */
  speed?: number;
  /** Design-system token overrides. */
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
}

interface Metrics {
  /** Left offset and width of every prefix glyph, in layout px. */
  letters: { left: number; width: number }[];
  prefixWidth: number;
  /** Distance from the prefix box's top to its baseline. */
  baseline: number;
  statusWidths: number[];
  chipWidths: number[];
}

export function StatusCycle({
  prefix = "snapcn is",
  statuses = ["animating", "transitioning", "rendering a scene", "installed"],
  chips = [
    "text-reveal",
    "phone-frame",
    "answer-stream",
    "word-flip",
    "orbit-gallery",
  ],
  fieldColor,
  pageColor,
  pillColor,
  pillLabelColor,
  prefixColor,
  chipFills,
  chipTextColor,
  chipBorderColor,
  fontWeight = 400,
  chipFontWeight = 400,
  pillRadius,
  chipRadius,
  chipBorderWidth,
  pillCenterY = PILL_CY,
  motion,
  fontSize,
  chipFontSize,
  fontFamily,
  statusHold = 18,
  introFrames = 24,
  chipStagger = 8,
  startAt = 0,
  speed = 1,
  theme,
  mode,
}: StatusCycleProps) {
  const frame = useCurrentFrame() * speed - startAt;
  const { fps, width, height } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily ?? t.fontFamily) ?? SANS;

  // Memoised because they are `useEffect` dependencies: rebuilt every render,
  // the measuring effect would re-run forever.
  const labels = useMemo(() => toList(statuses), [statuses]);
  const chipLabels = useMemo(() => toList(chips), [chips]);
  const glyphs = useMemo(() => [...prefix], [prefix]);

  const field = fieldColor ?? t.primary;
  const page = pageColor ?? t.background;
  const pillFill = pillColor ?? t.foreground;
  const prefixInk = prefixColor ?? t.foreground;
  // A pale tint of the field: the reference's label is its own brand colour
  // lightened, and this reproduces that relationship in whatever palette the
  // component lands in.
  //
  // Mixed toward `card`, NOT `background`, and that is load-bearing. `mixOklch`
  // interpolates hue the short way round, and `background` (#faf9f6) is a *warm*
  // off-white with a real hue near 90 degrees — so a mix from a 264-degree blue
  // sweeps 174 degrees through green and lands on rgb(164,213,180). `card` is
  // achromatic, its hue is undefined, and the blue's hue is carried through
  // unchanged: rgb(178,205,247), the pale blue anyone would expect.
  const labelInk = pillLabelColor ?? mixOklch(field, t.card, 0.62);
  const chipInk = chipTextColor ?? t.foreground;
  // One hairline on every chip, from the system's own recipe for scaling a
  // border token up to a surface this size (design-system rule 3b) — not a
  // per-fill blend, because the reference likewise inks every chip the same.
  const chipEdge = chipBorderColor ?? mixOklch(t.border, t.foreground, 0.28);
  const m = { ...STATUS_CYCLE_MOTION, ...motion };
  const fills = toList(chipFills);
  const fillCycle =
    fills.length > 0 ? fills : [t.card, mixOklch(t.card, field, 0.14), field];

  const nominalEm = fontSize ?? ACT1_EM * height;
  const nominalChipEm = chipFontSize ?? ACT2_EM * height;

  // -------------------------------------------------------------------------
  // Measure. `offsetWidth`/`offsetLeft` are layout px, untouched by the
  // transforms this scene is about to apply, which is exactly what makes them
  // the right tool. Measured in a hidden, untransformed copy so frame 0 can
  // never be captured against the wrong geometry.
  // -------------------------------------------------------------------------
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [handle] = useState(() => delayRender("status-cycle: measuring"));
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const prefixRef = useRef<HTMLSpanElement | null>(null);
  const baselineRef = useRef<HTMLSpanElement | null>(null);
  const statusRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const chipRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (metrics) {
      continueRender(handle);
      return;
    }
    const prefixWidth = prefixRef.current?.offsetWidth ?? 0;
    if (prefixWidth <= 0) return;
    setMetrics({
      letters: glyphs.map((_, i) => ({
        left: letterRefs.current[i]?.offsetLeft ?? 0,
        width: letterRefs.current[i]?.offsetWidth ?? 0,
      })),
      prefixWidth,
      baseline: baselineRef.current?.offsetTop ?? 0,
      statusWidths: labels.map(
        (_, i) => statusRefs.current[i]?.offsetWidth ?? 0,
      ),
      chipWidths: chipLabels.map(
        (_, i) => chipRefs.current[i]?.offsetWidth ?? 0,
      ),
    });
  }, [metrics, handle, glyphs, labels, chipLabels]);

  // -------------------------------------------------------------------------
  // Timeline
  // -------------------------------------------------------------------------
  const swapAt = (i: number) => introFrames + (i - 1) * statusHold;
  const act1End = swapAt(labels.length) + statusHold;
  const fadeStart = act1End;
  const fadeFrames = m.fadeSeconds * fps;
  // The three events are one beat, not three. In the reference the lockup leaves
  // and the first chip arrives on the same frame, and that frame is the exact
  // midpoint of the crossfade — colour starts moving, the swap happens under it,
  // colour finishes. Splitting them reads as three separate cuts.
  const beat = fadeStart + fadeFrames / 2;

  // Two opaque layers with an opacity ramp, not `mixOklch` between the two.
  // The reference's own crossfade does look like an OKLCH mix — its R channel
  // runs 2-5 points behind G and B, which an sRGB lerp cannot do — but its two
  // colours are a green and a cream, 30 degrees of hue apart. Ours are whatever
  // the theme says, and `primary` to `background` is 174 degrees, which OKLCH
  // walks the short way *through green*. A layered crossfade is what the word
  // means and it cannot swing.
  const fadeP = interpolate(
    frame,
    [fadeStart, fadeStart + fadeFrames],
    [0, 1],
    CLAMP,
  );

  // -------------------------------------------------------------------------
  // Fit
  //
  // A size measured off one sentence is a size that clips the next one. Both
  // acts are measured at their nominal type size and then scaled down — never
  // up — by however much the widest line overruns its share of the frame. Text
  // width is linear in font size, so the measured widths scale with the same
  // factor and no second measuring pass is needed.
  // -------------------------------------------------------------------------
  const rawPad = PILL_PAD * PILL_H * nominalEm;
  const rawGap = PILL_GAP * PILL_H * nominalEm;
  const rawLockup =
    (metrics?.prefixWidth ?? 0) +
    rawGap +
    Math.max(0, ...(metrics?.statusWidths ?? [0])) +
    2 * rawPad;
  const act1Fit = metrics ? fitScale(rawLockup, ACT1_FIT * width) : 1;

  const rawChip =
    Math.max(0, ...(metrics?.chipWidths ?? [0])) +
    2 * CHIP_PAD_X * nominalChipEm;
  const chipFit = metrics ? fitScale(rawChip, (1 - 2 * CHIP_INSET) * width) : 1;

  const em = nominalEm * act1Fit;
  const chipEm = nominalChipEm * chipFit;
  const pillH = PILL_H * em;
  const pillPad = PILL_PAD * pillH;
  const gap = PILL_GAP * pillH;
  const prefixWidth = (metrics?.prefixWidth ?? 0) * act1Fit;

  const pillWidths = (metrics?.statusWidths ?? labels.map(() => 0)).map(
    (w) => w * act1Fit + 2 * pillPad,
  );

  /** Which label is up, and how far the swap into it has progressed. */
  const widthSeconds = m.widthSeconds * fps;
  const rollSeconds = m.rollSeconds * fps;
  const { index, since } = statusAt({
    frame,
    introFrames,
    statusHold,
    count: labels.length,
  });
  // Index 0 opens from nothing rather than cutting in at full width. The tape
  // cannot settle this — its first recorded frame already has a pill, and the
  // reference's own calling->typing morph is arithmetically inseparable from
  // the intro's tail — so this runs the same curve the other morphs run, over
  // the intro, which is the least invented thing available.
  const widthP =
    index === 0
      ? m.widthEase(Math.min(1, Math.max(0, frame / introFrames)))
      : m.widthEase(Math.min(1, Math.max(0, since / widthSeconds)));
  const rollP =
    index === 0 ? 1 : m.rollEase(Math.min(1, Math.max(0, since / rollSeconds)));

  const pillW = interpolate(
    widthP,
    [0, 1],
    [index === 0 ? 0 : (pillWidths[index - 1] ?? 0), pillWidths[index] ?? 0],
  );

  // The whole lockup arrives on one slow scale settle. The reference's is still
  // drifting -7% two seconds in; this one lands, because a settle nobody can see
  // is frames spent on travel that only costs sharpness.
  const groupScale = spring({
    frame,
    fps,
    config: { damping: 26, stiffness: 90, mass: 1.4 },
    from: 1.16,
    to: 1,
  });

  const exitP = settle((frame - beat) * (1 / m.exitSeconds / fps), 0.28);
  const exitY = frame < beat ? 0 : -exitP * 0.62 * height;

  const total = prefixWidth + gap + pillW;
  const originX = (width - total) / 2;
  const cy = pillCenterY * height;

  // Only the Player gets `will-change`: a render is spread across parallel tabs
  // and each inherits a stale raster, so the same style comes out as several
  // different rasterisations and the type shimmers while standing still.
  const promote = getRemotionEnvironment().isRendering
    ? null
    : ({ willChange: "transform" } as const);

  const typeStyle = {
    fontFamily: face,
    fontWeight,
    // Hinting re-snaps every stem as the size slides, so the letterforms boil.
    // Off, shape drift over a scale falls from 3.41% to 0.22%.
    textRendering: "geometricPrecision" as const,
    whiteSpace: "nowrap" as const,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: page, overflow: "hidden" }}>
      <AbsoluteFill style={{ backgroundColor: field, opacity: 1 - fadeP }} />
      {metrics ? null : (
        <Measuring
          glyphs={glyphs}
          labels={labels}
          chipLabels={chipLabels}
          em={em}
          chipEm={chipEm}
          typeStyle={typeStyle}
          letterRefs={letterRefs}
          prefixRef={prefixRef}
          baselineRef={baselineRef}
          statusRefs={statusRefs}
          chipRefs={chipRefs}
        />
      )}

      {metrics && frame < beat + m.exitSeconds * fps ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            transform: `translateY(${exitY}px) scale(${groupScale})`,
            transformOrigin: `${width / 2}px ${cy}px`,
            width,
            height,
            ...promote,
          }}
        >
          <Prefix
            glyphs={glyphs}
            metrics={metrics}
            frame={frame}
            fps={fps}
            em={em}
            fit={act1Fit}
            spring={m.letterSpring}
            stagger={m.letterStagger}
            x={originX}
            cy={cy}
            color={prefixInk}
            typeStyle={typeStyle}
          />
          <Pill
            labels={labels}
            index={index}
            rollP={rollP}
            x={originX + prefixWidth + gap}
            cy={cy}
            width={pillW}
            height={pillH}
            em={em}
            fill={pillFill}
            ink={labelInk}
            radius={pillRadius ?? PILL_R * pillH}
            travel={m.rollTravel * pillH}
            typeStyle={typeStyle}
          />
        </div>
      ) : null}

      {metrics ? (
        <Chips
          labels={chipLabels}
          widths={metrics.chipWidths.map((w) => w * chipFit)}
          frame={frame}
          fps={fps}
          beat={beat}
          stagger={chipStagger}
          em={chipEm}
          width={width}
          height={height}
          fills={fillCycle}
          ink={chipInk}
          edge={chipEdge}
          radius={chipRadius}
          borderWidth={chipBorderWidth}
          weight={chipFontWeight}
          tau={m.scrollTau}
          typeStyle={typeStyle}
        />
      ) : null}
    </AbsoluteFill>
  );
}

/**
 * The intro cascade: every glyph sits at its **final advance** and scales about
 * its own baseline, staggered left to right.
 *
 * Measured, not guessed. Tracking one 'o' by its counter gives 1.01x → 1.45x →
 * 1.00x while its stroke-to-height ratio holds at 0.149 ± 0.006 — so nothing is
 * animating a weight or width axis, it is a plain scale, and the letters only
 * *look* heavier early because at 1.45x they overlap their neighbours' fixed
 * slots. The prefix's total ink span is unchanged from the first frame to the
 * last, which is only possible if the layout is static and the transform is
 * per-glyph.
 *
 * The one deliberate departure from the reference is the pivot. The reference
 * scales each letter about its centre, which drags the baseline; a moving
 * baseline climbs the pixel grid in whole-pixel jumps, because the rasteriser
 * has no vertical sub-pixel positioning at all. Pivoting on the baseline takes
 * judder from 0.284px to 0.014px and direction reversals from 29 to 0, and it
 * costs a downward growth nobody can name.
 */
function Prefix({
  glyphs,
  metrics,
  frame,
  fps,
  em,
  fit,
  spring: springConfig,
  stagger,
  x,
  cy,
  color,
  typeStyle,
}: {
  glyphs: string[];
  metrics: Metrics;
  frame: number;
  fps: number;
  em: number;
  /** Scale the measured glyph offsets were taken at, relative to `em`. */
  fit: number;
  spring: { damping: number; stiffness: number; mass: number };
  stagger: number;
  x: number;
  cy: number;
  color: string;
  typeStyle: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: cy - em,
        height: 2 * em,
        color,
        fontSize: em,
        lineHeight: 2,
        ...typeStyle,
      }}
    >
      {glyphs.map((g, i) => {
        // Stagger of one frame. Measured: the shared scale curve takes about one
        // 30fps frame to travel 0.71x → 1.01x, which is the gap the reference
        // shows between adjacent letters.
        const p = spring({
          frame: frame - i * stagger,
          fps,
          config: springConfig,
        });
        // The spring carries the overshoot; `interpolate` extrapolates past 1,
        // so mapping [0,1] onto [0.1,1] puts the peak at 1.4x on its own — no
        // second curve, and nothing to keep in step with the damping.
        const s = interpolate(p, [0, 1], [0.1, 1]);
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: positional glyph slot
            key={i}
            style={{
              position: "absolute",
              left: (metrics.letters[i]?.left ?? 0) * fit,
              top: 0,
              transform: `scale(${s})`,
              transformOrigin: `50% ${metrics.baseline * fit}px`,
              ...typeStyle,
            }}
          >
            {g === " " ? " " : g}
          </span>
        );
      })}
    </div>
  );
}

/**
 * The pill: a width that animates straight through a label that never changes
 * size, and two stacked labels rolling upward behind a hard clip.
 *
 * The label is laid out at its full final width and centred, and the widening
 * pill reveals it from the middle out — proven on the reference by the two
 * inter-word gaps of "sharing a moment" sitting at x = 486.0 and 521.5 across
 * three frames while the pill grew 83px. So the width cannot be derived from a
 * padded text box each frame; it is its own animated quantity.
 *
 * There is no crossfade. The label ink's mean brightness holds inside a 4% band
 * through every swap, including the frames where both labels are half-clipped —
 * a fade would collapse it toward the fill. Pure translation plus clipping.
 */
function Pill({
  labels,
  index,
  rollP,
  x,
  cy,
  width,
  height,
  em,
  fill,
  ink,
  radius,
  travel,
  typeStyle,
}: {
  labels: string[];
  index: number;
  rollP: number;
  x: number;
  cy: number;
  width: number;
  height: number;
  em: number;
  fill: string;
  ink: string;
  radius: number;
  travel: number;
  typeStyle: React.CSSProperties;
}) {
  const showOutgoing = rollP < 1 && index > 0;

  const label = (text: string, offset: number) => (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 0,
        height,
        display: "flex",
        alignItems: "center",
        transform: `translate(-50%, ${offset}px)`,
        color: ink,
        fontSize: em,
        ...typeStyle,
      }}
    >
      {text}
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: cy - height / 2,
        width,
        height,
        borderRadius: radius,
        backgroundColor: fill,
        overflow: "hidden",
      }}
    >
      {showOutgoing ? label(labels[index - 1] ?? "", -rollP * travel) : null}
      {label(labels[index] ?? "", (1 - rollP) * travel)}
    </div>
  );
}

/**
 * Act 2: chips ride a field that steps, not scrolls.
 *
 * The field is dead still between beats — residual velocity under 1px per
 * captured frame — and then jumps exactly one slot with a hard ease-out on the
 * frame a new chip appears. The chips themselves do nothing: measured across
 * every frame each is visible, width and fill are final from the first frame and
 * never change, and two chips in the same step travelled 140.02px and 139.34px,
 * so it is one transform on the container rather than per-chip animation.
 */
function Chips({
  labels,
  widths,
  frame,
  fps,
  beat,
  stagger,
  em,
  width,
  height,
  fills,
  ink,
  edge,
  radius,
  borderWidth,
  weight,
  tau: scrollTau,
  typeStyle,
}: {
  labels: string[];
  widths: number[];
  frame: number;
  fps: number;
  beat: number;
  stagger: number;
  em: number;
  width: number;
  height: number;
  fills: string[];
  ink: string;
  edge: string;
  radius?: number;
  borderWidth?: number;
  weight: number;
  tau: number;
  typeStyle: React.CSSProperties;
}) {
  if (frame < beat) return null;

  const chipH = em * (1 + 2 * CHIP_PAD_Y);
  const step = chipH + CHIP_GAP * height;
  const tau = scrollTau * fps;

  // How many chips have arrived, and how far the current step has run.
  const { arrived, since } = chipAt({
    frame,
    beat,
    stagger,
    count: labels.length,
  });
  const p = settle(since, tau);
  // The newest chip comes to rest one gap clear of the bottom edge. Landing it
  // flush reads as clipped rather than as arrived — its border sits on the
  // frame edge and half of it is lost to the codec.
  const fieldY = height - CHIP_GAP * height - chipH - (arrived - 2 + p) * step;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {labels.slice(0, arrived).map((text, i) => {
        const w = (widths[i] ?? 0) + 2 * CHIP_PAD_X * em;
        const left = i % 2 === 0;
        const fill = fills[i % fills.length] ?? fills[0];
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: positional chip slot
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left: left ? CHIP_INSET * width : undefined,
              right: left ? undefined : CHIP_INSET * width,
              transform: `translateY(${fieldY + i * step}px)`,
              width: w,
              height: chipH,
              borderRadius: radius ?? CHIP_R * chipH,
              backgroundColor: fill,
              // A hairline and nothing else. The reference has no shadow — cream
              // measured through a chip's top edge recovers to its flat value
              // within 2px on both sides, with no directional darkening — and a
              // drop shadow under a light chip on a light page is a grey smear.
              border: `${borderWidth ?? CHIP_BORDER * chipH}px solid ${edge}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: ink,
              fontSize: em,
              ...typeStyle,
              fontWeight: weight,
            }}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
}

/**
 * The hidden, untransformed copy every measurement is taken from. Rendered only
 * until `metrics` exists, and `delayRender` holds frame 0 until then.
 */
function Measuring({
  glyphs,
  labels,
  chipLabels,
  em,
  chipEm,
  typeStyle,
  letterRefs,
  prefixRef,
  baselineRef,
  statusRefs,
  chipRefs,
}: {
  glyphs: string[];
  labels: string[];
  chipLabels: string[];
  em: number;
  chipEm: number;
  typeStyle: React.CSSProperties;
  letterRefs: React.RefObject<(HTMLSpanElement | null)[]>;
  prefixRef: React.RefObject<HTMLSpanElement | null>;
  baselineRef: React.RefObject<HTMLSpanElement | null>;
  statusRefs: React.RefObject<(HTMLSpanElement | null)[]>;
  chipRefs: React.RefObject<(HTMLSpanElement | null)[]>;
}) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        visibility: "hidden",
        left: 0,
        top: 0,
        pointerEvents: "none",
        // Each measured span is `inline-block` and gets its own line, so it
        // reports its own text width. Left as blocks they fill this
        // shrink-to-fit box and every label comes back the widest one's width —
        // which is four identical pills and a prefix pushed off the frame.
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
      }}
    >
      <span
        ref={prefixRef}
        style={{ fontSize: em, lineHeight: 2, ...typeStyle }}
      >
        {glyphs.map((g, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: positional glyph slot
            key={i}
            ref={(el) => {
              letterRefs.current[i] = el;
            }}
            style={{ display: "inline-block" }}
          >
            {g === " " ? " " : g}
          </span>
        ))}
        {/* A zero-sized inline-block sits ON the baseline, so `offsetTop` reads
            it rather than a line-height ratio anyone has to guess. */}
        <span
          ref={baselineRef}
          style={{ display: "inline-block", width: 0, height: 0 }}
        />
      </span>
      {labels.map((text, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: positional label slot
          key={i}
          ref={(el) => {
            statusRefs.current[i] = el;
          }}
          style={{ display: "inline-block", fontSize: em, ...typeStyle }}
        >
          {text}
        </span>
      ))}
      {chipLabels.map((text, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: positional chip slot
          key={i}
          ref={(el) => {
            chipRefs.current[i] = el;
          }}
          style={{ display: "inline-block", fontSize: chipEm, ...typeStyle }}
        >
          {text}
        </span>
      ))}
    </div>
  );
}
