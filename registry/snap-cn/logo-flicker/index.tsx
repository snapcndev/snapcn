"use client";

import {
  Easing,
  getRemotionEnvironment,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { type SnapCnTheme, useSnapCnTheme } from "@/lib/snap-cn-ui";

/**
 * A Marvel-Studios-style flicker reveal: images flip full-screen at a constant
 * fast rate right to the end, then cross-fade — the flicker fading OUT while the
 * logo and brand name fade IN, together, in one move.
 */

export interface LogoFlickerProps {
  /** The logo mark (simple/monochrome — it resolves over the dark backdrop). */
  logoSrc?: string;
  /** Brand name shown under the logo. */
  brandName?: string;
  /** Image pool the flicker flips through, full-screen. */
  images?: string[];
  /** Frames each image holds — the (constant) flip speed. */
  flipInterval?: number;
  /** Backdrop color. Overrides the design system's `background`. */
  background?: string;
  speed?: number;
  className?: string;
  /** Design-system token overrides. */
  theme?: Partial<SnapCnTheme>;
  /**
   * Defaults to `"dark"`: the shipped `logoSrc` is a white mark, so the stage
   * has to be dark for it to read. Pass `"light"` with a dark logo asset.
   */
  mode?: "light" | "dark";
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

// ─── Timeline (frames @ 30fps; ~3.5s) ──────────────────────────────────────────
/** Default frames per image — the flip speed, held constant to the very end. */
export const FLIP_INTERVAL = 2;
/**
 * The single cross-fade window: the flicker fades OUT and the logo + name fade
 * IN across exactly these frames — simultaneously, not one after the other.
 */
export const FADE_START = 66;
export const FADE_END = 84;

export const EASE = Easing.bezier(0.2, 0.6, 0.35, 1);
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Which image shows at `frame`. A constant `interval` (no deceleration) and a
 * coprime stride so it hops through the whole pool as it flips.
 */
export function flickerImage(
  frame: number,
  count: number,
  interval: number = FLIP_INTERVAL,
): number {
  const n = Math.max(1, count);
  const step = Math.floor(frame / Math.max(1, interval));
  return (step * 7) % n;
}

/** Flicker opacity — solid, then fades out across the cross-fade window. */
export function flickerOpacity(frame: number): number {
  return interpolate(frame, [FADE_START, FADE_END], [1, 0], CLAMP);
}

/** Logo + name opacity — the INVERSE of the flicker, on the SAME window. */
export function revealOpacity(frame: number): number {
  return interpolate(frame, [FADE_START, FADE_END], [0, 1], CLAMP);
}

/** A small settle on the lockup as it fades in (shared by logo and name). */
export function revealScale(frame: number): number {
  return interpolate(frame, [FADE_START, FADE_END], [0.92, 1], {
    ...CLAMP,
    easing: EASE,
  });
}

/** Rewrite root-relative assets through staticFile only while rendering. */
function resolveSrc(src: string): string {
  const isLocal = src.startsWith("/") && !src.startsWith("//");
  if (isLocal && getRemotionEnvironment().isRendering) {
    return staticFile(src.replace(/^\/+/, ""));
  }
  return src;
}

export function LogoFlicker({
  logoSrc = "https://snapcn.dev/logo/snapcn-white.png",
  brandName = "snapcn",
  images = DEFAULT_IMAGES,
  flipInterval = FLIP_INTERVAL,
  background,
  speed = 1,
  className,
  theme,
  mode,
}: LogoFlickerProps) {
  const frame = useCurrentFrame() * speed;
  const { width, height } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode ?? "dark");
  const stage = background ?? t.background;
  const short = Math.min(width, height);
  const isRendering = getRemotionEnvironment().isRendering;

  const flkOpacity = flickerOpacity(frame);
  const reveal = revealOpacity(frame);
  const scale = revealScale(frame);
  const imgIdx = flickerImage(frame, images.length, flipInterval);

  const logoSize = Math.round(short * 0.15);
  const nameSize = Math.round(short * 0.055);

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        backgroundColor: stage,
        fontFamily: FONT_FAMILY,
        textRendering: "geometricPrecision",
      }}
    >
      {/* Full-screen flicker */}
      {flkOpacity > 0 && (
        <Img
          src={resolveSrc(images[imgIdx] ?? images[0])}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            maxWidth: "none",
            objectFit: "cover",
            opacity: flkOpacity,
            ...(isRendering ? {} : { willChange: "opacity" as const }),
          }}
        />
      )}

      {/* Logo + brand name — fade IN on the same window the flicker fades OUT */}
      {reveal > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: Math.round(short * 0.02),
            opacity: reveal,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          <Img
            src={resolveSrc(logoSrc)}
            style={{
              width: logoSize,
              height: logoSize,
              maxWidth: "none",
              objectFit: "contain",
            }}
          />
          <div
            style={{
              color: t.foreground,
              fontSize: nameSize,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            {brandName}
          </div>
        </div>
      )}
    </div>
  );
}
