"use client";

import { loadFont as loadSans } from "@remotion/google-fonts/Inter";
import {
  AbsoluteFill,
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
// The reference recording is 810×458 — near enough 16:9 — and every number
// below was read off its frames, so there is no second conversion to get wrong.
// `stageScale` fits this rectangle into whatever composition it is given.

const REF_W = 810;
const REF_H = 458;

// --- Measured timeline, in seconds -----------------------------------------

/** Per-word entrance: it arrives 22% large and 4.3px soft, and lands in 140ms. */
const WORD_DUR = 0.14;
const WORD_SCALE = 1.216;
const WORD_BLUR = 4.3;
/** Exit: the line recedes to 0.80, blurs to 6.5px and goes. */
const EXIT_DUR = 0.34;
const EXIT_SCALE = 0.8;
const EXIT_BLUR = 6.5;

/** The entrance eases hard out — half the distance in the first quarter. */
const WORD_EASE = Easing.out(Easing.quad);

// --- Pure helpers (unit-tested) --------------------------------------------

/**
 * The pull-back, as a plain linear scale on the whole tile field.
 *
 * This is the measurement the whole component hangs off. Every tile in the
 * reference shrinks at the *same relative rate* — fit its on-screen size against
 * time and you get a straight line, and dividing that slope by the tile's own
 * size gives 0.176 per second for all seven tiles that are on screen long enough
 * to fit (spread: ±0.0016). Not a perspective dolly — `1/size` is visibly not
 * linear — just one linear scale over a field that is much bigger than the frame.
 */
export function pullbackScale(t: number, rate: number, floor = 0.02): number {
  return Math.max(floor, 1 - rate * t);
}

export interface DriftTile {
  /** One to three characters, set large — a mark, not a paragraph. */
  glyph: string;
  /** Optional word under the glyph, for tiles big enough to carry one. */
  label?: string;
  background: string;
  color?: string;
  /** Position at t=0, in stage px from the centre, before the pull-back. */
  x: number;
  y: number;
  /** Edge length at t=0, in stage px, before the pull-back. */
  size: number;
  /** Constant drift, in stage px per second. */
  vx?: number;
  vy?: number;
  /** Seconds at which it starts fading up. */
  at?: number;
  /** Corner radius as a fraction of the tile's edge. Defaults to `tileRadius`. */
  radius?: number;
}

export interface PlacedTile {
  left: number;
  top: number;
  size: number;
  opacity: number;
}

/**
 * Where a tile is, how big, and how far up its fade has got.
 *
 * The field drifts *and* the camera pulls back, and those are two different
 * things: `x + vx·t` is where the tile has got to in the field, and the scale
 * outside it is the camera. Fitted that way, six of the reference's seven
 * long-lived tiles land within **0.3–1.0px per frame across their whole path**;
 * a static field (no drift) misses by 32px, and a perspective dolly cannot
 * produce a size that falls linearly at all.
 */
export function placeTile(
  tile: DriftTile,
  t: number,
  o: { rate: number; fade: number; speed: number; scale: number },
): PlacedTile {
  const k = pullbackScale(t, o.rate);
  const wx = tile.x + (tile.vx ?? 0) * o.speed * t;
  const wy = tile.y + (tile.vy ?? 0) * o.speed * t;
  const size = k * tile.size * o.scale;
  const age = t - (tile.at ?? 0);
  // An exponential approach, not a ramp: the reference's tiles are ~50% up
  // 280ms after they appear and still creeping toward 1 a second later, which
  // is the shape a `1 − e^(−age/τ)` gives and no linear fade does.
  const opacity = age <= 0 ? 0 : 1 - Math.exp(-age / Math.max(1e-3, o.fade));
  return {
    left: REF_W / 2 + k * wx - size / 2,
    top: REF_H / 2 + k * wy - size / 2,
    size,
    opacity,
  };
}

export interface WordState {
  scale: number;
  blur: number;
  opacity: number;
}

/**
 * A word's entrance, and the whole line's exit, in one place.
 *
 * The entrance is **not** a fade. Measure the ink and it is conserved from the
 * first frame the word exists — what changes is that it is 1.216× too big and
 * carrying 4.3px of blur, both of which resolve in 140ms. Words land every
 * 150ms, so each one finishes exactly as the next begins.
 */
export function wordState(
  t: number,
  index: number,
  o: {
    at: number;
    stagger: number;
    dur: number;
    scale: number;
    blur: number;
    exitAt: number;
    exitDur: number;
    exitScale: number;
    exitBlur: number;
  },
): WordState {
  const start = o.at + index * o.stagger;
  if (t < start) return { scale: o.scale, blur: o.blur, opacity: 0 };
  const p = interpolate(t, [start, start + o.dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: WORD_EASE,
  });
  const q = interpolate(t, [o.exitAt, o.exitAt + o.exitDur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return {
    scale: (o.scale + (1 - o.scale) * p) * (1 + (o.exitScale - 1) * q),
    blur: o.blur * (1 - p) + o.exitBlur * q,
    opacity: 1 - q,
  };
}

// --- Content ---------------------------------------------------------------

/**
 * The default field: the stack a snapcn component drops into.
 *
 * Positions, sizes, drifts and entry times are the ones fitted to the reference
 * recording, so the choreography is the measured one. The **labels and the paint
 * are ours** — a component that ships to strangers has no business carrying
 * somebody else's marks, and a wordmark tile says "works with this" without
 * borrowing a logo to say it.
 */
export const SNAPCN_STACK: DriftTile[] = [
  {
    glyph: "Rm",
    label: "Remotion",
    background: "#1f2430",
    color: "#ffffff",
    x: 163,
    y: 232,
    vx: -54,
    vy: 12,
    size: 109,
    at: 0.28,
  },
  {
    glyph: "sh",
    label: "shadcn/ui",
    background: "#f2f4f7",
    color: "#16181d",
    x: 128,
    y: -209,
    vx: 81,
    vy: 32,
    size: 122,
    at: 0.48,
  },
  {
    glyph: "Re",
    label: "React",
    background: "#10131a",
    color: "#7dd3fc",
    x: -384,
    y: 344,
    vx: -27,
    vy: -68,
    size: 200,
    at: 0.95,
  },
  {
    glyph: "N",
    label: "Next.js",
    background: "#e7e8ea",
    color: "#16181d",
    x: 519,
    y: 45,
    vx: -31,
    vy: 64,
    size: 144,
    at: 1.51,
  },
  {
    glyph: "tw",
    label: "Tailwind",
    background: "#f1ece2",
    color: "#8a5a2b",
    x: -692,
    y: -125,
    vx: 41,
    vy: -71,
    size: 214,
    at: 1.55,
  },
  {
    glyph: "Fg",
    label: "Figma",
    background: "#2b3a36",
    color: "#ffffff",
    x: -350,
    y: -339,
    vx: 65,
    vy: -26,
    size: 188,
    at: 1.75,
  },
  {
    glyph: "Mo",
    label: "Motion",
    background: "#f4703a",
    color: "#ffffff",
    x: 672,
    y: -277,
    vx: 2,
    vy: 81,
    size: 256,
    at: 1.76,
  },
  {
    glyph: "TS",
    label: "TypeScript",
    background: "#2f6fdb",
    color: "#ffffff",
    x: -721,
    y: 211,
    vx: 9,
    vy: -84,
    size: 215,
    at: 2.06,
  },
  {
    glyph: "▲",
    label: "Vercel",
    background: "#0b0b0d",
    color: "#ffffff",
    x: 676,
    y: 348,
    vx: -65,
    vy: 52,
    size: 244,
    at: 2.48,
  },
];

// --- Props -----------------------------------------------------------------

export interface LogoDriftProps {
  /** The line that writes itself, one word at a time. */
  headline?: string;
  /** The field. Positions are stage px from the centre, before the pull-back. */
  tiles?: DriftTile[];

  // --- Motion, in seconds and per-second rates. ---
  /** How fast the camera pulls back, as a fraction of scale per second. */
  pullback?: number;
  /** Multiplies every tile's drift, and every tile's size. */
  tileSpeed?: number;
  tileScale?: number;
  /** Time constant of a tile's fade-up. */
  tileFade?: number;
  /** Corner radius as a fraction of a tile's edge. */
  tileRadius?: number;

  /** When the first word lands, and the gap between words. */
  wordAt?: number;
  wordStagger?: number;
  /** How long one word takes to land, and what it arrives as. */
  wordDuration?: number;
  wordScale?: number;
  wordBlur?: number;

  /** When the line leaves, over how long, and what it leaves as. */
  exitAt?: number;
  exitDuration?: number;
  exitScale?: number;
  exitBlur?: number;

  // --- Size and paint. ---
  /** Headline type size, in stage px. */
  fontSize?: number;
  fontWeight?: number;
  /** Glyph size inside a tile, as a fraction of its edge. */
  glyphScale?: number;
  /** Show the soft wash behind the headline, and what colour it is. */
  glow?: boolean;
  glowColor?: string;
  glowOpacity?: number;
  /** Accent used for the wash when `glowColor` is not given. */
  accentColor?: string;
  theme?: Partial<SnapCnTheme>;
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
  speed?: number;
}

// --- Main composition ------------------------------------------------------

/**
 * A field of tiles drifting past a headline while the camera pulls steadily
 * back, so the wall of things-it-works-with keeps arriving from every edge.
 *
 * ## Three measurements, and they are the component
 *
 * **The pull-back is one linear scale.** Every tile in the reference shrinks at
 * the same *relative* rate: fit on-screen size against time and it is a straight
 * line, and dividing the slope by the tile's own size gives **0.176 per second**
 * for every tile long enough to fit, to ±0.0016. It is not a perspective dolly —
 * under perspective `1/size` would be the straight line and it plainly is not.
 *
 * **The field drifts under it.** Take the scale out and each tile's path becomes
 * a straight world-line to within a pixel: a constant velocity, ~80 stage px per
 * second, in its own direction. Model it as a static field and you are 32px out;
 * model the drift and six of the seven fitted tiles land within **0.3–1.0px per
 * frame over their whole path**.
 *
 * **The words do not fade in.** Measure the ink and it is conserved from the
 * first frame a word exists. What resolves is 1.216× of scale and 4.3px of blur,
 * in 140ms, one word every 150ms — so each lands exactly as the next starts. The
 * line is centre-set, so the words already placed slide left to make room.
 *
 * ## What is not measured
 *
 * The labels and the paint. The reference is a specific product showing off a
 * specific set of other people's logos; none of that belongs in a component that
 * ships to strangers (design-system rule 5). The default field is the stack a
 * snapcn component actually drops into, drawn as wordmark tiles rather than
 * borrowed marks, and every tile — glyph, label, colour, position, drift, entry
 * — is a prop.
 */
export function LogoDrift({
  headline = "Built for the stack you already use.",
  tiles = SNAPCN_STACK,
  pullback = 0.1762,
  tileSpeed = 1,
  tileScale = 1,
  tileFade = 0.4,
  tileRadius = 0.02,
  wordAt = 0.017,
  wordStagger = 0.15,
  wordDuration = WORD_DUR,
  wordScale = WORD_SCALE,
  wordBlur = WORD_BLUR,
  exitAt = 3.13,
  exitDuration = EXIT_DUR,
  exitScale = EXIT_SCALE,
  exitBlur = EXIT_BLUR,
  fontSize = 20,
  fontWeight = 500,
  glyphScale = 0.34,
  glow = true,
  glowColor,
  glowOpacity = 0.07,
  accentColor,
  theme,
  mode,
  fontFamily,
  speed = 1,
}: LogoDriftProps) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily ?? t.fontFamily) ?? SANS;
  const accent = accentColor ?? t.primary;
  const wash = glowColor ?? accent;

  const now = (frame * speed) / fps;
  const stageScale = Math.min(width / REF_W, height / REF_H);

  const words = headline.split(/\s+/).filter(Boolean);
  const isRendering = getRemotionEnvironment().isRendering;
  const willChange = isRendering ? undefined : ("transform, filter" as const);

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
        {/* The wash. Static — it does not move, breathe or follow the pull-back
            on the reference, and a glow that animates under a headline reads as
            a mistake rather than as light. Painted from the installer's accent
            at a few percent, because at this strength it is a tint, not a shape:
            the peak is seven luminance levels off the page. */}
        {glow ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: REF_W,
              height: REF_H,
              background: `radial-gradient(${0.45 * REF_W}px ${0.34 * REF_H}px at 50% 49%, ${withAlpha(wash, glowOpacity)} 0%, transparent 74%)`,
            }}
          />
        ) : null}

        {/* ---- The field */}
        {tiles.map((tile) => {
          const p = placeTile(tile, now, {
            rate: pullback,
            fade: tileFade,
            speed: tileSpeed,
            scale: tileScale,
          });
          if (p.opacity <= 0.002 || p.size < 1) return null;
          const fg = tile.color ?? t.background;
          return (
            <div
              key={`${tile.glyph}-${tile.x}-${tile.y}`}
              style={{
                position: "absolute",
                left: p.left,
                top: p.top,
                width: p.size,
                height: p.size,
                borderRadius: p.size * (tile.radius ?? tileRadius),
                background: tile.background,
                opacity: p.opacity,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: p.size * 0.04,
                color: fg,
                fontFamily: face,
                overflow: "hidden",
                willChange,
              }}
            >
              <span
                style={{
                  fontSize: p.size * glyphScale,
                  fontWeight: 600,
                  lineHeight: 1,
                  letterSpacing: "-0.03em",
                  textRendering: "geometricPrecision",
                }}
              >
                {tile.glyph}
              </span>
              {tile.label && p.size > 74 ? (
                <span
                  style={{
                    fontSize: p.size * 0.1,
                    fontWeight: 500,
                    lineHeight: 1,
                    opacity: 0.72,
                    textRendering: "geometricPrecision",
                  }}
                >
                  {tile.label}
                </span>
              ) : null}
            </div>
          );
        })}

        {/* ---- The headline. Above the field: a wall of logos that crosses the
            one line the viewer is meant to read is a wall of logos that has won
            an argument it should not have been in. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: REF_W,
            height: REF_H,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "center",
              gap: fontSize * 0.28,
              fontFamily: face,
              fontSize,
              fontWeight,
              lineHeight: 1.2,
              letterSpacing: "-0.012em",
              color: t.foreground,
              whiteSpace: "pre",
              textRendering: "geometricPrecision",
            }}
          >
            {words.map((word, i) => {
              const w = wordState(now, i, {
                at: wordAt,
                stagger: wordStagger,
                dur: wordDuration,
                scale: wordScale,
                blur: wordBlur,
                exitAt,
                exitDur: exitDuration,
                exitScale,
                exitBlur,
              });
              return (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: words in a headline repeat, so the index is what makes each key unique
                  key={`${word}-${i}`}
                  style={{
                    display: "inline-block",
                    opacity: w.opacity,
                    transform: `scale(${w.scale})`,
                    filter: w.blur > 0.02 ? `blur(${w.blur}px)` : undefined,
                    willChange,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** Kept for callers that want the accent-tinted tile default without a theme. */
export const driftTileTint = (t: SnapCnTheme, amount: number): string =>
  mixOklch(t.card, t.primary, amount);
