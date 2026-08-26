"use client";

import { useEffect, useRef, useState } from "react";
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
import { mixOklch, type SnapCnTheme, useSnapCnTheme } from "@/lib/snap-cn-ui";

/**
 * Pure animation math for WordFlip. Everything above the component is
 * frame-deterministic and side-effect free so it can be unit tested.
 */

const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

/** Frames each character takes, from a characters-per-second rate. */
export function framesPerChar(cps: number, fps: number): number {
  return fps / Math.max(0.001, cps);
}

/**
 * A deterministic, seedless wobble on the keystroke clock so the typing does not
 * land on a metronome. Real typing is uneven; a perfectly regular cadence is the
 * single thing that gives a "typewriter" away. Bounded to ±`jitter` of one
 * keystroke and summed into an *offset*, never a per-key delay, so the sentence
 * still finishes exactly when the timeline says it does.
 */
export function keystrokeOffset(index: number, jitter: number): number {
  if (jitter <= 0) return 0;
  // Two incommensurable sines: no repeat over any realistic sentence, and no RNG,
  // so a render and the Player agree frame for frame.
  const w = Math.sin(index * 12.9898) * 0.6 + Math.sin(index * 4.1414) * 0.4;
  return w * jitter;
}

/** Frame at which character `index` starts to appear. */
export function charStartFrame(
  index: number,
  opts: { typeStart: number; cps: number; fps: number; jitter: number },
): number {
  const per = framesPerChar(opts.cps, opts.fps);
  return (
    opts.typeStart + index * per + keystrokeOffset(index, opts.jitter) * per
  );
}

/** Frame the last character has finished fading in. */
export function typingEndFrame(opts: {
  charCount: number;
  typeStart: number;
  cps: number;
  fps: number;
  jitter: number;
  charFade: number;
}): number {
  const last = charStartFrame(Math.max(0, opts.charCount - 1), opts);
  return last + opts.charFade;
}

/** Frame at which flip `i` (0-based) begins. */
export function flipStartFrame(
  i: number,
  opts: { typingEnd: number; pause: number; cycle: number },
): number {
  return opts.typingEnd + opts.pause + i * opts.cycle;
}

/**
 * Which word is showing at `frame`, and how far into its flip we are.
 *
 * `index` is the word entering (or resting); `local` is frames since that
 * flip began, and is negative while the previous word is still holding.
 */
export function wordAt(
  frame: number,
  opts: {
    typingEnd: number;
    pause: number;
    cycle: number;
    wordCount: number;
    loop: boolean;
  },
): { index: number; local: number } {
  const first = flipStartFrame(0, opts);
  if (frame < first) return { index: 0, local: frame - first };
  const n = Math.floor((frame - first) / opts.cycle);
  const local = frame - first - n * opts.cycle;
  // Flip n takes word n -> word n+1. Before the first flip the slot is empty, so
  // flip 0 brings in word 0 and flip k brings in word k.
  const raw = n;
  const index = opts.loop
    ? ((raw % opts.wordCount) + opts.wordCount) % opts.wordCount
    : Math.min(raw, opts.wordCount - 1);
  return { index, local };
}

/**
 * The anticipation curve — `easeInBack`.
 *
 * The reference does not simply throw the word upward: it sinks it first. That
 * backswing is the whole reason the flip reads as weight rather than as a cut,
 * and it is not a separate keyframe — one `easeInBack` progress drives the
 * translate and the rotation together, so the dip and the throw are the same
 * gesture.
 *
 * Its minimum is `p = -0.100` at `t = 2s/(3(s+1)) = 0.42`. Measured off the
 * reference: the dip bottoms out at t = 0.44 of the exit and is worth 0.100 of
 * the exit travel. That is the curve, not an approximation of it.
 */
export function easeInBack(t: number, s = 1.70158): number {
  return t * t * ((s + 1) * t - s);
}

/**
 * Speed of {@link easeInBack}, normalised so the fastest instant is 1.
 *
 * The blur is a shutter, not a ramp: it has to be proportional to how fast the
 * word is actually travelling. That is not a stylistic preference, it is what
 * the reference does — at the bottom of the dip the word has *stopped* to turn
 * around, and it is sharp there; three frames later it is flying and it is
 * smeared. A blur keyed to progress instead of speed blurs the word while it is
 * standing still, which reads as a focus pull.
 *
 * `easeInBack` is a cubic, so this is exact rather than sampled — and its
 * derivative is zero precisely at the turnaround, which is the frame that has
 * to be sharp.
 */
export function easeInBackSpeed(t: number, s = 1.70158): number {
  const d = 3 * (s + 1) * t * t - 2 * s * t;
  const peak = 3 * (s + 1) - 2 * s; // the derivative at t = 1, its maximum
  return Math.abs(d) / peak;
}

/**
 * Uniform scale that makes every word fill the same slot.
 *
 * The reference pins *both* edges of the slot: all three words measure the same
 * width to within 1%, while their heights differ by up to 6% — exactly inversely
 * with their aspect ratios. That identity only closes if each word is scaled to
 * a common width, and it is what makes the layout incapable of reflowing: the
 * widest word sits at scale 1 and the rest are scaled up to meet it.
 */
export function fitScales(widths: number[]): number[] {
  const max = Math.max(...widths, 1);
  return widths.map((w) => (w > 0 ? max / w : 1));
}

export interface WordFlipMotion {
  /** How far the outgoing word is thrown, in em. Negative is up. */
  exitY: number;
  /** How far below rest the incoming word starts, in em. */
  enterY: number;
  /** Degrees the word rotates about the baseline. */
  rotate: number;
  /** Scale the outgoing word shrinks to (and the incoming grows from). */
  scale: number;
  /** Peak blur, in em. */
  blur: number;
}

/** Measured off the reference. See the doc page for the derivation. */
export const DEFAULT_MOTION: WordFlipMotion = {
  // 0.100 x 1.29em = 0.13em of backswing, which is the ~10px dip the reference
  // shows at a 72px font.
  exitY: -1.29,
  enterY: 0.135,
  rotate: 90,
  scale: 0.98,
  blur: 0.085,
};

export interface WordFlipProps {
  /** Text before the flipping word. */
  prefix?: string;
  /** The words that cycle through the slot. */
  words?: string[];
  /** Text after the flipping word. */
  suffix?: string;
  /**
   * Gradient painted on the flipping word, left to right. Defaults to the
   * design system's accent walked toward `destructive` — a two-stop ramp that
   * follows a user's theme instead of a fixed blue-to-pink.
   */
  gradient?: string[];
  /** Typing speed, characters per second. */
  cps?: number;
  /** Frames before the first keystroke. */
  typeStart?: number;
  /** Frames each character takes to fade in. */
  charFade?: number;
  /** Keystroke unevenness, as a fraction of one keystroke. 0 is a metronome. */
  jitter?: number;
  /** Frames held after the sentence completes, before the first flip. */
  pause?: number;
  /** Frames from one flip to the next. */
  cycle?: number;
  /** Frames the outgoing word takes to leave. */
  exitDuration?: number;
  /** Frames the incoming word takes to settle. */
  enterDuration?: number;
  /** Frames the incoming word starts before the outgoing one is gone. */
  overlap?: number;
  /** Show a blinking caret while typing. The reference has none. */
  caret?: boolean;
  /** Keep cycling the words forever. */
  loop?: boolean;
  motion?: Partial<WordFlipMotion>;
  /** 3D depth, in em. Smaller is a stronger perspective. */
  perspective?: number;
  /**
   * The typeface. Defaults to the shadcn app's sans stack. A headline is set in
   * *your* type, and the inline style would otherwise beat anything a className
   * could say — so this is the prop that lets it.
   */
  fontFamily?: string;
  fontSize?: number;
  /** Overrides the design system's `foreground`. */
  color?: string;
  fontWeight?: number;
  speed?: number;
  className?: string;
  /** Design-system token overrides. */
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
}

const FONT_FAMILY = "-apple-system, BlinkMacSystemFont, sans-serif";

export function WordFlip({
  prefix = "Looking For A",
  words = ["Modern", "Stunning", "Minimal"],
  suffix = "Portfolio",
  gradient,
  cps = 9,
  typeStart = 4,
  charFade = 6,
  jitter = 0.18,
  pause = 6,
  cycle = 35,
  exitDuration = 9,
  enterDuration = 9,
  overlap = 3,
  caret = true,
  loop = true,
  motion,
  perspective = 6.5,
  fontFamily = FONT_FAMILY,
  fontSize = 72,
  color,
  fontWeight = 600,
  speed = 1,
  className,
  theme,
  mode,
}: WordFlipProps) {
  const frame = useCurrentFrame() * speed;
  const { fps } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const fill = color ?? t.foreground;
  const stops = gradient ?? [
    t.primary,
    mixOklch(t.primary, t.destructive, 0.45),
  ];

  const m = { ...DEFAULT_MOTION, ...motion };

  // ---------------------------------------------------------------------------
  // Measure. offsetWidth/offsetTop are *layout* px — untouched by the transforms
  // we are about to apply, which is exactly why they are the right tool here. We
  // measure in a hidden, untransformed copy so frame 0 can never be captured
  // against the wrong geometry.
  // ---------------------------------------------------------------------------
  const [metrics, setMetrics] = useState<{
    widths: number[];
    baseline: number;
  } | null>(null);
  const [handle] = useState(() => delayRender("word-flip: measuring the slot"));
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const baselineRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (metrics) {
      // Only now has the measured geometry actually rendered.
      continueRender(handle);
      return;
    }
    const widths = words.map((_, i) => wordRefs.current[i]?.offsetWidth ?? 0);
    const baseline = baselineRef.current?.offsetTop ?? 0;
    if (widths.length > 0 && widths.every((w) => w > 0)) {
      setMetrics({ widths, baseline });
    }
  }, [metrics, handle, words]);

  const scales = metrics ? fitScales(metrics.widths) : words.map(() => 1);
  const slotWidth = metrics ? Math.max(...metrics.widths) : 0;
  const baseline = metrics?.baseline ?? 0;

  // ---------------------------------------------------------------------------
  // Timeline
  // ---------------------------------------------------------------------------
  const chars = [...prefix, ...suffix];
  const clock = { typeStart, cps, fps, jitter };
  const typingEnd = typingEndFrame({
    charCount: chars.length,
    charFade,
    ...clock,
  });
  const schedule = { typingEnd, pause, cycle, wordCount: words.length, loop };
  const { index: entering, local } = wordAt(frame, schedule);

  const em = fontSize;
  const outgoing = entering - 1;
  const enterStart = Math.max(0, exitDuration - overlap);

  /** The word that is leaving: one `easeInBack` progress drives everything. */
  const exitAt = (localFrame: number) => {
    const t = interpolate(localFrame, [0, exitDuration], [0, 1], CLAMP);
    const p = easeInBack(t);
    return {
      y: p * m.exitY * em,
      rotate: p * m.rotate,
      scale: 1 + p * (m.scale - 1),
      blur: easeInBackSpeed(t) * m.blur * em,
      // Solid until it is genuinely on its way out. A word that starts dimming on
      // the backswing reads as a crossfade; the reference holds it almost fully
      // opaque through the throw and then it is simply gone.
      opacity: interpolate(t, [0.65, 1], [1, 0], CLAMP),
    };
  };

  /** The word that is arriving. A moderate decelerate — see motion-quality. */
  const enterAt = (localFrame: number) => {
    const p = interpolate(
      localFrame,
      [enterStart, enterStart + enterDuration],
      [0, 1],
      { ...CLAMP, easing: Easing.bezier(0.2, 0.6, 0.35, 1) },
    );
    return {
      y: (1 - p) * m.enterY * em,
      rotate: -(1 - p) * m.rotate,
      scale: m.scale + p * (1 - m.scale),
      blur: (1 - p) * m.blur * em,
      opacity: interpolate(p, [0, 0.45], [0, 1], CLAMP),
    };
  };

  const stateFor = (i: number) => {
    if (i === entering && local >= enterStart) return enterAt(local);
    if (i === outgoing && local >= 0 && local <= exitDuration)
      return exitAt(local);
    if (i === entering && local > exitDuration) return enterAt(local);
    // Resting: the word that is showing between flips.
    if (i === entering && local < 0)
      return { y: 0, rotate: 0, scale: 1, blur: 0, opacity: 0 };
    return null;
  };

  // The Player is one continuous tab and hands the transform to the compositor;
  // a render is spread across tabs that each inherit a stale raster, so the same
  // hint there makes the type shimmer while standing still.
  const gpu = getRemotionEnvironment().isRendering
    ? null
    : ({ willChange: "transform, opacity, filter" } as const);

  const lineStyle: React.CSSProperties = {
    fontSize,
    fontWeight,
    color: fill,
    letterSpacing: "-0.02em",
    fontFamily,
    lineHeight: 1.25,
    whiteSpace: "pre",
    // Hinting re-snaps every stem to the pixel grid as the size slides, so the
    // letterforms change shape frame to frame. Off, the type reads a shade
    // softer — that is the absence of a lie, not blur.
    textRendering: "geometricPrecision",
  };

  const wordPaint: React.CSSProperties = {
    backgroundImage: `linear-gradient(90deg, ${stops.join(", ")})`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    WebkitTextFillColor: "transparent",
  };

  const typedChar = (ch: string, i: number) => {
    const start = charStartFrame(i, clock);
    return (
      <span
        key={i}
        style={{
          opacity: interpolate(frame, [start, start + charFade], [0, 1], CLAMP),
        }}
      >
        {ch}
      </span>
    );
  };

  // The caret rides the typing head. It is a zero-width inline-block with an
  // absolutely-positioned bar inside, so it cannot push a single glyph sideways
  // — the sentence's geometry has to be identical with it and without it.
  const caretIndex = Math.max(
    0,
    Math.min(
      chars.length,
      Math.floor((frame - typeStart) / framesPerChar(cps, fps)) + 1,
    ),
  );
  const caretDone = frame > typingEnd + pause;
  const showCaret = caret && !caretDone && frame >= typeStart;
  const blink = Math.floor((frame / fps) * 2) % 2 === 0 ? 1 : 0.15;

  const Caret = () => (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        width: 0,
        verticalAlign: "baseline",
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 0.06 * em,
          bottom: 0,
          width: Math.max(2, 0.055 * em),
          height: 0.78 * em,
          background: fill,
          opacity: blink,
          borderRadius: 1,
        }}
      />
    </span>
  );

  const prefixChars = chars.slice(0, prefix.length);
  const suffixChars = chars.slice(prefix.length);
  const caretInPrefix = caretIndex <= prefix.length;

  return (
    <AbsoluteFill
      className={className}
      style={{
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }}
    >
      {/*
        The measuring copy. Hidden, never transformed, laid out exactly like the
        real line so the widths and the baseline it reports are the ones the real
        line will use.
      */}
      {!metrics && (
        <span
          aria-hidden
          style={{
            ...lineStyle,
            position: "absolute",
            visibility: "hidden",
            pointerEvents: "none",
            left: 0,
            top: 0,
          }}
        >
          {words.map((w, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: words are positional
              key={i}
              ref={(el) => {
                wordRefs.current[i] = el;
              }}
              style={{ display: "inline-block" }}
            >
              {w}
              {i === 0 && (
                // A zero-sized inline-block sits ON the baseline, so its
                // offsetTop *is* the baseline. Never derive it from line-height.
                <span
                  ref={baselineRef}
                  style={{ display: "inline-block", width: 0, height: 0 }}
                />
              )}
            </span>
          ))}
        </span>
      )}

      <span style={lineStyle}>
        {prefixChars.map((ch, i) => typedChar(ch, i))}
        {showCaret && caretInPrefix && <Caret />}{" "}
        {/*
          The slot. Fixed width from the widest word, so it is reserved before the
          first word ever arrives — during typing it is the gap the reference
          shows between "A" and "Portfolio" — and nothing downstream of it can
          ever move.
        */}
        <span
          style={{
            display: "inline-block",
            position: "relative",
            width: slotWidth || undefined,
            perspective: perspective * em,
            verticalAlign: "baseline",
          }}
        >
          {/* In-flow strut: gives the inline-block its height and its baseline. */}
          <span aria-hidden style={{ visibility: "hidden" }}>
            {words[0] ?? ""}
          </span>

          {words.map((w, i) => {
            const s = stateFor(i);
            if (!s || s.opacity <= 0) return null;
            return (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: words are positional
                key={i}
                style={{
                  ...wordPaint,
                  ...gpu,
                  position: "absolute",
                  left: 0,
                  top: 0,
                  display: "inline-block",
                  width: "max-content",
                  // Everything pivots on the baseline. Anywhere else and the
                  // glyph origins climb the pixel grid in whole-pixel jumps as
                  // the scale moves the baseline, and the word sits still, jumps,
                  // sits still.
                  transformOrigin: `0px ${baseline}px`,
                  transform: `translateY(${s.y}px) rotateX(${s.rotate}deg) scale(${
                    scales[i] * s.scale
                  })`,
                  opacity: s.opacity,
                  filter: s.blur > 0.01 ? `blur(${s.blur}px)` : undefined,
                }}
              >
                {w}
              </span>
            );
          })}
        </span>{" "}
        {suffixChars.map((ch, i) => typedChar(ch, prefix.length + i))}
        {showCaret && !caretInPrefix && <Caret />}
      </span>
    </AbsoluteFill>
  );
}
