"use client";

import { useMemo, useState } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
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

const TWO_PI = Math.PI * 2;
/** Lookup resolution for the arc-length reparameterization table. */
const ARC_SAMPLES = 1024;

export interface OrbitGalleryProps {
  title?: string;
  subtitle?: string;
  /** Pill CTA under the subtitle. Empty string hides it. */
  buttonLabel?: string;
  /**
   * Card artwork URLs, cycled along the spiral stream. A URL that fails to load
   * falls back to a gradient tile rather than breaking playback. Pass `[]` to
   * render self-contained editorial gradient tiles (no network).
   */
  images?: string[];
  /** How many times the Archimedean spiral winds from the edge to the center. */
  turns?: number;
  /** Arc spacing between cards along the stream (smaller = denser). */
  spacing?: number;
  /** Radius scale — larger pushes the outer coils off-frame, same coil gaps. */
  spread?: number;
  /** How much cards shrink toward the center (0 = uniform). */
  sizeAttenuation?: number;
  /** Card long-edge in px at the outer radius, on the reference 600px canvas. */
  imageSize?: number;
  /** Card width / height (portrait < 1). */
  cardAspect?: number;
  /** Percent of the path over which a card fades in at the outer end. */
  fadeIn?: number;
  /** Percent of the path over which a card fades out at the center end. */
  fadeOut?: number;
  /** Corner rounding, matching the reference's 0–20 scale (0 = sharp). */
  cornerRadius?: number;
  /** Seconds for the stream to flow one full turnover into the center. */
  orbitSeconds?: number;
  /** Overrides the design system's `background`. */
  background?: string;
  /** Overrides the design system's `foreground`. */
  textColor?: string;
  /** Design-system token overrides. */
  theme?: Partial<SnapCnTheme>;
  /** Defaults to `"dark"` — the orbit is a cinematic stage, lit for dark. */
  mode?: "light" | "dark";
  /** Tiny captions pinned to the bottom edge. Empty strings hide them. */
  footerLeft?: string;
  footerCenter?: string;
  footerRight?: string;
  speed?: number;
  className?: string;
}

export const SAMPLE_IMAGES = Array.from(
  { length: 16 },
  (_, i) => `https://picsum.photos/seed/snap-orbit-${i + 1}/440/560`,
);

/** Editorial two-stop gradients used for tiles without a (working) photo. */
export const PLACEHOLDER_FILLS = [
  "linear-gradient(135deg, #2b5fd9, #14306e)",
  "linear-gradient(135deg, #c96f2f, #7a3c12)",
  "linear-gradient(135deg, #e8e4da, #b6ad99)",
  "linear-gradient(135deg, #c8332b, #6e1511)",
  "linear-gradient(135deg, #b9a0d0, #6f5590)",
  "linear-gradient(135deg, #4c6b3c, #24361a)",
  "linear-gradient(135deg, #1f4dd8, #0d2262)",
  "linear-gradient(135deg, #d9d2c5, #a09684)",
];

const FONT_STACK = "Inter, -apple-system, BlinkMacSystemFont, sans-serif";

/**
 * Archimedean spiral point at parameter `n` in [0, 1]: n=0 is the outer edge
 * (radius R), n=1 is the center (radius 0). Because the radius falls off
 * LINEARLY, every coil is separated by the same radial gap (R / turns) — the
 * even "circle to circle" spacing. `y` is flipped so the spiral reads clockwise
 * from the top like the reference.
 */
export function archimedeanPoint(
  n: number,
  R: number,
  turns: number,
): { x: number; y: number } {
  const ang = n * turns * TWO_PI;
  const rad = R * (1 - n);
  return { x: rad * Math.cos(ang), y: -rad * Math.sin(ang) };
}

/**
 * Build the arc-length reparameterization table for a spiral of `turns` turns.
 * Sampling the path by even parameter would bunch cards near the center (where
 * the coils are short); sampling by even ARC length spaces them evenly. The
 * spiral's shape is radius-independent, so the table is built once at R=1 and
 * returns, for each even arc fraction, the spiral parameter `n` that lands
 * there.
 */
export function buildArcTable(turns: number, samples = 2000): Float64Array {
  const cum = new Float64Array(samples + 1);
  let prev = archimedeanPoint(0, 1, turns);
  for (let k = 1; k <= samples; k++) {
    const pt = archimedeanPoint(k / samples, 1, turns);
    cum[k] = cum[k - 1] + Math.hypot(pt.x - prev.x, pt.y - prev.y);
    prev = pt;
  }
  const total = cum[samples] || 1;

  const nForArc = new Float64Array(ARC_SAMPLES + 1);
  let j = 0;
  for (let a = 0; a <= ARC_SAMPLES; a++) {
    const target = (a / ARC_SAMPLES) * total;
    while (j < samples && cum[j + 1] < target) j++;
    const seg = cum[j + 1] - cum[j];
    const f2 = seg > 0 ? (target - cum[j]) / seg : 0;
    nForArc[a] = (j + f2) / samples;
  }
  return nForArc;
}

/** Map an arc fraction `s` in [0, 1) to the spiral parameter `n` (interpolated
 * so motion stays smooth, never quantized into visible steps). */
export function arcToN(s: number, nForArc: Float64Array): number {
  const x = Math.max(0, Math.min(ARC_SAMPLES, s * ARC_SAMPLES));
  const i = Math.floor(x);
  const a = nForArc[i];
  const b = nForArc[Math.min(i + 1, ARC_SAMPLES)];
  return a + (b - a) * (x - i);
}

/** Radius scale for the spiral: R = 0.48·min · (1 + (spread − 1)·0.18). */
export function ringRadius(minDim: number, spread: number): number {
  return 0.48 * minDim * (1 + (spread - 1) * 0.18);
}

/** Card size multiplier from its distance to the center — smaller toward the
 * middle. `dist/R` clamped to 1, raised to `sizeAttenuation/2`. */
export function sizeScale(
  dist: number,
  R: number,
  sizeAttenuation: number,
): number {
  return sizeAttenuation > 0
    ? Math.min(dist / R, 1) ** (sizeAttenuation * 0.5)
    : 1;
}

/**
 * One card face: the editorial gradient is always painted as the base layer,
 * and a photo (when provided) overlays it. A failed load flips to `errored` so
 * the gradient shows through — crucially, the `onError` handler also stops
 * Remotion's <Img> from calling cancelRender(), which would otherwise halt the
 * whole player when an external image is blocked or slow to fail. */
function OrbitTile({ src, fill }: { src: string | undefined; fill: string }) {
  const [errored, setErrored] = useState(false);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, backgroundImage: fill }} />
      {src && !errored ? (
        <Img
          src={src}
          crossOrigin="anonymous"
          onError={() => setErrored(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : null}
    </>
  );
}

export function OrbitGallery({
  title = "A whole new universe",
  subtitle = "Article — The Design Process",
  buttonLabel = "Explore",
  images,
  turns = 3,
  spacing = 5,
  spread = 7,
  sizeAttenuation = 2,
  imageSize = 172,
  cardAspect = 0.78,
  fadeIn = 20,
  fadeOut = 0,
  cornerRadius = 5,
  orbitSeconds = 40,
  background,
  textColor,
  theme,
  mode,
  footerLeft = "",
  footerCenter = "",
  footerRight = "",
  speed = 1,
  className,
}: OrbitGalleryProps) {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const tokens = useSnapCnTheme(theme, mode ?? "dark");
  const stage = background ?? tokens.background;
  const ink = textColor ?? tokens.foreground;
  const t = frame * speed;

  const minDim = Math.min(width, height);
  const R = ringRadius(minDim, spread);
  const baseSize = imageSize * (minDim / 600);
  const artwork = images ?? SAMPLE_IMAGES;
  const nImgs = artwork.length || 1;

  // Arc-length table (shape-only, so it depends on `turns` alone).
  const nForArc = useMemo(() => buildArcTable(turns), [turns]);

  const stepFrac = Math.max(0.005, (spacing * 0.5) / 100);
  const slots = Math.min(400, Math.ceil(1 / stepFrac) + 2);

  // Seamless inward flow: advance the stream by a whole number of card-steps
  // over the composition so the loop has no visible jump.
  const stepsPerLoop = Math.max(
    1,
    Math.round(durationInFrames / fps / orbitSeconds / stepFrac),
  );
  const base =
    ((((t / durationInFrames) * stepsPerLoop * stepFrac) % 1) + 1) % 1;

  const cards = [];
  for (let i = 0; i < slots; i++) {
    const s = (((base + i * stepFrac) % 1) + 1) % 1;
    const n = arcToN(s, nForArc);
    cards.push({ key: i, tt: s * 100, n, imgIdx: i % nImgs });
  }
  // Draw outer coils first, center cards last (on top), like the reference.
  cards.sort((a, b) => a.n - b.n);

  const intro = interpolate(t, [0, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleSize = Math.min(width * 0.066, height * 0.11);

  return (
    <AbsoluteFill
      className={className}
      style={{ backgroundColor: stage, fontFamily: FONT_STACK }}
    >
      {cards.map((card) => {
        const p = archimedeanPoint(card.n, R, turns);
        const dist = Math.hypot(p.x, p.y);

        let opacity = 1;
        if (card.tt < fadeIn) opacity = card.tt / fadeIn;
        else if (fadeOut > 0 && card.tt > 100 - fadeOut)
          opacity = (100 - card.tt) / fadeOut;
        if (opacity < 0.01) return null;

        const scale = sizeScale(dist, R, sizeAttenuation);
        if (scale < 0.002) return null;

        // Tangent of the spiral at this point → the card's rotation.
        const p2 = archimedeanPoint(Math.min(card.n + 0.001, 1), R, turns);
        const angleDeg = (Math.atan2(p2.y - p.y, p2.x - p.x) * 180) / Math.PI;

        // Long edge = baseSize·scale; the short edge follows cardAspect.
        const ch = baseSize * scale;
        const cw = ch * cardAspect;
        const rad = (cornerRadius / 20) * (Math.min(cw, ch) / 2);

        // Only the few tiny cards passing right behind the title get a light
        // blur (a cheap per-element filter on a handful of small cards — nothing
        // like the frame-wide backdrop blur that stalled the player). Everything
        // in the visible outer band stays sharp.
        const centerBlurR = minDim * 0.16;
        const blurPx = dist < centerBlurR ? (1 - dist / centerBlurR) * 4 : 0;

        return (
          <div
            key={card.key}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: cw,
              height: ch,
              marginLeft: -cw / 2,
              marginTop: -ch / 2,
              zIndex: Math.round(card.n * 8),
              translate: `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`,
              rotate: `${angleDeg.toFixed(2)}deg`,
              opacity: opacity * intro,
              filter:
                blurPx > 0.15 ? `blur(${blurPx.toFixed(2)}px)` : undefined,
              borderRadius: rad,
              overflow: "hidden",
              backgroundColor: mixOklch(stage, tokens.card, 0.35),
              boxShadow: `0 ${(ch * 0.12).toFixed(1)}px ${(ch * 0.3).toFixed(1)}px ${withAlpha(
                mixOklch(stage, "#000", 0.75),
                0.4,
              )}`,
            }}
          >
            <OrbitTile
              src={artwork.length ? artwork[card.imgIdx % nImgs] : undefined}
              fill={PLACEHOLDER_FILLS[card.imgIdx % PLACEHOLDER_FILLS.length]}
            />
          </div>
        );
      })}

      {/* Soft focus pool behind the lockup: a radial dark scrim so the title
          reads. This is a plain gradient (no backdrop-filter) — the earlier
          backdrop blur re-blurred every moving card each frame and froze the
          player. The slight softness behind the text comes from the small
          center cards' own light blur (see `centerBlur` in the card loop). */}
      {title || subtitle || buttonLabel ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: width * 0.66,
            height: height * 0.5,
            marginLeft: -(width * 0.66) / 2,
            marginTop: -(height * 0.5) / 2,
            borderRadius: "50%",
            backgroundImage: `radial-gradient(ellipse at center, ${withAlpha(
              stage,
              0.62,
            )} 0%, ${withAlpha(stage, 0.34)} 42%, transparent 70%)`,
            opacity: intro,
            zIndex: 9,
          }}
        />
      ) : null}

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          zIndex: 10,
        }}
      >
        {title ? (
          <div
            style={{
              fontSize: titleSize,
              fontWeight: 500,
              letterSpacing: "-0.015em",
              lineHeight: 1.08,
              color: ink,
              maxWidth: "82%",
              opacity: interpolate(t, [8, 34], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: `0px ${interpolate(t, [8, 34], [titleSize * 0.4, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.out(Easing.cubic),
              })}px`,
              filter: `blur(${interpolate(t, [8, 30], [8, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}px)`,
            }}
          >
            {title}
          </div>
        ) : null}

        {subtitle ? (
          <div
            style={{
              marginTop: titleSize * 0.42,
              fontSize: titleSize * 0.26,
              letterSpacing: "0.02em",
              color: ink,
              opacity:
                0.65 *
                interpolate(t, [16, 40], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              translate: `0px ${interpolate(
                t,
                [16, 40],
                [titleSize * 0.25, 0],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.out(Easing.cubic),
                },
              )}px`,
            }}
          >
            {subtitle}
          </div>
        ) : null}

        {buttonLabel ? (
          <div
            style={{
              marginTop: titleSize * 0.5,
              padding: `${titleSize * 0.14}px ${titleSize * 0.34}px`,
              borderRadius: 9999,
              backgroundColor: withAlpha(ink, 0.14),
              fontSize: titleSize * 0.23,
              fontWeight: 500,
              color: ink,
              opacity: interpolate(t, [24, 44], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              scale: String(
                interpolate(t, [24, 48], [0.7, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.out(Easing.back(1.4)),
                }),
              ),
            }}
          >
            {buttonLabel}
          </div>
        ) : null}
      </AbsoluteFill>

      {footerLeft || footerCenter || footerRight ? (
        <div
          style={{
            position: "absolute",
            left: width * 0.05,
            right: width * 0.05,
            bottom: height * 0.032,
            display: "flex",
            justifyContent: "space-between",
            fontSize: titleSize * 0.22,
            color: ink,
            opacity:
              0.78 *
              interpolate(t, [30, 50], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            zIndex: 10,
          }}
        >
          <span>{footerLeft}</span>
          <span>{footerCenter}</span>
          <span>{footerRight}</span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
}
