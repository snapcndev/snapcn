"use client";

import type { CSSProperties } from "react";
import {
  Easing,
  getRemotionEnvironment,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";

/**
 * A "reel collage": a photo cuts through a quick reel between two captions and
 * slowly zooms, then shuts like an eyelid — the frame closes to a hairline while
 * the captions fold into one stacked line. The copy swaps, the lines split
 * apart, and a scattered collage of the same kind of pictures blooms in around
 * them on a peach flush.
 *
 * Replicated from a 2.6s reference recording. Every curve below was fitted on
 * the recording's own timestamps, not eyeballed: the geometry is in reference
 * pixels (`REF_W` wide) and scales with the frame, the timing is in frames at
 * 30fps.
 *
 * The ground is a painted world rather than a surface — a warm page, a mint
 * glow and a peach flush — so like `announce-title` every one of its colours is
 * a prop. The type is the theme's `foreground`.
 */

export interface ReelCollageProps {
  /** Caption above the reel. */
  topLine?: string;
  /** Caption below the reel. */
  bottomLine?: string;
  /** The first line after the swap — drifts up and left into the collage. */
  swapTop?: string;
  /** The second line after the swap — drifts down and right. */
  swapBottom?: string;
  /** The reel, in cut order. Eight shots; the last is the one that shuts. */
  slides?: string[];
  /**
   * The collage, six pictures, in `COLLAGE` slot order: left, centre, top
   * right, bottom left, bottom right, and the centre-right one on top of it.
   */
  collage?: string[];
  /** The page. */
  background?: string;
  /** The soft glow the whole scene sits on. */
  glowColor?: string;
  /** The flush that rises around the edges as the collage blooms in. */
  flushColor?: string;
  /** Caption ink. Defaults to the theme's `foreground`. */
  textColor?: string;
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
  className?: string;
}

const FONT_FAMILY =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/** snapcn's own scenes, as stills. Absolute, because a root-relative default
 *  becomes `staticFile()` in a render and 404s in the project this file was
 *  just copied into. Pass your own — root-relative or remote, both resolve. */
const POSTER = (slug: string) =>
  `https://snapcn.dev/demos/posters/${slug}.webp`;
const DEFAULT_SLIDES = [
  "orbit-gallery",
  "card-rail",
  "logo-flicker",
  "laptop-frame",
  "count-grid",
  "status-cycle",
  "moodboard-reveal",
  "announce-title",
].map(POSTER);
const DEFAULT_COLLAGE = [
  "phone-frame",
  "terminal-simulator",
  "roster-grant",
  "channel-thread",
  "hero-launch",
  "follower-rush",
].map(POSTER);

// ─── Geometry, in reference pixels ────────────────────────────────────────────
/** The reference frame's width. Every length below is a fraction of it. */
export const REF_W = 712;

/** Caption type: its size at zoom 1, and the tracking the reference sets it at. */
export const FONT_SIZE = 19.22;
export const LETTER_SPACING = "-0.068em";

/** The reel's frame at zoom 1. */
export const BOX_W = 282.08;

/**
 * Caption baselines, relative to the page centre, at zoom 1: open around the
 * reel, and folded into one stacked pair once the reel has shut.
 */
export const CAPTION_OPEN = { top: -110.07, bottom: 125.53 } as const;
export const CAPTION_SHUT = { top: -5.44, bottom: 13.75 } as const;

/** The swapped pair starts this far left of centre, then drifts apart. */
const SWAP_DX = -1.9;
/** Where the swapped lines come to rest: ink centre x, baseline y. */
export const SWAP_REST = {
  top: { x: -71.0, y: -94.6 },
  bottom: { x: 41.0, y: 104.6 },
} as const;

/**
 * The collage: each picture's resting centre, size, and the scale it blooms
 * from. The centre picture starts smaller — it opens out of the gap the lines
 * leave behind. Listed bottom to top: the right-hand pair overlap, 5 over 4.
 */
export const COLLAGE = [
  { x: -195.5, y: -38.5, w: 105, h: 117, from: 0.616 },
  { x: -66.5, y: -1, w: 141, h: 96, from: 0.425 },
  { x: 106.5, y: -91.5, w: 161, h: 107, from: 0.554 },
  { x: -153, y: 108, w: 150, h: 102, from: 0.644 },
  { x: 200, y: 97.5, w: 142, h: 97, from: 0.61 },
  { x: 81.5, y: 27.5, w: 139, h: 97, from: 0.601 },
] as const;

/** The glow and the flush: blurred rounded rectangles behind everything. */
const GLOW = { dx: 10.9, dy: 6.4, hw: 261.6, hh: 147, r: 128.4, blur: 36.2 };
const FLUSH = { dx: 4.4, dy: -4.2, hw: 301.8, hh: 151.5, r: 2, blur: 58.6 };

// ─── Timeline (frames @ 30fps) ────────────────────────────────────────────────
/** Frame each reel shot cuts in on. */
export const CUTS = [0, 3, 6, 10, 14, 19, 25, 29] as const;
/**
 * Each shot sits in the frame a little differently — its own aspect, a hair of
 * extra width (`k`), and its centre's offset from the page centre. Measured per
 * cut; ignoring it puts every cut up to 2px off where the reference lands it.
 */
const SHOTS = [
  { aspect: 1.505, k: 1.0004, dx: 0.47, dy: 0.1 },
  { aspect: 1.4788, k: 0.9982, dx: 0.78, dy: 0.09 },
  { aspect: 1.4832, k: 1.0038, dx: 1.67, dy: 1.16 },
  { aspect: 1.4561, k: 1.0009, dx: 1.59, dy: 0.93 },
  { aspect: 1.4573, k: 0.9999, dx: 1.8, dy: 0.84 },
  { aspect: 1.4505, k: 0.9988, dx: 1.92, dy: 1.3 },
  { aspect: 1.4465, k: 0.9984, dx: 1.8, dy: 1.14 },
  { aspect: 1.4465, k: 1, dx: 1.3, dy: -0.1 },
] as const;
/** The copy swaps on this frame, mid-way through the split. */
export const SWAP_AT = 46;

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * A fitted segment: `from → to` across `[start, end]` on a cubic-bezier. The
 * curves are sharp in-outs — slow to leave, one or two frames of real travel,
 * then a settle — which is what makes the shut read as a snap rather than a
 * slide. None of them freezes: the tails still move > 0.5px a frame at 1280.
 */
function seg(
  frame: number,
  [start, end]: readonly [number, number],
  [from, to]: readonly [number, number],
  bezier: readonly [number, number, number, number],
): number {
  return interpolate(frame, [start, end], [from, to], {
    ...CLAMP,
    easing: Easing.bezier(...bezier),
  });
}

/** Caption zoom — the type grows 17% across the reel. */
export const textZoom = (f: number) =>
  seg(f, [7.59, 37], [1, 1.1741], [0.9062, 0.1924, 0.4104, 1.0142]);
/** Reel zoom — the frame runs a little ahead of the type. */
export const boxZoom = (f: number) =>
  seg(f, [0.42, 54.55], [1, 1.1852], [0.8548, 0.3903, 0.0817, 1.1691]);
/** How open the reel is, 1 → 0. The eyelid. */
export const reelOpen = (f: number) =>
  seg(f, [18.71, 37.47], [1, 0], [0.8703, 0, 0.078, 1]);
/** How far apart the captions still are, 1 → 0. Lags the eyelid at the tail. */
export const captionsOpen = (f: number) =>
  seg(f, [18.4, 38], [1, 0], [0.8766, 0, 0.0413, 1]);
/** The swapped lines' split, 0 → 1. The lower line leaves first. */
export const splitTop = (f: number) =>
  seg(f, [43.69, 69.24], [0, 1], [0.9243, 0.1575, 0.1018, 0.781]);
export const splitBottom = (f: number) =>
  seg(f, [40.33, 69.32], [0, 1], [0.9897, 0, 0.1683, 0.7764]);
/** The collage drifts left as it blooms: x offset, reference px. */
export const collagePan = (f: number) =>
  seg(f, [46.66, 75.15], [57, 0], [0.8112, 0.3372, 0.0414, 0.6655]);
/** The collage's bloom, 0 → 1 — each picture from its own `from` scale to 1. */
export const collageBloom = (f: number) =>
  seg(f, [48.92, 73.18], [0, 1], [0.5174, -0.3347, 0.0854, 1]);
/** Collage fade-in: linear. The bottom-right picture trails the rest. */
export const collageOpacity = (f: number, slot: number) =>
  slot === 4
    ? interpolate(f, [50.74, 65.08], [0, 1], CLAMP)
    : interpolate(f, [50.14, 62.3], [0, 1], CLAMP);
/** The flush: up with the bloom, gone once it has landed. */
export const flushOpacity = (f: number) =>
  interpolate(f, [48, 56, 57.5, 73.5], [0, 1, 1, 0], CLAMP);

/** The reel shot on screen at `frame`. */
export const slideAt = (frame: number) =>
  CUTS.reduce<number>((k, cut, i) => (frame >= cut ? i : k), 0);

/** Rewrite root-relative assets through staticFile everywhere but the Player. */
function resolveSrc(src: string): string {
  const isLocal = src.startsWith("/") && !src.startsWith("//");
  if (!isLocal || getRemotionEnvironment().isPlayer) return src;
  // A value that already came out of staticFile() carries the static base
  // (`/static-<hash>/…`); running it through again would prefix it twice.
  const base = staticFile("_").slice(0, -2);
  if (base && src.startsWith(`${base}/`)) return src;
  try {
    return staticFile(src.replace(/^\/+/, ""));
  } catch {
    return src;
  }
}

const cover: CSSProperties = {
  width: "100%",
  height: "100%",
  // Preflight's `img { max-width: 100% }` collapses a box sized by its parent.
  maxWidth: "none",
  objectFit: "cover",
  display: "block",
};

export function ReelCollage({
  topLine = "The videos",
  bottomLine = "That you ship",
  swapTop = "Especially on",
  swapBottom = "Launch day",
  slides = DEFAULT_SLIDES,
  collage = DEFAULT_COLLAGE,
  background = "#f5f4f2",
  glowColor = "#dfe7e3",
  flushColor = "#fdc7bc",
  textColor,
  theme,
  mode,
  fontFamily,
  speed = 1,
  className,
}: ReelCollageProps) {
  const frame = useCurrentFrame() * speed;
  const { width, height } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily ?? t.fontFamily) ?? FONT_FAMILY;
  const ink = textColor ?? t.foreground;
  const u = width / REF_W;
  const cx = width / 2;
  const cy = height / 2;

  // ── Reel ──────────────────────────────────────────────────────────────────
  const slide = slideAt(frame);
  const shot = SHOTS[slide] ?? SHOTS[0];
  const open = reelOpen(frame);
  const boxW = BOX_W * shot.k * boxZoom(frame) * u;
  const fullH = boxW / shot.aspect;
  const boxH = fullH * open;
  const reelSrc = slides[slide % slides.length];

  // ── Captions ──────────────────────────────────────────────────────────────
  // Both lines scale by the same zoom, pivoted on their own baseline so the
  // baseline never climbs the pixel grid (motion-quality: "stuck" text).
  const zoom = textZoom(frame);
  const apart = captionsOpen(frame);
  const baseline = (openY: number, shutY: number) =>
    zoom * (openY * apart + shutY * (1 - apart));
  const swapped = frame >= SWAP_AT;
  const pTop = splitTop(frame);
  const pBottom = splitBottom(frame);
  const lines = [
    {
      text: swapped ? swapTop : topLine,
      x: (swapped ? SWAP_DX * (1 - pTop) : 0) + SWAP_REST.top.x * pTop,
      y:
        baseline(CAPTION_OPEN.top, CAPTION_SHUT.top) +
        (SWAP_REST.top.y - zoom * CAPTION_SHUT.top) * pTop,
    },
    {
      text: swapped ? swapBottom : bottomLine,
      x: (swapped ? SWAP_DX * (1 - pBottom) : 0) + SWAP_REST.bottom.x * pBottom,
      y:
        baseline(CAPTION_OPEN.bottom, CAPTION_SHUT.bottom) +
        (SWAP_REST.bottom.y - zoom * CAPTION_SHUT.bottom) * pBottom,
    },
  ];

  // ── Collage ───────────────────────────────────────────────────────────────
  const pan = collagePan(frame);
  const bloom = collageBloom(frame);
  const flush = flushOpacity(frame);
  const isRendering = getRemotionEnvironment().isRendering;

  const blob = (
    g: typeof GLOW,
    color: string,
    opacity: number,
  ): CSSProperties => ({
    position: "absolute",
    left: cx + (g.dx - g.hw) * u,
    top: cy + (g.dy - g.hh) * u,
    width: 2 * g.hw * u,
    height: 2 * g.hh * u,
    borderRadius: g.r * u,
    background: color,
    filter: `blur(${g.blur * u}px)`,
    opacity,
  });

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        backgroundColor: background,
        fontFamily: face,
      }}
    >
      {flush > 0 && <div style={blob(FLUSH, flushColor, flush)} />}
      <div style={blob(GLOW, glowColor, 1)} />

      {/* ── Reel: a centred window that shuts on a full-size picture ── */}
      {boxH > 0.01 && reelSrc && (
        <div
          style={{
            position: "absolute",
            left: cx + shot.dx * u - boxW / 2,
            top: cy + shot.dy * u - boxH / 2,
            width: boxW,
            height: boxH,
            overflow: "hidden",
          }}
        >
          {/* The picture keeps its open size; only the window closes on it. */}
          <Img
            src={resolveSrc(reelSrc)}
            style={{
              ...cover,
              position: "absolute",
              left: 0,
              top: (boxH - fullH) / 2,
              height: fullH,
            }}
          />
        </div>
      )}

      {/* ── Collage ── */}
      {COLLAGE.map((p, slot) => {
        const opacity = collageOpacity(frame, slot);
        const src = collage[slot % collage.length];
        if (opacity <= 0 || !src) return null;
        const scale = p.from + (1 - p.from) * bloom;
        return (
          <div
            key={`${p.x}-${p.y}`}
            style={{
              position: "absolute",
              left: cx + (p.x + pan - p.w / 2) * u,
              top: cy + (p.y - p.h / 2) * u,
              width: p.w * u,
              height: p.h * u,
              opacity,
              transform: `scale(${scale})`,
              ...(isRendering ? {} : { willChange: "transform" as const }),
            }}
          >
            <Img src={resolveSrc(src)} style={cover} />
          </div>
        );
      })}

      {/* ── Captions: SVG text, so `y` IS the baseline ── */}
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
        aria-hidden
      >
        {lines.map((l, i) => (
          <g
            // biome-ignore lint/suspicious/noArrayIndexKey: two fixed lines
            key={i}
            transform={`translate(${cx + l.x * u} ${cy + l.y * u}) scale(${zoom})`}
          >
            <text
              x={0}
              y={0}
              textAnchor="middle"
              fill={ink}
              style={{
                fontSize: FONT_SIZE * u,
                fontWeight: 500,
                letterSpacing: LETTER_SPACING,
                // Hinting re-snaps the stems at every size; the outline doesn't.
                textRendering: "geometricPrecision",
              }}
            >
              {l.text}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
