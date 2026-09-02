"use client";

import { loadFont as loadGoogleSans } from "@remotion/google-fonts/GoogleSans";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  resolveFont,
  SnapCnUIProvider,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";

// Loaded through @remotion/google-fonts, never a CSS variable — a Remotion
// bundle has none of the app's CSS, so `var(--font-…)` gets you the right face
// in the Player and a fallback in the mp4 (design-system rule 4).
const { fontFamily: SANS } = loadGoogleSans("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

export interface AnnounceTitleProps {
  /**
   * The face this scene paints its words in — a label from `fonts.ts`
   * ("Inter", "Space Grotesk", "Instrument Serif") or a CSS family you have
   * loaded yourself. Unset, the scene keeps the face it was designed around.
   *
   * Overrides `theme.fontFamily`, which is how a brand kit re-skins a whole
   * timeline from one value.
   */
  fontFamily?: string;
  /** The word that rushes past the camera and lands on the colour field. */
  eyebrow?: string;
  /** The product name, assembled word by word on the paper card. */
  title?: string;
  /** The closing line. Revealed last word first, then drained to white. */
  tagline?: string;
  /** Ground behind the opening rush. */
  voidColor?: string;
  /** The colour field the eyebrow lands on. */
  fieldColor?: string;
  /** Paper the title is set on. */
  paperColor?: string;
  /** Ink the title is set in. */
  titleColor?: string;
  /** Ground behind both closing shots, under the glow. */
  nightColor?: string;
  /** The glow lifting the closing ground off the base, low and centre. */
  glowColor?: string;
  /** How far that glow lifts it, 0–1. Above ~0.3 the ground stops reading black. */
  glowStrength?: number;
  /** Where the tagline settles once the white has swept through it. */
  taglineColor?: string;
  /**
   * The mark the closing line is led by, as an SVG path drawn in a
   * `0 0 100 100` box. Pass your own logo's path, or `""` for no mark at all.
   */
  symbolPath?: string;
  /**
   * Gradient stops for the mark, spaced evenly from its first tip to the last.
   * Two colours give a plain ramp, one a flat fill. A comma-separated string
   * works too, which is what the customizer's text control passes. Defaults to
   * the ten measured stops of the four-point spark.
   */
  symbolColors?: string[] | string;
  /** Multiplier on the mark's size, in both the macro shot and the close. */
  symbolScale?: number;
  speed?: number;
}

/** The mark, resolved once and handed to both shots that draw it. */
interface SymbolStyle {
  path: string;
  colors: string[];
  scale: number;
}

// --- The shot list ---------------------------------------------------------
//
// Four shots and three hard cuts, in composition frames at 30fps, measured off
// the reference. Nothing crossfades and nothing is continuous across a cut: the
// rush and the settle are two different shots of the same word, and the macro
// shot is not a magnified frame of the closing one — its star travels *right*
// while its type travels left, which the closing shot's never does.

const PLANE_OUT = 18;
const FIELD_OUT = 41;
const PAPER_OUT = 80;
const MACRO_OUT = 110;

/** The reference is 802px wide; every measured px below is in those units. */
const REF_W = 802;
const REF_H = 450;

// --- Motion ---------------------------------------------------------------

/**
 * Every settle in this piece is the same curve: an exponential lag, fitted
 * frame by frame against the reference. The excess over the resting value
 * shrinks by a constant fraction per frame — 0.76 for the eyebrow's scale, 0.82
 * for the title words, 0.79 for the closing line — which is a first-order
 * approach, not any of the standard cubic-beziers.
 *
 * A raw exponential never arrives, and on a frame clock that tail is not a
 * settle, it is a run of identical frames. So it is normalised over a fixed
 * window: `settle` is 0 at `t = 0` and exactly 1 at `t = span`, keeping the
 * shape of the measured decay in between and leaving nothing to snap on the
 * last frame.
 */
function settle(t: number, span: number, decay: number): number {
  if (t <= 0) return 0;
  if (t >= span) return 1;
  return (1 - decay ** t) / (1 - decay ** span);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Linear interpolation through a table of `[position, value]` samples. */
function sample(table: readonly (readonly [number, number])[], p: number) {
  if (p <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (p >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (p <= x1) {
      const [x0, y0] = table[i - 1];
      return y0 + ((y1 - y0) * (p - x0)) / (x1 - x0);
    }
  }
  return last[1];
}

/**
 * Motion blur, done the way a camera does it: sample the shot several times
 * across the window the shutter is open and average the samples.
 *
 * Averaging is the whole trick. Stacking N copies at `1/N` opacity does *not*
 * average them — alpha compositing leaves the fully-overlapped core at
 * `1 - (1 - 1/N)^N`, about 63%, so white type comes out grey. Painting
 * back-to-front at `1, 1/2, 1/3 … 1/N` composites to the exact mean instead,
 * which is both correct and free.
 *
 * A directional `feGaussianBlur` would be cheaper but only smears along one
 * fixed axis, and neither blur here is axis-aligned: the opening rush is radial
 * (every point moves away from the vanishing point along its own line) and the
 * exit is staggered per letter. Sampling the real transform gets both for
 * nothing, and it gets the streak's density right too — a real streak is denser
 * where the subject dwelt.
 */
function Shutter({
  frame,
  samples,
  open,
  children,
}: {
  frame: number;
  /** Sub-frame samples. The streak reads as ghosts if they land >5px apart. */
  samples: number;
  /** Shutter window, in frames. 0.5 is a film shutter; longer smears harder. */
  open: number;
  children: (subFrame: number) => ReactNode;
}) {
  const layers: ReactNode[] = [];
  const n = Math.max(2, Math.round(samples));
  for (let i = 0; i < n; i++) {
    // i = 0 is the oldest sample and sits at the back at full opacity; each
    // newer one is laid over it at 1/(i+1). See the note above.
    layers.push(
      <AbsoluteFill key={i} style={{ opacity: 1 / (i + 1) }}>
        {children(frame - open + (open * i) / (n - 1))}
      </AbsoluteFill>,
    );
  }
  return <>{layers}</>;
}

// --- Type -----------------------------------------------------------------

/**
 * `geometricPrecision` is not a nicety here. Hinting bends each glyph's outline
 * so its stems land on whole pixels; as a size slides, every stem re-snaps to a
 * different grid and the letterforms change shape frame to frame. Measured on
 * the shape invariant that cannot change under a scale, a line's ink drifted
 * 3.41% with hinting on and 0.22% with it off. Every line in this piece is
 * either being scaled or being panned at 14x, so all of them need it.
 *
 * `willChange` is the opposite: right in the Player, wrong in the render. It
 * hands the scale to the compositor, which resamples a bitmap instead of
 * re-rasterising type — fine for one continuous tab with an 8ms budget, and
 * actively wrong across the parallel tabs a render is spread over, where each
 * tab inherits a stale raster from whatever scale it drew last.
 *
 * The tracking is measured, not taste. At the reference's cap heights the three
 * lines set to 183.7px, 230.4px and 693px of ink, and Google Sans at those cap
 * heights is wider than that — display type in the reference is tracked hard in,
 * body type barely at all.
 */
function lineStyle(
  fontSize: number,
  tracking: number,
  face: string,
): CSSProperties {
  return {
    fontFamily: face,
    fontSize,
    fontWeight: 400,
    lineHeight: 1,
    letterSpacing: `${tracking}em`,
    // CSS adds the tracking after the *last* character too, so a centred line
    // sits half a gap off its ink centre. Cancel the space it never uses.
    marginRight: `${-tracking}em`,
    whiteSpace: "pre",
    textRendering: "geometricPrecision",
    ...(getRemotionEnvironment().isRendering
      ? null
      : { willChange: "transform" as const }),
  };
}

const EYEBROW_SIZE = 41.6 / REF_W;
const EYEBROW_TRACK = -0.0666;
const TITLE_SIZE = 41.3 / REF_W;
const TITLE_TRACK = -0.0563;
const TAGLINE_SIZE = 35 / REF_W;
const TAGLINE_TRACK = -0.015;

/**
 * Distance from the vertical centre of a flex-centred line box down to the
 * text baseline, as a fraction of the font size. Google Sans's ascent and
 * descent are not symmetric about the em box, so a centred line does not put
 * its baseline on the frame's centre line; this is the measured difference.
 */
const BASELINE_DROP = 0.335;

/** Baselines, measured: 236.87, 240.40 and 233.5 in reference px. */
const EYEBROW_BASELINE = 236.87 / REF_H;
const TITLE_BASELINE = 240.4 / REF_H;
const TAGLINE_BASELINE = 233.5 / REF_H;

/**
 * A single line of the piece, placed by its baseline rather than by centring
 * its box. The three lines share a cap height to within 1% but sit on three
 * different baselines 3.5px apart, so centring cannot place all of them.
 */
function Line({
  children,
  fontSize,
  tracking,
  baseline,
  height,
  style,
}: {
  children: ReactNode;
  fontSize: number;
  tracking: number;
  /** Baseline position as a fraction of the frame height. */
  baseline: number;
  height: number;
  style?: CSSProperties;
}) {
  const face = useSnapCnTheme().fontFamily ?? SANS;
  return (
    <Stage offset={(baseline - 0.5) * height - BASELINE_DROP * fontSize}>
      <div style={{ ...lineStyle(fontSize, tracking, face), ...style }}>
        {children}
      </div>
    </Stage>
  );
}

/**
 * Centres its child in the frame and then shifts it by `offset` px.
 *
 * The shift is a wrapper rather than a `top` on the fill, because an
 * `AbsoluteFill` keeps `bottom: 0` — moving its top edge shortens the box and
 * moves its centre by only half of what you asked for.
 */
function Stage({
  offset,
  children,
  align = "center",
}: {
  offset: number;
  children: ReactNode;
  align?: "center" | "flex-start";
}) {
  return (
    <AbsoluteFill style={{ alignItems: align, justifyContent: "center" }}>
      <div style={{ transform: `translateY(${offset}px)` }}>{children}</div>
    </AbsoluteFill>
  );
}

/**
 * Fit scales for the three lines, measured once behind `delayRender()`.
 *
 * Every measurement in this file was taken off one reference sentence, and a
 * font size fixed to it clips the moment somebody writes a longer one — the
 * default tagline here is one character longer than the reference's and 14%
 * wider, because "Ready-made" and "Remotion," carry wider glyphs than "Perfect"
 * and "massive". A character count cannot see that; only layout can. So each
 * line is drawn once into a hidden probe, its real width read off it, and the
 * size scaled down if it would overrun its share of the frame. Lines that
 * already fit are left at exactly the measured size.
 *
 * `offsetWidth` is layout px and is untouched by the transforms these lines
 * later carry, which is what makes it the right tool here. The render is held
 * until the measurement has re-rendered, so frame 0 is never captured with the
 * wrong geometry.
 */
interface LineFit {
  text: string;
  fontSize: number;
  tracking: number;
  /** Widest this line may draw, in px. */
  maxWidth: number;
}

function useFitScales(lines: LineFit[]): {
  probes: ReactNode;
  scales: number[];
} {
  // The probe measures in the same face the words paint in — a ruler in a
  // different typeface fits the lines to the wrong width.
  const face = useSnapCnTheme().fontFamily ?? SANS;
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const [handle] = useState(() => delayRender("announce-title: measure lines"));
  const [measured, setMeasured] = useState<{
    key: string;
    widths: number[];
  } | null>(null);
  const count = lines.length;
  // Every input the measurement depends on. The `lines` array itself is a fresh
  // object each render, so depending on it would re-measure forever.
  const key = lines.map((l) => `${l.text}@${Math.round(l.fontSize)}`).join("|");

  useEffect(() => {
    setMeasured({
      key,
      widths: Array.from(
        { length: count },
        (_, i) => refs.current[i]?.offsetWidth ?? 0,
      ),
    });
  }, [key, count]);

  useEffect(() => {
    if (measured) continueRender(handle);
  }, [measured, handle]);

  const probes = (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        visibility: "hidden",
        pointerEvents: "none",
      }}
    >
      {lines.map((line, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: positional slot
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          style={lineStyle(line.fontSize, line.tracking, face)}
        >
          {line.text}
        </span>
      ))}
    </div>
  );

  // Stored with the key it was taken for, so a text change falls back to the
  // measured default for one frame rather than scaling by a stale width.
  const scales = lines.map((line, i) => {
    const w = measured?.key === key ? measured.widths[i] : undefined;
    return w && w > line.maxWidth ? line.maxWidth / w : 1;
  });

  return { probes, scales };
}

// --- The symbol -----------------------------------------------------------

/**
 * The snapcn mark, the same outline `public/logo.svg` draws, refitted into the
 * `0 0 100 100` box this scene draws marks in. The ink fills 86% of the box
 * rather than all of it: a solid mark carries far more weight than the thin
 * four-point spark this replaced, and at a full-bleed fit it stopped reading as
 * an accent beside the line and started reading as a second subject.
 *
 * It is the default for `symbolPath`, not a fixture: any path drawn in the same
 * box drops straight in, and an empty one leaves the line bare.
 */
export const MARK_PATH =
  "M15.757 15.459c-3.324 0.816 -6.07 2.966 -7.563 5.911 -1.194 2.388 -1.174 1.672 -1.174 24.66 0 19.982 0.02 21.077 0.378 22.132 0.955 2.926 2.946 4.498 6.588 5.215 1.99 0.398 2.528 0.657 3.702 1.732 1.055 0.975 1.473 2.169 1.473 4.219 0.02 2.408 0.836 3.901 2.647 4.856l1.035 0.537 19.505 0.06c17.574 0.06 19.624 0.02 20.739 -0.259 1.493 -0.418 2.647 -1.333 3.403 -2.766l0.537 -1.015 0.06 -6.269c0.04 -3.443 0.04 -6.807 0 -7.444l-0.06 -1.194 -0.617 0.995c-0.717 1.174 -2.01 2.289 -3.383 2.906l-0.975 0.458 -16.121 0.06c-11.763 0.04 -16.42 -0 -17.216 -0.159 -2.548 -0.557 -5.135 -2.408 -6.468 -4.657 -1.294 -2.189 -1.314 -2.548 -1.254 -16.44l0.06 -12.439 0.478 -1.154c0.876 -2.209 2.926 -4.18 5.374 -5.155l1.115 -0.458 16.519 -0.06c16.101 -0.04 16.539 -0.04 17.813 0.358 1.592 0.498 2.966 1.473 3.941 2.826l0.736 1.035 0.06 -6.648c0.06 -7.304 -0.06 -8.319 -1.115 -9.832 -0.597 -0.876 -1.95 -1.811 -3.025 -2.11 -0.438 -0.119 -9.096 -0.199 -23.386 -0.179 -18.37 0.02 -22.908 0.06 -23.804 0.279zM79.665 31.819c-6.508 3.901 -11.902 7.185 -11.981 7.304 -0.08 0.119 -0.139 5.055 -0.1 10.947l0.04 10.748 2.886 1.811c1.592 0.995 4.14 2.587 5.672 3.523 1.533 0.935 5.632 3.463 9.096 5.613 3.463 2.15 6.488 3.901 6.707 3.901 0.219 -0 0.537 -0.139 0.697 -0.318 0.279 -0.279 0.318 -2.806 0.318 -24.958 0 -15.544 -0.08 -24.839 -0.199 -25.157 -0.139 -0.398 -0.318 -0.517 -0.736 -0.517 -0.358 0.02 -4.617 2.448 -12.399 7.105z";

/**
 * The default fill, as ten measured stops from the blue tip to the red one. It
 * is not a two-stop ramp in any colour space: sRGB is off by 70/255 and oklab by
 * 58/255, because the real ramp holds its blue flat and then collapses it.
 * Interpolating the measurements is both shorter and exact.
 *
 * `symbolColors` replaces it with any number of stops, spaced evenly — two
 * colours give a plain ramp, one gives a flat fill.
 */
export const SPARK_RAMP: readonly (readonly [number, string])[] = [
  [0, "#0365f3"],
  [0.17, "#1c5cf1"],
  [0.31, "#3a54ec"],
  [0.41, "#554ce5"],
  [0.52, "#7041cb"],
  [0.62, "#9b3894"],
  [0.72, "#ca3068"],
  [0.83, "#e2284c"],
  [0.93, "#e71d32"],
  [1, "#e91927"],
];

/**
 * The bloom is the mark's own gradient, blurred — not a flat halo. It reads
 * pink beside the red tip and blue beside the blue one, which a single colour
 * cannot do, and stacking it twice at two radii is what gets the falloff right:
 * the real one decays exponentially over about 1.9 radii, and one Gaussian is
 * 15/255 short of that at two radii while a tight one plus a wide one is not.
 * The two together also blow the mark's centre out to near-white, which is what
 * makes it read as a light source rather than a shape.
 */
const BLOOM_PASSES = [0.0825, 0.0315, 0.009, 0.009];

/** Accepts an array or the comma-separated string the customizer passes. */
function symbolColorList(colors?: string[] | string): string[] {
  const list = typeof colors === "string" ? colors.split(",") : (colors ?? []);
  return list.map((c) => c.trim()).filter(Boolean);
}

/** The stops to paint with: the measured ramp, or evenly-spaced overrides. */
function symbolStops(colors: string[]): readonly (readonly [number, string])[] {
  if (colors.length === 0) return SPARK_RAMP;
  if (colors.length === 1)
    return [
      [0, colors[0]],
      [1, colors[0]],
    ];
  return colors.map((c, i) => [i / (colors.length - 1), c] as const);
}

function Mark({
  path,
  colors,
  size,
  width,
  rotation,
  spread = 1,
  id,
}: {
  /** Any path drawn in a `0 0 100 100` box. Empty draws nothing. */
  path: string;
  colors: string[];
  size: number;
  /** Frame width. The bloom is a lens artefact, so it is sized in frame px. */
  width: number;
  /** Degrees. At 0 the tips point N/E/S/W and the red one is up. */
  rotation: number;
  /**
   * How much of the mark the ramp is spent across, as a fraction of its
   * height. Below 1 the ends become plateaus and both tips read saturated,
   * which is what the giant one does; 1 spends the whole ramp across the mark.
   */
  spread?: number;
  id: string;
}) {
  if (!path) return null;
  const stops = symbolStops(colors);
  const edge = 0.5 + spread / 2;
  // Bloom radii are fractions of the FRAME, converted into this mark's own
  // viewBox units. Sized in the mark's units instead, the giant one would carry
  // a blur the width of the screen and wash the whole shot out.
  const blur = (f: number) => (f * width * 100) / size;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{
        display: "block",
        overflow: "visible",
        transform: `rotate(${rotation}deg)`,
      }}
    >
      <title>symbol</title>
      <defs>
        <linearGradient id={id} x1="0.5" y1={edge} x2="0.5" y2={1 - edge}>
          {stops.map(([at, color]) => (
            <stop key={at} offset={`${at * 100}%`} stopColor={color} />
          ))}
        </linearGradient>
        {[...new Set(BLOOM_PASSES)].map((r) => (
          <filter
            key={r}
            id={`${id}-${r}`}
            x="-300%"
            y="-300%"
            width="700%"
            height="700%"
          >
            <feGaussianBlur stdDeviation={blur(r)} />
          </filter>
        ))}
      </defs>
      {BLOOM_PASSES.map((r, i) => (
        <path
          // Four passes, widest first: the bloom is light being added, and
          // alpha compositing can only ever darken toward the source. Screen is
          // what makes a second pass brighten instead of repaint, and it is why
          // the mark's centre blows out to near-white. One Gaussian cannot do
          // this falloff — the real one decays exponentially over ~1.9 radii and
          // is still lifting the ground four radii out.
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed pass order
          key={i}
          d={path}
          fill={`url(#${id})`}
          filter={`url(#${id}-${r})`}
          style={{ mixBlendMode: "screen" }}
        />
      ))}
      <path d={path} fill={`url(#${id})`} />
    </svg>
  );
}

// --- Shot 1: the receding plane -------------------------------------------

/**
 * The eyebrow laid on a plane raked away from the viewer, rushing away from the
 * camera. Same construction as a static receding-type plane — `perspective` on
 * the stage and `rotateX` on the slab — with two things animated: the
 * magnification, and the rake, which flattens as the plane recedes and the lens
 * stops caring.
 *
 * The magnification is a measured table, not a curve. It does not decay at a
 * constant rate: it slows from 0.83 per frame to 0.90 around frame 12 and then
 * speeds back up to 0.77, the same decelerate-hold-accelerate shape the macro
 * shot's pan has. Nothing analytic fits that in a way worth defending, and
 * thirteen measurements interpolated are shorter than a fit anyway.
 *
 * The magnification is applied *outside* the perspective stage on purpose. Push
 * it in as translateZ and the rake's warp grows with it, so the first frames
 * fold into an unreadable wedge; kept outside, the warp is the rake's alone and
 * the frames match. It is also why the type is laid out large and scaled *down*
 * rather than small and scaled up — a browser rasterises a glyph at its layout
 * size, and a 30x magnification of a 60px glyph is a bitmap, not type.
 */
const PLANE_MAG: readonly (readonly [number, number])[] = [
  [2, 52.6],
  [3, 43.7],
  [4, 36.3],
  [5, 30.2],
  [6, 25.1],
  [7, 19.8],
  [8, 16.1],
  [9, 13.6],
  [10, 11.75],
  [11, 10.4],
  [12, 9.3],
  [13, 8.45],
  [14, 7.5],
  [15, 6.35],
  [16, 5.2],
  [17, 4.0],
];
/** Layout size of the plane's type, as a multiple of the eyebrow's own. */
const PLANE_BASE = 6;
const PLANE_PERSPECTIVE = 0.36;
/**
 * Rake per frame, from the measured height of the plane's own vanishing line.
 * It starts nearly floor-like — the horizon is inside the frame until frame 8 —
 * and is flat by the cut. Read off `atan(perspective / |horizon - origin|)`.
 */
const PLANE_RAKE: readonly (readonly [number, number])[] = [
  [5, 81],
  [7, 68],
  [9, 55],
  [11, 41],
  [13, 31],
  [15, 20],
  [17, 14],
];

function RecedingPlane({
  text,
  frame,
  width,
  height,
  fontSize,
}: {
  text: string;
  frame: number;
  width: number;
  height: number;
  fontSize: number;
}) {
  const face = useSnapCnTheme().fontFamily ?? SANS;
  const mag = sample(PLANE_MAG, frame);
  const rake = sample(PLANE_RAKE, frame);
  return (
    <Stage
      offset={(EYEBROW_BASELINE - 0.5) * height - BASELINE_DROP * fontSize}
    >
      <div style={{ transform: `scale(${mag / PLANE_BASE})` }}>
        <div
          style={{
            perspective: PLANE_PERSPECTIVE * width,
            transformStyle: "preserve-3d",
          }}
        >
          <div
            style={{
              ...lineStyle(fontSize * PLANE_BASE, EYEBROW_TRACK, face),
              color: "#ffffff",
              transform: `rotateX(${rake}deg)`,
            }}
          >
            {text}
          </div>
        </div>
      </div>
    </Stage>
  );
}

// --- Shot 2: the eyebrow settles on the field -----------------------------

/**
 * The same word, flat, finishing the move the rush started: 1.530x down to rest
 * at 0.7605 per frame, then torn off to the left.
 *
 * The scale pivots on the baseline. The glyph rasteriser gives each origin
 * quarter-pixel precision horizontally and none at all vertically, so a scale
 * that moves the baseline makes the type climb the pixel grid in whole-pixel
 * jumps — sit still, jump, sit still. Pivot on the baseline and its device Y
 * never changes, so there is nothing to snap.
 *
 * The reference pivots ~24px higher than that, which is a different bug wearing
 * a nicer face, so the difference is paid as an explicit translate instead: the
 * measured vertical motion, with the pivot that renders correctly.
 */
const EYEBROW_ENTER = 0.53;
const EYEBROW_DECAY = 0.7605;
const EYEBROW_SPAN = 18;
/** Reference pivot, above the baseline, in ems of the eyebrow's own size. */
const PIVOT_LIFT = 23.87 / 41.6;

/**
 * The exit. Displacement runs -2.1, -6.7, -18, -56, -222px on frames 35 to 39 —
 * an exponential run-up at about 3x per frame, leftward, with the blur trail
 * left behind it on the right. It is a rigid translate: the cap height and the
 * baseline are unchanged on the last frame anyone can measure, so nothing
 * stretches and nothing scales.
 *
 * It is also staggered across the word at about a fifth of a frame per letter,
 * which is what makes it read as the word being *pulled* rather than sliding:
 * by frame 38 the "I" has travelled 56px and the "g" five and a half.
 */
const EXIT_FROM = 35;
const EXIT_BASE = 3.2;
const EXIT_STEP = 2.1 / REF_W;
const EXIT_LETTER_DELAY = 0.215;

function eyebrowExit(frame: number, letter: number, width: number): number {
  const t = frame - EXIT_FROM - letter * EXIT_LETTER_DELAY;
  if (t < 0) return 0;
  return -EXIT_STEP * width * EXIT_BASE ** t;
}

function EyebrowLine({
  text,
  frame,
  width,
  height,
  fontSize,
}: {
  text: string;
  frame: number;
  width: number;
  height: number;
  fontSize: number;
}) {
  const scale =
    1 +
    EYEBROW_ENTER *
      (1 - settle(frame - PLANE_OUT, EYEBROW_SPAN, EYEBROW_DECAY));
  const letters = [...text];
  return (
    <Line
      fontSize={fontSize}
      tracking={EYEBROW_TRACK}
      baseline={EYEBROW_BASELINE}
      height={height}
      style={{
        color: "#ffffff",
        display: "flex",
        transformOrigin: "50% 100%",
        transform: `translateY(${PIVOT_LIFT * fontSize * (scale - 1)}px) scale(${scale})`,
      }}
    >
      {letters.map((ch, i) => (
        // Letters are positional slots, not identities — a repeated letter must
        // still carry its own place in the stagger.
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: positional slot
          key={i}
          style={{ transform: `translateX(${eyebrowExit(frame, i, width)}px)` }}
        >
          {ch}
        </span>
      ))}
    </Line>
  );
}

// --- Shot 3: the title assembles ------------------------------------------

/**
 * Each word of the title slides in from the right into a slot that is already
 * laid out and centred — the words never push each other around. All three
 * close their gap at the same 0.82 per frame, but the lead word travels 1.63x
 * as far as the two behind it, and the three are genuinely independent: on one
 * measured frame they move -2.4px, -4.6px and -22.2px.
 *
 * Each word also *pops* in at 29-46% opacity rather than fading from nothing,
 * and eases to full at 0.79 per frame. The chromaticity of the deficit is
 * constant the whole way, so it is alpha of the final violet — not a grey, not
 * a lighter hue.
 *
 * There is no motion blur on this shot. A word covers 27px between its first
 * two frames and is still crisp.
 */
const TITLE_DECAY = 0.82;
const TITLE_SPAN = 30;
const TITLE_ALPHA_DECAY = 0.79;
/** Per word: [frame it appears, px it starts to the right, opacity it pops in at]. */
const TITLE_ENTRY: readonly (readonly [number, number, number])[] = [
  [41, 143, 0.39],
  [48, 87, 0.46],
  [54, 88, 0.29],
];

function TitleLine({
  words,
  frame,
  width,
  height,
  fontSize,
  color,
}: {
  words: string[];
  frame: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
}) {
  return (
    <Line
      fontSize={fontSize}
      tracking={TITLE_TRACK}
      baseline={TITLE_BASELINE}
      height={height}
      style={{ display: "flex", color }}
    >
      {words.map((word, i) => {
        // Words past the third reuse the trailing word's entry, spaced by the
        // same 6-frame stagger, so a longer title still assembles.
        const extra = Math.max(0, i - (TITLE_ENTRY.length - 1));
        const [at, travel, pop] = TITLE_ENTRY[i - extra];
        const t = frame - at - extra * 6;
        if (t < 0) return null;
        const x =
          ((travel * width) / REF_W) * (1 - settle(t, TITLE_SPAN, TITLE_DECAY));
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: positional slot
            key={i}
            style={{
              opacity: 1 - (1 - pop) * TITLE_ALPHA_DECAY ** t,
              transform: `translateX(${x}px)`,
            }}
          >
            {i === 0 ? word : ` ${word}`}
          </span>
        );
      })}
    </Line>
  );
}

// --- The closing ground ---------------------------------------------------

/**
 * Both closing shots share one ground: a flat near-black navy with a single
 * broad glow sitting low and centre. Fitted against an 81-point grid, the worst
 * error is 2.4/255 — there is no second glow, no red component and no motion.
 * The apparently different ground under the macro shot is this same glow seen
 * at that shot's magnification.
 */
function nightGround(glow: string, strength: number): string {
  const [r, g, b] = hexToRgb(glow);
  return `radial-gradient(circle ${((500 / REF_W) * 100).toFixed(
    1,
  )}% at 50% 68%, rgba(${r},${g},${b},${strength}), transparent)`;
}

// --- Shot 4: the macro pan ------------------------------------------------

/**
 * A macro shot of the closing line's middle, panning left. The velocity is a
 * settle and a launch overlapping — it decelerates from 52px/frame to 9 at the
 * hold, then accelerates away to 105 by the last frame — and integrating that
 * pair of exponentials is what places the type.
 *
 * The star crosses the other way at the same speed, which is the whole reason
 * this is a separate composition rather than a magnified frame of the closing
 * shot: at this magnification the closing shot's star would be six frame widths
 * off to the right.
 */
const MACRO_SIZE = 487 / REF_W;
const MACRO_BASELINE = 347 / REF_H;
const MACRO_HOLD = 90;
/** ∫16.6·0.81^t and ∫1.37·1.255^t, the fitted settle and launch. */
function macroPan(frame: number): number {
  const t = frame - MACRO_HOLD;
  return -(78.8 * (1 - 0.81 ** t) + 6.03 * (1.255 ** t - 1));
}
/**
 * Where along the line the frame centre sits at the hold, as a fraction of the
 * line rather than a pixel offset — the reference holds on the middle of its
 * sentence, and a pixel offset would land mid-word on any other one.
 */
const MACRO_ANCHOR = 0.505;
const MACRO_STAR_AT_HOLD = 565 / REF_W;
const MACRO_STAR_SIZE = 1.255;
const MACRO_STAR_SPIN = 2.9;
/** The mark crosses the other way at the same speed, and rides low. */
const MACRO_STAR_Y = 60 / REF_H;
/** The giant mark spends its ramp over two thirds of itself, so both tips
 *  reach full saturation inside the frame instead of holding at the midpoint. */
const MACRO_STAR_SPREAD = 0.55;

function MacroShot({
  tagline,
  symbol,
  frame,
  width,
  height,
}: {
  tagline: string;
  symbol: SymbolStyle;
  frame: number;
  width: number;
  height: number;
}) {
  const face = useSnapCnTheme().fontFamily ?? SANS;
  const pan = (macroPan(frame) * width) / REF_W;
  const fontSize = MACRO_SIZE * width;
  return (
    <>
      <Stage
        align="flex-start"
        offset={(MACRO_BASELINE - 0.5) * height - BASELINE_DROP * fontSize}
      >
        <div
          style={{
            ...lineStyle(fontSize, TAGLINE_TRACK, face),
            color: "#ffffff",
            // The percentage is of the line's own width, so the hold lands on
            // the same part of any sentence; the px is the camera.
            transform: `translateX(${width / 2 + pan}px) translateX(${-MACRO_ANCHOR * 100}%)`,
          }}
        >
          {tagline}
        </div>
      </Stage>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            transform: `translate(${(MACRO_STAR_AT_HOLD - 0.5) * width - pan}px, ${MACRO_STAR_Y * height}px)`,
          }}
        >
          <Mark
            path={symbol.path}
            colors={symbol.colors}
            size={MACRO_STAR_SIZE * symbol.scale * width}
            width={width}
            rotation={MACRO_STAR_SPIN * (frame - MACRO_HOLD) - 50}
            spread={MACRO_STAR_SPREAD}
            id="announce-title-macro-symbol"
          />
        </div>
      </AbsoluteFill>
    </>
  );
}

// --- Shot 5: the closing line ---------------------------------------------

/**
 * The line arrives whole-word at a time from the right end backwards, while the
 * group slides right into place at 0.792 per frame. Words do not fade: each one
 * is simply there, at full opacity, on its frame.
 *
 * The colour is one gradient fixed in the line's own coordinates — crimson at
 * the left end, blue at the right — with a white wipe crossing it left to right
 * at 31.7px/frame. That the tint is fixed to the *text* and the wipe is fixed to
 * the *clock* is the measurable part: a column 131px ahead of the wipe reads
 * violet on one frame and blue on another, so neither can be keyed to the other.
 *
 * The word that appears last is already white, because the wipe crossed its
 * ground four frames before it existed.
 */
const TAGLINE_TRAVEL = 417 / REF_W;
const TAGLINE_DECAY = 0.792;
const TAGLINE_SPAN = 30;
// Half a frame early, so every word crosses its threshold on the frame the
// reference shows it rather than the one after.
const TAGLINE_FIRST = 111.5;
const TAGLINE_STAGGER = 2.833;
/** Ink extent of the settled line, in reference px — the wipe's coordinates. */
const TAGLINE_INK = 693;
const WIPE_START = 124.6;
const WIPE_SPEED = 31.7 / TAGLINE_INK;
const WIPE_EDGE = 165 / TAGLINE_INK;

/** The tint, measured across the settled line and read as line-local stops. */
const TINT_RAMP: readonly (readonly [number, string])[] = [
  [0, "#8a2447"],
  [0.24, "#842647"],
  [0.33, "#722e57"],
  [0.5, "#58406d"],
  [0.66, "#434e90"],
  [0.76, "#3654ab"],
  [0.85, "#2f5ed1"],
  [1, "#3266e5"],
];

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * The tint and the wipe as one paint. Two stacked layers would need the tint
 * layer masked by the wipe, and a mask on `background-clip: text` is a second
 * clip the renderer has to resolve per frame; a dozen interpolated stops is one
 * paint and costs nothing.
 */
function taglineFill(front: number, rest: string): string {
  const [rr, rg, rb] = hexToRgb(rest);
  const stops: string[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const p = i / n;
    let below = TINT_RAMP[0];
    let above = TINT_RAMP[TINT_RAMP.length - 1];
    for (let j = 1; j < TINT_RAMP.length; j++) {
      if (p <= TINT_RAMP[j][0]) {
        below = TINT_RAMP[j - 1];
        above = TINT_RAMP[j];
        break;
      }
    }
    const span = above[0] - below[0];
    const local = span > 0 ? (p - below[0]) / span : 0;
    const [r0, g0, b0] = hexToRgb(below[1]);
    const [r1, g1, b1] = hexToRgb(above[1]);
    const drained = clamp01((front - p) / WIPE_EDGE + 0.5);
    const mix = (a: number, b: number, target: number) =>
      Math.round((a + (b - a) * local) * (1 - drained) + target * drained);
    stops.push(
      `rgb(${mix(r0, r1, rr)},${mix(g0, g1, rg)},${mix(b0, b1, rb)}) ${(p * 100).toFixed(1)}%`,
    );
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

/** The star's own travel and exit, both measured on its centre and its radius. */
const STAR_REST_X = 781.4 / REF_W;
const STAR_REST_Y = 227 / REF_H;
const STAR_SIZE = 60 / REF_W;
/**
 * The mark barely turns: it arrives a touch off square and squares up as it
 * settles. An earlier read of a full 270° spin was the 4-fold symmetry fooling
 * a harmonic fit — every frame of the reference has its red tip up.
 */
const STAR_TURN = 30;
const STAR_EXIT = 134;
const STAR_GONE = 139;

function ClosingShot({
  words,
  symbol,
  frame,
  width,
  height,
  fontSize,
  rest,
}: {
  words: string[];
  symbol: SymbolStyle;
  frame: number;
  width: number;
  height: number;
  fontSize: number;
  rest: string;
}) {
  const slide =
    -TAGLINE_TRAVEL *
    width *
    (1 - settle(frame - MACRO_OUT, TAGLINE_SPAN, TAGLINE_DECAY));
  const front = WIPE_SPEED * (frame - WIPE_START);
  const starLife = 1 - clamp01((frame - STAR_EXIT) / (STAR_GONE - STAR_EXIT));
  return (
    <>
      <Line
        fontSize={fontSize}
        tracking={TAGLINE_TRACK}
        baseline={TAGLINE_BASELINE}
        height={height}
        style={{
          display: "flex",
          transform: `translateX(${slide}px)`,
          backgroundImage: taglineFill(front, rest),
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
        }}
      >
        {words.map((word, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: positional slot
            key={i}
            style={{
              visibility:
                frame >=
                TAGLINE_FIRST + (words.length - 1 - i) * TAGLINE_STAGGER
                  ? "visible"
                  : "hidden",
            }}
          >
            {i === 0 ? word : ` ${word}`}
          </span>
        ))}
      </Line>
      {starLife > 0 && (
        <Stage offset={(STAR_REST_Y - 0.5) * height}>
          <div
            style={{
              transform: `translateX(${(STAR_REST_X - 0.5) * width + slide}px) scale(${starLife})`,
              opacity: starLife,
            }}
          >
            <Mark
              path={symbol.path}
              colors={symbol.colors}
              size={STAR_SIZE * symbol.scale * width}
              width={width}
              rotation={
                -STAR_TURN *
                (1 - settle(frame - MACRO_OUT, TAGLINE_SPAN, TAGLINE_DECAY))
              }
              id="announce-title-symbol"
            />
          </div>
        </Stage>
      )}
    </>
  );
}

// --- The piece ------------------------------------------------------------

export function AnnounceTitle({
  eyebrow = "Introducing",
  title = "snapcn 1.0",
  tagline = "Ready-made scenes for Remotion, in one command.",
  voidColor = "#100022",
  fieldColor = "#5600f5",
  paperColor = "#fcfcfa",
  titleColor = "#4800c9",
  nightColor = "#000028",
  glowColor = "#08ff4b",
  glowStrength = 0.139,
  taglineColor = "#f2f8ff",
  symbolPath = MARK_PATH,
  symbolColors,
  symbolScale = 1,
  fontFamily,
  speed = 1,
}: AnnounceTitleProps) {
  const face = resolveFont(fontFamily) ?? SANS;
  const frame = useCurrentFrame() * speed;
  const { width, height } = useVideoConfig();

  const symbol: SymbolStyle = {
    path: symbolPath,
    colors: symbolColorList(symbolColors),
    scale: symbolScale,
  };
  const titleWords = title.split(/\s+/).filter(Boolean);
  const taglineWords = tagline.split(/\s+/).filter(Boolean);

  // Widest each line may draw, as a share of the frame. The eyebrow's is the
  // tightest because it enters at 1.53x, so its resting width is what has to
  // leave room; the tagline's sits just above the reference's own 0.864, so the
  // sentence everything was measured against is never scaled at all.
  const { probes, scales } = useFitScales([
    {
      text: eyebrow,
      fontSize: EYEBROW_SIZE * width,
      tracking: EYEBROW_TRACK,
      maxWidth: 0.55 * width,
    },
    {
      text: title,
      fontSize: TITLE_SIZE * width,
      tracking: TITLE_TRACK,
      maxWidth: 0.8 * width,
    },
    {
      text: tagline,
      fontSize: TAGLINE_SIZE * width,
      tracking: TAGLINE_TRACK,
      maxWidth: 0.88 * width,
    },
  ]);
  const eyebrowSize = EYEBROW_SIZE * width * scales[0];
  const titleSize = TITLE_SIZE * width * scales[1];
  const taglineSize = TAGLINE_SIZE * width * scales[2];

  const shot = () => {
    if (frame < PLANE_OUT) {
      return (
        <AbsoluteFill style={{ backgroundColor: voidColor }}>
          {/* A full-frame shutter, sampled twenty times: by the last frames the
              outer letters cover 90px between one frame and the next, and at ten
              samples that is a row of ghosts rather than a streak. */}
          <Shutter frame={frame} samples={20} open={1}>
            {(f) => (
              <RecedingPlane
                text={eyebrow}
                frame={f}
                width={width}
                height={height}
                fontSize={eyebrowSize}
              />
            )}
          </Shutter>
        </AbsoluteFill>
      );
    }

    if (frame < FIELD_OUT) {
      // The exit covers 200px on its last frame; sampled at a film shutter that
      // is a row of ghosts, so the sample count follows the distance travelled.
      const travel = Math.abs(eyebrowExit(frame, 0, width));
      return (
        <AbsoluteFill style={{ backgroundColor: fieldColor }}>
          <Shutter
            frame={frame}
            samples={Math.min(44, Math.max(6, travel / 4))}
            open={travel > 0 ? 1 : 0.5}
          >
            {(f) => (
              <EyebrowLine
                text={eyebrow}
                frame={f}
                width={width}
                height={height}
                fontSize={eyebrowSize}
              />
            )}
          </Shutter>
        </AbsoluteFill>
      );
    }

    if (frame < PAPER_OUT) {
      return (
        <AbsoluteFill style={{ backgroundColor: paperColor }}>
          <TitleLine
            words={titleWords}
            frame={frame}
            width={width}
            height={height}
            fontSize={titleSize}
            color={titleColor}
          />
        </AbsoluteFill>
      );
    }

    return (
      <AbsoluteFill
        style={{
          backgroundColor: nightColor,
          backgroundImage: nightGround(glowColor, glowStrength),
        }}
      >
        {frame < MACRO_OUT ? (
          <MacroShot
            tagline={tagline}
            symbol={symbol}
            frame={frame}
            width={width}
            height={height}
          />
        ) : (
          <ClosingShot
            words={taglineWords}
            symbol={symbol}
            frame={frame}
            width={width}
            height={height}
            fontSize={taglineSize}
            rest={taglineColor}
          />
        )}
      </AbsoluteFill>
    );
  };

  return (
    <SnapCnUIProvider theme={{ fontFamily: face }}>
      <AbsoluteFill>
        {probes}
        {shot()}
      </AbsoluteFill>
    </SnapCnUIProvider>
  );
}
