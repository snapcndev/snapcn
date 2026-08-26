"use client";

import type { CSSProperties } from "react";
import {
  Easing,
  getRemotionEnvironment,
  Img,
  interpolate,
  interpolateColors,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { type SnapCnTheme, useSnapCnTheme, withAlpha } from "@/lib/snap-cn-ui";

/**
 * A "moodboard reveal": a kinetic headline with a swapping inline image, then a
 * scattered gallery of image cards flies in, the camera pushes through it while
 * the background lifts from near-black to off-white, and it lands on a single
 * hero image. A camera-drives-through montage (see MOTION.md), replicated from a
 * reference reel and populated with the showcase assets.
 */

export interface MoodboardRevealProps {
  /** Text before the inline image. */
  leadIn?: string;
  /** The emphasised (bold) word right after the inline image. */
  emphasis?: string;
  /** Text after the emphasised word. */
  tailIn?: string;
  /** Image URLs for the gallery + the intro swap. First-served covers the slots. */
  images?: string[];
  /** The image the montage lands on. Defaults to `images[3]`. */
  heroImage?: string;
  /** Near-black start background. Defaults to the dark theme's `background`. */
  darkColor?: string;
  /** Off-white end background. Defaults to the light theme's `background`. */
  lightColor?: string;
  /**
   * Design-system token overrides. Applied to both ends of the crossfade —
   * this scene spans light and dark, so it takes no `mode`.
   */
  theme?: Partial<SnapCnTheme>;
  speed?: number;
  className?: string;
}

const FONT_FAMILY =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/** Sample images. Absolute, because a root-relative default becomes
 *  `staticFile()` in a render and 404s in the project this file was just
 *  copied into. Pass your own — root-relative or remote, both resolve. */
const DEFAULT_IMAGES = [
  "https://snapcn.dev/showcase-assets/438b9e6b50654a44d404fbf358c26e9f.webp",
  "https://snapcn.dev/showcase-assets/5e5305b05bd405a0d89570725434099e.webp",
  "https://snapcn.dev/showcase-assets/767d99bb371a54d0d36751e8cecae43c.jpg",
  "https://snapcn.dev/showcase-assets/821d815affa6496c39cbdeeec7a84603.jpg",
  "https://snapcn.dev/showcase-assets/937438c560ada1c83317f2c11b3454b0.jpg",
  "https://snapcn.dev/showcase-assets/98f89cb9994f5c382ab964062c4039db.jpg",
  "https://snapcn.dev/showcase-assets/b25b82db2892efff9be3204e860d30ee.jpg",
  "https://snapcn.dev/showcase-assets/c9ebc6337aa2268ac4b357f9cb1ac547.jpg",
];

// ─── Timeline (frames @ 30fps; ~5s to mirror the ~4.7s reference) ──────────────
// The sentence holds long enough that the last intro image lands and rests
// before it fades; the fade overlaps the first gallery positions appearing.
export const SENTENCE_OUT = 50;
export const COLLAGE_START = 46;
export const APPEAR_FRAMES = 12;
/** Each position swaps its image every `FLICKER_HOLD` frames — the shuffle. */
export const FLICKER_HOLD = 2;
/** The cluster orbits its centre from COLLAGE_START to here, sweeping ORBIT_DEG°. */
export const ORBIT_END = 88;
export const ORBIT_DEG = 130;
/** Then every position converges to the centre — the "merge into one". */
export const MERGE_START = 88;
// Fast collapse — the positions snap together, they don't drift in.
export const MERGE_END = 100;
export const BG_START = 88;
export const BG_END = 104;
/**
 * Every position collapses to this common width at the centre and un-rotates, so
 * the cards stack exactly on top of each other. They never fade — the topmost
 * card (the hero) simply covers the rest, so the merge *becomes* the one image.
 */
export const MERGE_W = 300;

/** Moderate decelerate — not quint/expo-out, which freeze on a frame clock. */
export const EASE = Easing.bezier(0.2, 0.6, 0.35, 1);
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const CARD_RATIO = 1.34; // portrait cards (~3:4)

/**
 * Gallery *positions* (offset from centre, width, tilt) — slots, not fixed
 * pictures. Each one flickers through the whole image set (see `flickerImage`).
 * Laid out as the spread moodboard the montage orbits and then collapses.
 */
export const SLOTS: ReadonlyArray<{
  x: number;
  y: number;
  w: number;
  rot: number;
}> = [
  { x: -401, y: -51, w: 188, rot: -5 },
  { x: -186, y: -191, w: 164, rot: 4 },
  { x: 44, y: -168, w: 214, rot: -2 },
  { x: 283, y: -79, w: 173, rot: 6 },
  { x: 377, y: 151, w: 169, rot: -4 },
  { x: -340, y: 179, w: 183, rot: 5 },
  { x: -101, y: 193, w: 214, rot: -3 },
  { x: 138, y: 193, w: 188, rot: 3 },
];

/** The cluster's orbit angle (degrees) at `frame`. */
export function orbitAngle(frame: number): number {
  return interpolate(frame, [COLLAGE_START, ORBIT_END], [0, ORBIT_DEG], {
    ...CLAMP,
    easing: Easing.inOut(Easing.cubic),
  });
}

/** How far the merge-to-centre has progressed (0 → 1). */
export function mergeProgress(frame: number): number {
  return interpolate(frame, [MERGE_START, MERGE_END], [0, 1], {
    ...CLAMP,
    easing: EASE,
  });
}

/**
 * Which image a position shows. Positions don't hold one picture — they flicker
 * through the whole set every `FLICKER_HOLD` frames, staggered per slot, so it
 * reads as all the photos shuffling in place. The image freezes at `MERGE_START`
 * so the convergence isn't a strobe.
 */
export function flickerImage(
  frame: number,
  slot: number,
  count: number,
): number {
  const f = Math.min(frame, MERGE_START);
  const step = Math.max(0, Math.floor((f - COLLAGE_START) / FLICKER_HOLD));
  return (step * 3 + slot * 5) % count;
}

export interface SlotPose {
  x: number;
  y: number;
  scale: number;
  opacity: number;
}

/**
 * A position's live pose: it fades/scales in, orbits the centre, then converges
 * to the centre and to the common `MERGE_W` footprint during the merge. Opacity
 * is only the entrance fade — it NEVER fades on merge, so the positions stack on
 * top of each other and the topmost one (the hero) covers the rest.
 */
export function slotPose(
  frame: number,
  slot: { x: number; y: number; w: number },
  index: number,
): SlotPose {
  const appear = COLLAGE_START + index * 2;
  const opacity = interpolate(
    frame,
    [appear, appear + APPEAR_FRAMES],
    [0, 1],
    CLAMP,
  );
  const scIn = interpolate(frame, [appear, appear + APPEAR_FRAMES], [0.6, 1], {
    ...CLAMP,
    easing: EASE,
  });
  const a = (orbitAngle(frame) * Math.PI) / 180;
  const ox = slot.x * Math.cos(a) - slot.y * Math.sin(a);
  const oy = slot.x * Math.sin(a) + slot.y * Math.cos(a);
  const m = mergeProgress(frame);
  const target = MERGE_W / slot.w; // every card lands at the same width
  return {
    x: ox * (1 - m),
    y: oy * (1 - m),
    scale: scIn * (1 + (target - 1) * m),
    opacity,
  };
}

/** Motion blur (px) as the positions converge — peaks mid-merge, zero at ends. */
export function mergeBlur(frame: number): number {
  return interpolate(
    frame,
    [MERGE_START, (MERGE_START + MERGE_END) / 2, MERGE_END],
    [0, 6, 0],
    CLAMP,
  );
}

/** 0 = dark background, 1 = light background. */
export function bgProgress(frame: number): number {
  return interpolate(frame, [BG_START, BG_END], [0, 1], CLAMP);
}

/** Intro image swap cadence, and the "drop" each new image lands with. */
export const INLINE_START = 8;
export const INLINE_HOLD = 12;
/** How many images cycle in the intro (kept small so each drop is legible). */
export const INLINE_COUNT = 3;
export const DROP_FRAMES = 9;
export const DROP_SCALE = 1.16;

export interface InlineDrop {
  index: number;
  scale: number;
  opacity: number;
}

/**
 * The inline image drops in — the *same* smooth landing the hero uses: each new
 * image fades in over a few frames while settling from a slight zoom
 * (`DROP_SCALE` → 1), so you actually see it drop into place rather than cut.
 * Past images stay stacked underneath so the swap never flashes empty; the
 * newest sits on top. `DROP_FRAMES` < `INLINE_HOLD`, so every image — the last
 * one included — fully lands before the next arrives.
 */
export function inlineImage(frame: number, count: number): InlineDrop {
  const index = Math.min(
    count - 1,
    Math.max(0, Math.floor((frame - INLINE_START) / INLINE_HOLD)),
  );
  const age = frame - (INLINE_START + index * INLINE_HOLD);
  const scale = interpolate(age, [0, DROP_FRAMES], [DROP_SCALE, 1], {
    ...CLAMP,
    easing: EASE,
  });
  const opacity = interpolate(age, [0, 5], [0, 1], { ...CLAMP, easing: EASE });
  return { index, scale, opacity };
}

function Card({ src, style }: { src: string; style: CSSProperties }) {
  return (
    <Img
      src={resolveSrc(src)}
      style={{
        width: "100%",
        height: "100%",
        maxWidth: "none",
        objectFit: "cover",
        display: "block",
        ...style,
      }}
    />
  );
}

/** Rewrite root-relative assets through staticFile only while rendering. */
function resolveSrc(src: string): string {
  const isLocal = src.startsWith("/") && !src.startsWith("//");
  if (isLocal && getRemotionEnvironment().isRendering) {
    return staticFile(src.replace(/^\/+/, ""));
  }
  return src;
}

/** Thin wireframe square/diamond marker that drifts and slowly rotates. */
function WireMarker({
  frame,
  cx,
  cy,
  size,
  spin,
  color,
  from,
  to,
}: {
  frame: number;
  cx: number;
  cy: number;
  size: number;
  spin: number;
  color: string;
  from: number;
  to: number;
}) {
  const opacity = interpolate(
    frame,
    [from, from + 8, to - 8, to],
    [0, 1, 1, 0],
    CLAMP,
  );
  if (opacity <= 0) return null;
  const drift = Math.sin((frame - from) / 22) * 8;
  const rot = spin + (frame - from) * 0.6;
  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: cy + drift,
        width: size,
        height: size,
        border: `1px solid ${color}`,
        transform: `rotate(${rot}deg)`,
        opacity,
      }}
    />
  );
}

export function MoodboardReveal({
  leadIn = "that lets you",
  emphasis = "filter",
  tailIn = "out AI.",
  images = DEFAULT_IMAGES,
  heroImage,
  darkColor,
  lightColor,
  theme,
  speed = 1,
  className,
}: MoodboardRevealProps) {
  const frame = useCurrentFrame() * speed;
  const { width, height } = useVideoConfig();
  // The scene crossfades a dark page into a light one, so it needs both ends of
  // the system at once rather than one resolved mode. Both still take a user's
  // `theme` override.
  const dark = useSnapCnTheme(theme, "dark");
  const light = useSnapCnTheme(theme, "light");
  const cx = width / 2;
  const cy = height / 2;

  const bg = bgProgress(frame);
  const bgColor = interpolateColors(
    bg,
    [0, 1],
    [darkColor ?? dark.background, lightColor ?? light.background],
  );
  // The marker is always the opposite page: light ink on the dark half, dark on
  // the light one.
  const markerColor =
    bg < 0.5
      ? withAlpha(light.background, 0.55)
      : withAlpha(dark.background, 0.5);
  const hero = heroImage ?? images[3] ?? images[0];

  // ── Intro sentence ──────────────────────────────────────────────────────────
  const sentenceOp = interpolate(
    frame,
    [0, 8, SENTENCE_OUT - 6, SENTENCE_OUT],
    [0, 1, 1, 0],
    CLAMP,
  );
  const inline = inlineImage(frame, Math.min(INLINE_COUNT, images.length));

  // ── Gallery (flicker + orbit + merge) ────────────────────────────────────────
  const mBlur = mergeBlur(frame);
  const merge = mergeProgress(frame);
  const isRendering = getRemotionEnvironment().isRendering;

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        backgroundColor: bgColor,
        fontFamily: FONT_FAMILY,
        // Any scaled text renders as the outline, not re-hinted per frame.
        textRendering: "geometricPrecision",
      }}
    >
      {/* Dotted grid, only on the dark background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 1 - bg,
          backgroundImage: `radial-gradient(circle, ${withAlpha(
            light.background,
            0.07,
          )} 1px, transparent 1.5px)`,
          backgroundSize: "20px 20px",
        }}
      />

      {/* ── Intro sentence: "<leadIn> [img] <emphasis> <tailIn>" ── */}
      {sentenceOp > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 18,
            opacity: sentenceOp,
            color: dark.foreground,
            fontSize: 28,
            fontWeight: 400,
            letterSpacing: "-0.01em",
          }}
        >
          <span>{leadIn}</span>
          <div
            style={{
              position: "relative",
              width: 108,
              height: 108 * CARD_RATIO,
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {images.slice(0, INLINE_COUNT).map((src, i) => {
              if (i > inline.index) return null; // future image, not yet dropped
              const isActive = i === inline.index;
              return (
                <Card
                  key={src}
                  src={src}
                  style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: i,
                    opacity: isActive ? inline.opacity : 1,
                    transform: isActive ? `scale(${inline.scale})` : undefined,
                    transformOrigin: "center center",
                  }}
                />
              );
            })}
          </div>
          <span>
            <strong style={{ fontWeight: 700 }}>{emphasis}</strong> {tailIn}
          </span>
        </div>
      )}

      {/* ── Gallery: positions that flicker, orbit, then merge to centre ── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: mBlur > 0.1 ? `blur(${mBlur}px)` : undefined,
          ...(isRendering ? {} : { willChange: "filter" as const }),
        }}
      >
        {SLOTS.map((s, i) => {
          const pose = slotPose(frame, s, i);
          if (pose.opacity <= 0) return null;
          // The last-rendered position sits on top of the merged stack, so it is
          // the one that remains — freeze it to the hero as the merge begins.
          const isTop = i === SLOTS.length - 1;
          const src =
            isTop && frame >= MERGE_START
              ? hero
              : images[flickerImage(frame, i, images.length)];
          const h = s.w * CARD_RATIO;
          // Un-rotate as they merge so the stack aligns into one clean image.
          const rot = s.rot * (1 - merge);
          return (
            <div
              key={`slot-${s.x}-${s.y}`}
              style={{
                position: "absolute",
                left: cx + pose.x - s.w / 2,
                top: cy + pose.y - h / 2,
                width: s.w,
                height: h,
                opacity: pose.opacity,
                transform: `rotate(${rot}deg) scale(${pose.scale})`,
                // Shadow gives depth in the spread, but 8 stacked shadows pile
                // into a dark halo — so fade it out as they merge to one.
                boxShadow:
                  merge > 0.98
                    ? "none"
                    : `0 18px 40px ${withAlpha(dark.background, 0.28 * (1 - merge))}`,
              }}
            >
              <Card src={src} style={{}} />
            </div>
          );
        })}
      </div>

      {/* ── Wireframe markers ── */}
      <WireMarker
        frame={frame}
        cx={cx + 150}
        cy={cy - 130}
        size={44}
        spin={0}
        color={markerColor}
        from={4}
        to={SENTENCE_OUT}
      />
      <WireMarker
        frame={frame}
        cx={cx - 240}
        cy={cy + 40}
        size={54}
        spin={45}
        color={markerColor}
        from={MERGE_END - 6}
        to={150}
      />
      <WireMarker
        frame={frame}
        cx={cx + 190}
        cy={cy + 70}
        size={40}
        spin={12}
        color={markerColor}
        from={MERGE_END + 8}
        to={150}
      />
    </div>
  );
}
