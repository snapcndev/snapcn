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
import {
  mixOklch,
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
  withAlpha,
} from "@/lib/snap-cn-ui";

/**
 * A logo build: a single ring of image cards revolves around the centre, then
 * spins inward and vanishes into the middle — giving birth to a simple logo and
 * the brand name. One circle, no colour on the mark; the images do the motion.
 */

export interface LogoAssembleProps {
  /** The logo mark (kept simple/monochrome — it sits on the dark backdrop). */
  logoSrc?: string;
  /** Brand name that appears to the right of the logo. */
  brandName?: string;
  /** Text held in the middle of the ring while the images revolve (\n for lines). */
  middleText?: string;
  /** Image URLs for the ring, cycled around the circle. */
  images?: string[];
  /** How many cards ride the ring. */
  count?: number;
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
  /**
   * The face this scene paints its words in — a label from `fonts.ts`
   * ("Inter", "Space Grotesk", "Instrument Serif") or a CSS family you have
   * loaded yourself. Unset, the scene keeps the face it was designed around.
   *
   * Overrides `theme.fontFamily`, which is how a brand kit re-skins a whole
   * timeline from one value.
   */
  fontFamily?: string;
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

// ─── Timeline (frames @ 30fps; ~3.6s) ──────────────────────────────────────────
/** The ring spins inward from here (radius → 0, cards vanish). */
export const CONTRACT_START = 50;
export const CONTRACT_END = 66;
/** The middle text fades out as the ring collapses. */
export const MIDDLE_OUT = 52;
/** The logo is born at the centre, then slides left to make room for the name. */
export const LOGO_IN = 58;
export const LOGO_SHIFT_START = 74;
export const LOGO_SHIFT_END = 90;
/** The name reveals in step with the slide — the logo moving and the name
 *  coming happen simultaneously, not one after the other. */
export const NAME_IN = LOGO_SHIFT_START;

/** Base angular speed of the ring (radians / frame). */
export const ORBIT_SPEED = 0.1;
/** Extra spin added as the ring drains inward — the dr, water-down-the-plughole. */
export const DRAIN_SPIN = Math.PI * 1.1;
const CARD_RATIO = 1.22; // portrait cards

export const EASE = Easing.bezier(0.2, 0.6, 0.35, 1);
/** Accelerate into the centre — the collapse, not a drift. */
export const EASE_IN = Easing.bezier(0.5, 0, 0.75, 0.4);
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 while orbiting, 1 when fully drained to the centre. */
export function contractProgress(frame: number): number {
  return interpolate(frame, [CONTRACT_START, CONTRACT_END], [0, 1], {
    ...CLAMP,
    easing: EASE_IN,
  });
}

/**
 * The ring's rotation (radians). Steady while orbiting, then a burst of extra
 * spin as it drains inward.
 */
export function orbitAngle(frame: number): number {
  return frame * ORBIT_SPEED + contractProgress(frame) * DRAIN_SPIN;
}

/** Radius multiplier: 1 while orbiting, → 0 as the ring drains in. */
export function ringScale(frame: number): number {
  return 1 - contractProgress(frame);
}

/** Card scale: full size on the ring, shrinking as it pulls to the centre. */
export function cardScale(frame: number): number {
  return 1 - 0.66 * contractProgress(frame);
}

/** Card opacity: solid on the ring, vanishing near the end of the drain. */
export function cardOpacity(frame: number): number {
  return interpolate(frame, [CONTRACT_END - 8, CONTRACT_END], [1, 0], CLAMP);
}

/** Center text: fades in early, holds through the orbit, out as the ring drains. */
export function middleTextOpacity(frame: number): number {
  return interpolate(
    frame,
    [6, 16, MIDDLE_OUT - 6, MIDDLE_OUT],
    [0, 1, 1, 0],
    CLAMP,
  );
}

export interface LogoPose {
  opacity: number;
  scale: number;
}

/** The logo is born at the centre — a small overshoot as the ring vanishes. */
export function logoPose(frame: number): LogoPose {
  return {
    opacity: interpolate(frame, [LOGO_IN, LOGO_IN + 8], [0, 1], CLAMP),
    scale: interpolate(
      frame,
      [LOGO_IN, LOGO_IN + 10, LOGO_IN + 18],
      [0.6, 1.05, 1],
      { ...CLAMP, easing: EASE },
    ),
  };
}

/** Fraction the logo has slid from centre toward its left resting spot (0 → 1). */
export function logoShift(frame: number): number {
  return interpolate(frame, [LOGO_SHIFT_START, LOGO_SHIFT_END], [0, 1], {
    ...CLAMP,
    easing: EASE,
  });
}

export interface NamePose {
  opacity: number;
  dx: number;
}

/** Brand name: fades and slides in from the right, after the logo has moved. */
export function namePose(frame: number): NamePose {
  return {
    opacity: interpolate(frame, [NAME_IN, NAME_IN + 10], [0, 1], CLAMP),
    dx: interpolate(frame, [NAME_IN, NAME_IN + 12], [18, 0], {
      ...CLAMP,
      easing: EASE,
    }),
  };
}

/** Rewrite root-relative assets through staticFile only while rendering. */
function resolveSrc(src: string): string {
  const isLocal = src.startsWith("/") && !src.startsWith("//");
  if (isLocal && getRemotionEnvironment().isRendering) {
    return staticFile(src.replace(/^\/+/, ""));
  }
  return src;
}

export function LogoAssemble({
  logoSrc = "https://snapcn.dev/logo/snapcn-white.png",
  brandName = "snapcn",
  middleText = "Cinematic components\nfor React",
  images = DEFAULT_IMAGES,
  count = 10,
  background,
  speed = 1,
  className,
  theme,
  mode,
  fontFamily,
}: LogoAssembleProps) {
  const frame = useCurrentFrame() * speed;
  const { width, height } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode ?? "dark");
  const face = resolveFont(fontFamily ?? t.fontFamily) ?? FONT_FAMILY;
  const stage = background ?? t.background;
  // A shadow is cast in the dark direction whatever the mode, so it is walked
  // from the stage toward black — not toward `foreground`, which is near-white
  // in dark mode and would light the card from below instead of grounding it.
  const cardShadow = withAlpha(mixOklch(stage, "#000", 0.75), 0.4);
  const cx = width / 2;
  const cy = height / 2;
  const short = Math.min(width, height);
  const isRendering = getRemotionEnvironment().isRendering;

  const R = short * 0.36;
  // Smaller than the arc between cards, so the ring has clear gaps.
  const cardW = Math.round(short * 0.15);
  const cardH = cardW * CARD_RATIO;

  const a = orbitAngle(frame);
  const rs = ringScale(frame);
  const cScale = cardScale(frame);
  const cOpacity = cardOpacity(frame);
  const middleOp = middleTextOpacity(frame);
  const logo = logoPose(frame);
  const shift = logoShift(frame);
  const name = namePose(frame);
  const n = Math.max(1, Math.floor(count));

  // Logo slides from the centre to a left resting spot; the name sits to its right.
  const logoSize = Math.round(short * 0.125);
  const gap = Math.round(short * 0.035);
  const restX = short * 0.13; // how far left the logo settles
  const logoCX = cx - restX * shift;
  const nameLeft = cx - restX + logoSize / 2 + gap;
  const nameSize = Math.round(short * 0.055);

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        backgroundColor: stage,
        fontFamily: face,
        textRendering: "geometricPrecision",
      }}
    >
      {/* The ring of images */}
      {cOpacity > 0 &&
        Array.from({ length: n }, (_, i) => {
          const theta = (i / n) * Math.PI * 2 + a;
          const x = cx + Math.cos(theta) * R * rs;
          const y = cy + Math.sin(theta) * R * rs;
          // Cards stay upright and just revolve around the centre — no tangent
          // spin, so no image ever tips onto its side.
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: the ring is a fixed positional set — the index IS the card's identity
              key={`card-${i}`}
              style={{
                position: "absolute",
                left: x - cardW / 2,
                top: y - cardH / 2,
                width: cardW,
                height: cardH,
                opacity: cOpacity,
                transform: `scale(${cScale})`,
                overflow: "hidden",
                borderRadius: 4,
                boxShadow: `0 14px 34px ${cardShadow}`,
                ...(isRendering ? {} : { willChange: "transform" as const }),
              }}
            >
              <Img
                src={resolveSrc(images[i % images.length] ?? images[0])}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  maxWidth: "none",
                  objectFit: "cover",
                }}
              />
            </div>
          );
        })}

      {/* Center text, held in the ring while the images revolve */}
      {middleOp > 0 && middleText && (
        <div
          style={{
            position: "absolute",
            left: cx - R,
            top: cy - cardH,
            width: R * 2,
            height: cardH * 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            opacity: middleOp,
            color: t.foreground,
            fontSize: Math.round(short * 0.04),
            fontWeight: 600,
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
            whiteSpace: "pre-line",
          }}
        >
          {middleText}
        </div>
      )}

      {/* Simple logo, born at the centre, then sliding left */}
      {logo.opacity > 0 && (
        <Img
          src={resolveSrc(logoSrc)}
          style={{
            position: "absolute",
            left: logoCX - logoSize / 2,
            top: cy - logoSize / 2,
            width: logoSize,
            height: logoSize,
            maxWidth: "none",
            objectFit: "contain",
            opacity: logo.opacity,
            transform: `scale(${logo.scale})`,
            transformOrigin: "center center",
          }}
        />
      )}

      {/* Brand name, revealed to the right of the settled logo */}
      {name.opacity > 0 && (
        <div
          style={{
            position: "absolute",
            left: nameLeft,
            top: cy - nameSize,
            height: nameSize * 2,
            display: "flex",
            alignItems: "center",
            opacity: name.opacity,
            transform: `translateX(${name.dx}px)`,
            color: t.foreground,
            fontSize: nameSize,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            whiteSpace: "nowrap",
          }}
        >
          {brandName}
        </div>
      )}
    </div>
  );
}
