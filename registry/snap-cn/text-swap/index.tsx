"use client";

import { Easing, interpolate, useCurrentFrame } from "remotion";
import {
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";

export type TextSwapTransition =
  | "fly-through"
  | "fade-through"
  | "crossfade"
  | "shared-axis-y"
  | "shared-axis-z"
  | "cut";

export type TextSwapUnit = "word" | "block";

export interface TextSwapTransitionDefaults {
  unit: TextSwapUnit;
  exitDuration: number;
  enterDuration: number;
}

/**
 * Per-transition timing defaults. `unit` picks whether the line animates as a
 * whole block or word-by-word when the `unit` prop is omitted.
 */
export const TRANSITION_DEFAULTS: Record<
  TextSwapTransition,
  TextSwapTransitionDefaults
> = {
  // Always a block: the line has to rush the camera as one object. Per-word it
  // would be five objects each blowing up about its own centre, which is not a
  // camera move, it is a collision.
  "fly-through": { unit: "block", exitDuration: 20, enterDuration: 16 },
  "fade-through": { unit: "block", exitDuration: 8, enterDuration: 13 },
  crossfade: { unit: "word", exitDuration: 15, enterDuration: 21 },
  "shared-axis-y": { unit: "block", exitDuration: 10, enterDuration: 14 },
  "shared-axis-z": { unit: "block", exitDuration: 11, enterDuration: 16 },
  cut: { unit: "word", exitDuration: 8, enterDuration: 8 },
};

export interface TextSwapMotion {
  /** Y offset (px) the outgoing text drifts to. */
  exitY: number;
  /** Scale the outgoing text ends at. */
  exitScale: number;
  /** Blur (px) the outgoing text ends at. */
  exitBlur: number;
  /** Y offset (px) the incoming text starts from. */
  enterY: number;
  /** Scale the incoming text starts from. */
  enterScale: number;
  /** Blur (px) the incoming text starts from. */
  enterBlur: number;

  /**
   * Shape the exit's scale as a **perspective rush** instead of a plain ramp —
   * see `perspectiveScale`. Only worth it when the line is meant to pass the
   * camera rather than merely grow.
   */
  exitPerspective?: boolean;
  /**
   * Fraction of the exit that passes before the outgoing line starts to fade.
   * 0 (the default) fades across the whole exit. A line flying at your face does
   * not dim on the way in — it stays solid until it is on top of you and then it
   * is gone, so this holds the fade back until the very end.
   */
  exitFadeStart?: number;
  /**
   * Motion-blur samples for the exit. See `SHUTTER` below.
   *
   * Not decoration. At the end of a perspective rush the line more than doubles
   * in size between one frame and the next; drawn sharp, that does not read as
   * speed, it reads as strobing. Sampling the exit several times across the
   * frame and averaging is what a shutter does, and because the motion is a
   * scale, the samples fan out radially — which is exactly the smear in the
   * reference, sharp at the centre of the rush and streaked at the edges.
   */
  exitTrail?: number;
}

/** Motion targets per transition — exit drifts away from rest, enter settles into rest. */
export const TRANSITION_MOTION: Record<TextSwapTransition, TextSwapMotion> = {
  // The line does not fade out and it does not slide away: it comes at you and
  // goes past. Measured off the reference — apparent size reached ~12x before it
  // was gone, and it stayed solid almost the whole way there.
  "fly-through": {
    exitY: 0,
    exitScale: 12,
    // The shutter does the smearing; this only closes the gaps between its
    // discrete samples at the very end of the rush, where the line grows so fast
    // that consecutive samples land a visible distance apart. It is applied in
    // the line's own space and the scale multiplies it, so it is nothing at the
    // start — when it must not soften the type — and enough by the end.
    exitBlur: 0.5,
    exitPerspective: true,
    exitFadeStart: 0.72,
    exitTrail: 18,
    // The replacement is revealed *behind* the line that just flew past, so it
    // arrives from depth: small, out of focus, resolving into place.
    enterY: 0,
    enterScale: 0.82,
    enterBlur: 9,
  },
  "fade-through": {
    exitY: -4,
    exitScale: 1,
    exitBlur: 0,
    enterY: 6,
    enterScale: 0.99,
    enterBlur: 2,
  },
  crossfade: {
    exitY: -6,
    exitScale: 1,
    exitBlur: 0,
    enterY: 8,
    enterScale: 1,
    enterBlur: 0,
  },
  "shared-axis-y": {
    exitY: -24,
    exitScale: 1,
    exitBlur: 0,
    enterY: 24,
    enterScale: 1,
    enterBlur: 0,
  },
  "shared-axis-z": {
    exitY: 0,
    exitScale: 1.06,
    exitBlur: 1,
    enterY: 0,
    enterScale: 0.9,
    enterBlur: 2,
  },
  cut: {
    exitY: 0,
    exitScale: 1,
    exitBlur: 0,
    enterY: 0,
    enterScale: 1,
    enterBlur: 0,
  },
};

const TRANSITION_EASINGS: Record<
  TextSwapTransition,
  { exit: (t: number) => number; enter: (t: number) => number }
> = {
  "fly-through": {
    // This is the *travel*, not the scale — how far the line has moved toward
    // the eye. Fitted to the reference: near-constant speed with a little
    // acceleration off the mark. All the drama is the perspective, not the
    // curve; a bezier cannot make something blow up eightfold in three frames,
    // and it should not have to.
    exit: Easing.bezier(1, 0.65, 0.85, 1),
    // A moderate decelerate. Not an expo/quint-out: over a 16-frame settle those
    // spend most of their frames moving less than a pixel, which renders as
    // identical frames — the text visibly stops dead and waits.
    enter: Easing.bezier(0.2, 0.6, 0.35, 1),
  },
  "fade-through": {
    exit: Easing.bezier(0.4, 0, 1, 1),
    enter: Easing.bezier(0.2, 0, 0, 1),
  },
  crossfade: {
    exit: Easing.bezier(0.7, 0, 0.84, 0),
    enter: Easing.bezier(0.16, 1, 0.3, 1),
  },
  "shared-axis-y": {
    exit: Easing.bezier(0.4, 0, 1, 1),
    enter: Easing.bezier(0.2, 0, 0, 1),
  },
  "shared-axis-z": {
    exit: Easing.bezier(0.4, 0, 1, 1),
    enter: Easing.bezier(0.2, 0, 0, 1),
  },
  cut: { exit: Easing.step1, enter: Easing.step1 },
};

/**
 * Apparent size of something travelling toward the camera.
 *
 * `travel` is 0 at rest and 1 at the moment it reaches the eye; `maxScale` is
 * how big it gets before it is gone. Size goes as `1 / (1 - travel)`, so it
 * creeps for most of the trip and then blows up right at the end — the whole
 * character of a thing rushing past you.
 *
 * This is why the exit is not a plain `interpolate(…, [1, exitScale])`. Fitted
 * against the reference, that shape is off by rmse 0.31 and *cannot* reach the
 * blowup at all; this one lands at 10.09 where the reference measured 10.28.
 * The easing then describes the travel, which is nearly linear — the drama is
 * perspective, not easing, and asking a bezier to fake it never works.
 */
export function perspectiveScale(travel: number, maxScale: number): number {
  if (maxScale <= 1) return 1;
  const p = 1 - 1 / maxScale;
  // Clamp short of 1: at travel = 1 / p the denominator is 0 and the line is
  // already long gone.
  return 1 / (1 - p * Math.min(Math.max(travel, 0), 0.9999));
}

/**
 * How long the shutter is open, in frames, when `exitTrail` is on. One whole
 * frame — a 360° shutter. Anything shorter leaves gaps between the samples at
 * the speeds this transition reaches.
 */
const SHUTTER = 1;

/** Split a line into animatable segments for the given unit. */
export function splitSegments(text: string, unit: TextSwapUnit): string[] {
  return unit === "word" ? text.split(" ") : [text];
}

/**
 * Exit-then-enter scheduling: the incoming text starts once the outgoing text
 * (including its stagger tail) is almost gone, minus `overlap`, plus a
 * `microDelay` beat so the swap reads as two distinct moments.
 */
export function getEnterStart(opts: {
  exitDuration: number;
  segmentCount: number;
  exitStagger: number;
  overlap: number;
  microDelay: number;
}): number {
  const exitTotal =
    opts.exitDuration + Math.max(0, opts.segmentCount - 1) * opts.exitStagger;
  return Math.max(0, exitTotal - opts.overlap + opts.microDelay);
}

const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

export interface TextSwapProps {
  fromText: string;
  toText: string;
  /** Animate word-by-word or as one block. Defaults per transition. */
  unit?: TextSwapUnit;
  transition?: TextSwapTransition;
  /** Frames each outgoing segment takes to exit. Defaults per transition. */
  exitDuration?: number;
  /** Frames each incoming segment takes to enter. Defaults per transition. */
  enterDuration?: number;
  exitStagger?: number;
  enterStagger?: number;
  overlap?: number;
  microDelay?: number;
  fontSize?: number;
  /** Overrides the design system's `foreground`. */
  color?: string;
  fontWeight?: number;
  speed?: number;
  className?: string;
  /** Design-system token overrides. */
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
}

export function TextSwap({
  fromText,
  toText,
  unit,
  transition = "fly-through",
  exitDuration,
  enterDuration,
  exitStagger = 1,
  enterStagger = 2,
  overlap = 1,
  microDelay = 2,
  fontSize = 72,
  color,
  fontWeight = 600,
  speed = 1,
  className,
  theme,
  mode,
  fontFamily,
}: TextSwapProps) {
  const frame = useCurrentFrame() * speed;
  const t = useSnapCnTheme(theme, mode);
  const fill = color ?? t.foreground;

  const defaults = TRANSITION_DEFAULTS[transition];
  const motion = TRANSITION_MOTION[transition];
  const easing = TRANSITION_EASINGS[transition];

  const resolvedUnit = unit ?? defaults.unit;
  const exitDur = exitDuration ?? defaults.exitDuration;
  const enterDur = enterDuration ?? defaults.enterDuration;

  const fromSegments = splitSegments(fromText, resolvedUnit);
  const toSegments = splitSegments(toText, resolvedUnit);

  const enterStart = getEnterStart({
    exitDuration: exitDur,
    segmentCount: fromSegments.length,
    exitStagger,
    overlap,
    microDelay,
  });

  const isWord = resolvedUnit === "word";
  const exitFadeStart = motion.exitFadeStart ?? 0;

  // The frames the shutter sees. One sample (the default) is just the exit drawn
  // sharp, and costs nothing — the copies only exist for transitions that move
  // fast enough to strobe without them.
  const trail = Math.max(1, Math.round(motion.exitTrail ?? 1));
  const exitSamples = Array.from(
    { length: trail },
    (_, sample) => frame - (sample / trail) * SHUTTER,
  );

  const fontStack =
    resolveFont(fontFamily ?? t.fontFamily) ??
    "-apple-system, BlinkMacSystemFont, sans-serif";
  const lineStyle: React.CSSProperties = {
    fontSize,
    fontWeight,
    color: fill,
    letterSpacing: "-0.02em",
    fontFamily: fontStack,
    // Hinting bends each glyph's outline so its stems land on whole pixels. As
    // the size slides, every stem re-snaps to a different grid and the
    // letterforms change shape from frame to frame — they boil. Off, the type
    // reads a shade softer, which is not blur, it is the absence of a lie.
    textRendering: "geometricPrecision",
  };
  const layerStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div
      className={className}
      style={{ position: "absolute", inset: 0, background: "transparent" }}
    >
      {/*
        The shutter. Every sample gets an equal 1/n slice of it and they are
        blended with `plus-lighter`, which *adds* premultiplied colour and alpha
        rather than painting one over the next. A pixel the line covered for half
        the shutter therefore ends up half opaque, which is precisely what a
        shutter does and precisely what makes it read as speed.

        Ordinary `source-over` cannot do this, and getting it wrong is worth
        spelling out because the result is so plausible: stacking the samples at
        1/1, 1/2, 1/3 … averages *opaque* layers correctly, but these layers are
        type on transparent, so the first sample stays fully solid wherever the
        others miss it, and every overlap drives alpha toward 1. What you get is a
        sharp, over-dark line with ghosts hung around it and visibly fattened
        stems — not a smear. `isolation` keeps the additive blending inside this
        group instead of leaking onto whatever the scene is sitting on.
      */}
      <div style={{ ...layerStyle, isolation: "isolate" }}>
        {exitSamples.map((sampleFrame, sample) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: shutter samples are positional
            key={sample}
            style={{
              ...layerStyle,
              opacity: 1 / exitSamples.length,
              mixBlendMode: "plus-lighter",
            }}
          >
            <span style={lineStyle}>
              {fromSegments.map((segment, i) => {
                const local = sampleFrame - i * exitStagger;
                // 0 at rest, 1 at the eye. The easing shapes the *travel*; the
                // perspective (or the plain ramp) turns that into apparent size.
                const travel = interpolate(local, [0, exitDur], [0, 1], {
                  ...CLAMP,
                  easing: easing.exit,
                });
                return (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional and never reorder
                    key={`${segment}-${i}`}
                    style={{
                      display: "inline-block",
                      marginRight: isWord ? "0.25em" : undefined,
                      transformOrigin: "50% 50%",
                      opacity: interpolate(
                        local,
                        [exitFadeStart * exitDur, exitDur],
                        [1, 0],
                        { ...CLAMP, easing: easing.exit },
                      ),
                      translate: `0 ${motion.exitY * travel}px`,
                      scale: `${
                        motion.exitPerspective
                          ? perspectiveScale(travel, motion.exitScale)
                          : 1 + (motion.exitScale - 1) * travel
                      }`,
                      filter: `blur(${motion.exitBlur * travel}px)`,
                    }}
                  >
                    {segment}
                  </span>
                );
              })}
            </span>
          </div>
        ))}
      </div>

      <div style={layerStyle}>
        <span style={lineStyle}>
          {toSegments.map((segment, j) => {
            const local = frame - enterStart - j * enterStagger;
            return (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional and never reorder
                key={`${segment}-${j}`}
                style={{
                  display: "inline-block",
                  marginRight: isWord ? "0.25em" : undefined,
                  transformOrigin: "50% 50%",
                  opacity: interpolate(local, [0, enterDur], [0, 1], {
                    ...CLAMP,
                    easing: easing.enter,
                  }),
                  translate: `0 ${interpolate(
                    local,
                    [0, enterDur],
                    [motion.enterY, 0],
                    { ...CLAMP, easing: easing.enter },
                  )}px`,
                  scale: `${interpolate(
                    local,
                    [0, enterDur],
                    [motion.enterScale, 1],
                    { ...CLAMP, easing: easing.enter },
                  )}`,
                  filter: `blur(${interpolate(
                    local,
                    [0, enterDur],
                    [motion.enterBlur, 0],
                    { ...CLAMP, easing: easing.enter },
                  )}px)`,
                }}
              >
                {segment}
              </span>
            );
          })}
        </span>
      </div>
    </div>
  );
}
