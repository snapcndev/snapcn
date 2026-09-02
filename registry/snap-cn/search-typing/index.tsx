"use client";

import { loadFont } from "@remotion/google-fonts/Outfit";
import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  continueRender,
  delayRender,
  Easing,
  getRemotionEnvironment,
  interpolate,
  random,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Caret } from "@/components/snap-cn/caret";
import { inputStyleContext } from "@/components/snap-cn/input";
import {
  mixOklch,
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";

// Outfit Light. Identified by measuring the reference's letterforms against a
// field of candidates: its stem/cap ratio is 0.121, and Outfit 300 is the only
// geometric face that hits that exactly (stem 12px at a 99px cap, like for like).
// Loaded through @remotion/google-fonts rather than a CSS variable so the Player,
// the rendered mp4 and a user's own project all get the same face.
const { fontFamily: OUTFIT } = loadFont("normal", {
  weights: ["300", "400"],
  subsets: ["latin"],
});

/**
 * `shadcn` — the field is a shadcn Input: a card surface, a hairline border, and a
 * shadow you have to look for. Correct on a light page, and the default.
 * `glass`  — the field the reference uses: a grey crown falling to white, lit from
 * below. It is measured, and it only works on a DARK backdrop; on a light one the
 * crown reads as dirt and the shadow as a smear.
 */
export type SearchTypingSurface = "shadcn" | "glass";
export type SearchTypingIcon = "search" | "sparkle" | "none";

export interface SearchTypingProps {
  /** The sentence typed into the field, one character at a time. */
  text: string;
  /** Typing speed. 14 is what the reference does. */
  charsPerSecond?: number;
  /**
   * Keystroke-interval variance, 0–1. 0 is a metronome. Deterministic — every
   * interval is drawn from `seed`, never from a clock.
   */
  humanize?: number;
  /** Beat after a space, as a multiple of the base keystroke interval. */
  wordPause?: number;
  /** Beat after `.,!?;:`, as a multiple of the base keystroke interval. */
  punctuationPause?: number;
  /** Seconds the field holds, parked and blinking, before the first keystroke. */
  startDelay?: number;
  /** Seconds the field takes to come forward once typing starts. */
  dollyDuration?: number;
  /** Seconds the field takes to slide from its left half to its right half. */
  panDuration?: number;
  /** Seconds the finished sentence holds at the front before the field goes back. */
  holdAfter?: number;
  /**
   * Seconds the field takes to travel back. It goes back *further* than it
   * started — far enough that the whole field lands in frame, which is the only
   * moment you see it and the finished sentence at once. 0 parks it at the front.
   */
  recedeDuration?: number;
  /**
   * How much bigger the field gets as it comes forward. 1.25 is what the
   * reference measures. `frontVisible × dolly` is how much of the field is in
   * frame at rest — 0.56 × 1.25 = 0.70, roughly the two thirds you see there.
   */
  dolly?: number;
  /**
   * The field's height on screen, as a fraction of the frame's. This is the knob
   * that makes the field look long and slim rather than chunky: it sets the
   * height directly, and the text — which is a fixed ratio of it — comes with it.
   */
  fieldHeight?: number;
  /**
   * How much of the field is in frame once it has come forward. The field is
   * padded out to whatever length that needs, so this and `fieldHeight` are
   * independent — which they are not if the field is only as long as its
   * sentence. (A real search field is longer than what you type into it.)
   */
  frontVisible?: number;
  /** Margin, in px, between the field's visible cap and the edge of the frame. */
  edgeInset?: number;
  /** Blinks per second. 1 is the ~500ms-on/500ms-off of a real text field. */
  caretBlinksPerSecond?: number;
  caret?: boolean;
  surface?: SearchTypingSurface;
  /** Design-system token overrides, same shape every snap-cn-ui component takes. */
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
  icon?: SearchTypingIcon;
  fontFamily?: string;
  fontWeight?: number;
  /** Seeds `humanize`. Same seed, same performance, forever. */
  seed?: string;
  /** Global playback multiplier applied to the whole sequence. */
  speed?: number;
  className?: string;
}

/**
 * Every proportion below was measured off the reference frames, as a ratio of the
 * field's height (373px there). They are ratios and not pixels so the whole
 * component scales as one piece.
 *
 *   radius 103/373 = 0.276  — NOT a pill. A pill would be 0.500.
 *   cap height 99/373, and cap ≈ 0.70em, so fontSize/height = 0.379
 *   left cap → text start = 382/373
 *   left cap → icon = 133/373;  icon box 141/373;  icon stroke 12/373
 *   caret 9×162 /373
 */
const R = {
  radius: 0.276,
  fontSize: 0.379,
  /**
   * Left cap → the first glyph's INK. The text box has to start a touch earlier
   * than that, because the "W" carries a side bearing: measured on the render,
   * that bearing is 0.021 × the field's height.
   */
  textInk: 1.024,
  sideBearing: 0.021,
  iconInset: 0.357,
  iconSize: 0.378,
  /**
   * The reference measures 0.62 here — but the reference's field is never seen
   * whole, so nobody ever sees its right padding next to its left. This one IS
   * seen whole at the end, and 0.62 against a 0.357 left inset does not read as
   * padding, it reads as a word missing off the end of the sentence. Balanced
   * against the left instead.
   */
  rightPad: 0.4,
  caretWidth: 0.024,
  caretHeight: 0.434,
  /**
   * Outfit sits its baseline 0.017 × height lower than the reference does once the
   * line box is centred in the field. The line box's height cannot fix that — a
   * centred line box puts the baseline at `H/2 − content/2 + ascent`, which is a
   * property of the face, not of the leading — so the text is nudged instead.
   */
  baselineNudge: 0.017,
} as const;

/**
 * The field's height in layout px. Purely a unit — every other measurement is a
 * ratio of it, and the camera rescales the whole thing to whatever `fieldHeight`
 * asks for. Nothing on screen changes if you change it.
 */
const LAYOUT_UNIT = 240;

/** Where the text box starts, so that its first glyph's ink lands on the mark. */
const R_TEXT_LEFT = R.textInk - R.sideBearing;
/** Left cap → text, minus the icon and its inset, is the gap after the icon. */
const R_GAP = R_TEXT_LEFT - R.iconInset - R.iconSize;

const PUNCTUATION = /[.,!?;:]/;

/** The push runs while the sentence is being typed, so it must not crawl at the end. */
const DOLLY_EASING = Easing.inOut(Easing.sin);
/** The page across is a deliberate move: it leaves and arrives. */
const PAN_EASING = Easing.inOut(Easing.cubic);
const BACK_EASING = Easing.inOut(Easing.cubic);

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

export interface TypingScheduleOptions {
  fps: number;
  charsPerSecond: number;
  humanize: number;
  wordPause: number;
  punctuationPause: number;
  seed: string;
}

/**
 * The frame each prefix length lands on: `schedule[n]` is the frame at which the
 * field shows exactly `n` characters. Strictly monotonic by construction, which
 * is what {@link typedCount} relies on and why a scrub can never un-type a letter.
 */
export function buildTypingSchedule(
  text: string,
  opts: TypingScheduleOptions,
): number[] {
  const { fps, charsPerSecond, humanize, wordPause, punctuationPause, seed } =
    opts;
  const base = fps / Math.max(0.1, charsPerSecond);
  const jitter = clamp01(humanize);

  const schedule: number[] = [0];
  let acc = 0;

  for (let i = 0; i < text.length; i++) {
    // The rest belongs to the gap *before* this character — a typist pauses after
    // finishing a word, not before typing the space itself.
    const prev = i > 0 ? text[i - 1] : "";
    let interval = base;
    if (prev === " ") {
      interval *= wordPause;
    } else if (prev !== "" && PUNCTUATION.test(prev)) {
      interval *= punctuationPause;
    }
    if (jitter > 0) {
      const r = random(`${seed}-key-${i}`) * 2 - 1;
      interval *= 1 + r * 0.35 * jitter;
    }
    acc += Math.max(0.001, interval);
    schedule.push(acc);
  }

  return schedule;
}

/** Characters visible at `localFrame`, given a monotonic {@link buildTypingSchedule}. */
export function typedCount(localFrame: number, schedule: number[]): number {
  if (localFrame <= 0 || schedule.length <= 1) return 0;
  let n = 0;
  while (n + 1 < schedule.length && schedule[n + 1] <= localFrame) n++;
  return n;
}

/**
 * The character that starts the page across. Null when the sentence fits in the
 * first half and the field never has to move.
 *
 * `triggerX` is deliberately NOT the frame's edge. The pan eases in, so for its
 * first few frames the field has barely moved while the typing carries the caret
 * on rightwards — fire the pan *at* the edge and the caret spills over it before
 * the field catches up. {@link PAN_TRIGGER} keeps a couple of characters' worth of
 * lead in hand.
 */
export function pageTriggerIndex(
  advances: number[],
  textLeft: number,
  scale: number,
  triggerX: number,
): number | null {
  for (let n = 1; n < advances.length; n++) {
    if ((textLeft + advances[n]) * scale > triggerX) return n;
  }
  return null;
}

/** Fraction of the page at which the caret hands the shot over to the pan. */
const PAN_TRIGGER = 0.88;

export interface CameraMarks {
  typingStart: number;
  dollyEnd: number;
  panStart: number | null;
  panEnd: number;
  holdEnd: number;
  recedeEnd: number;
}

/**
 * 0 = parked back, 1 = fully forward. Rises across the dolly and then holds — it
 * does NOT come back down. The retreat is a separate move to a separate depth.
 */
export function cameraPush(frame: number, m: CameraMarks): number {
  if (m.dollyEnd <= m.typingStart) return frame >= m.typingStart ? 1 : 0;
  return interpolate(frame, [m.typingStart, m.dollyEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: DOLLY_EASING,
  });
}

/**
 * 0 = still at the front, 1 = fully retreated.
 *
 * The field does not go back to where it started. It goes back **further** — far
 * enough that the whole of it lands in frame, which is the only moment in the clip
 * you ever see the complete field and the complete sentence at once. That is the
 * payoff, so it gets its own depth rather than reusing the resting one.
 */
export function cameraRetreat(frame: number, m: CameraMarks): number {
  if (m.recedeEnd <= m.holdEnd) return 0;
  return interpolate(frame, [m.holdEnd, m.recedeEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: BACK_EASING,
  });
}

/** 0 = the field's left half is in frame, 1 = its right half is. */
export function cameraPan(frame: number, m: CameraMarks): number {
  if (m.panStart === null || m.panEnd <= m.panStart) return 0;
  return interpolate(frame, [m.panStart, m.panEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: PAN_EASING,
  });
}

export interface CaretBlinkOptions {
  fps: number;
  blinksPerSecond: number;
  softness?: number;
}

/**
 * A real caret is a hard square wave. At 60fps a hard edge reads as a strobe, so
 * only the edges are eased — it still spends most of the cycle fully on and fully
 * off, it just doesn't snap between them.
 */
export function caretOpacity(frame: number, opts: CaretBlinkOptions): number {
  const { fps, blinksPerSecond } = opts;
  if (blinksPerSecond <= 0 || fps <= 0) return 1;

  const period = fps / blinksPerSecond;
  if (period <= 0) return 1;

  const t = (((frame % period) + period) % period) / period;
  const edge = Math.min(0.25, Math.max(0, opts.softness ?? 0.12));
  if (edge === 0) return t < 0.5 ? 1 : 0;

  if (t < 0.5 - edge) return 1;
  if (t < 0.5) return 1 - smoothstep((t - (0.5 - edge)) / edge);
  if (t < 1 - edge) return 0;
  return smoothstep((t - (1 - edge)) / edge);
}

/**
 * The magnifier's INK fills the viewBox exactly — circle at (9, 9) r=7.98 with a
 * 2.03 stroke reaches x=0, and the round-capped handle reaches x=24. That matters:
 * `iconSize` is the reference's measured ink extent (0.378 × the field's height),
 * so if the glyph sat inside its box with air around it, it would come out
 * noticeably smaller than the reference's. It did, the first time.
 */
function SearchGlyph({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0, overflow: "visible" }}
    >
      <circle cx="9" cy="9" r="7.98" stroke={color} strokeWidth={2.03} />
      <path
        d="M14.65 14.65 L22.98 22.98"
        stroke={color}
        strokeWidth={2.03}
        strokeLinecap="round"
      />
    </svg>
  );
}

function SparkleGlyph({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0, overflow: "visible" }}
    >
      <path
        d="M12 2.6 L13.9 9.1 L20.4 11 L13.9 12.9 L12 19.4 L10.1 12.9 L3.6 11 L10.1 9.1 Z"
        fill={color}
      />
      <path
        d="M18.9 16.4 L19.7 19.1 L22.4 19.9 L19.7 20.7 L18.9 23.4 L18.1 20.7 L15.4 19.9 L18.1 19.1 Z"
        fill={color}
        opacity={0.55}
      />
    </svg>
  );
}

interface Metrics {
  /** Cumulative advance of each character prefix, in layout px. */
  advances: number[];
  /** Y of the text baseline, in layout px from the top of the field. */
  baselineY: number;
  /** The field's full width in layout px — it is sized by its own content. */
  fieldWidth: number;
}

/**
 * A search field that is wider than the shot, on a dolly.
 *
 * Two thirds of it are in frame to begin with, parked back. On the first keystroke
 * it comes forward, and now only its left half fits. The sentence types across that
 * half; when the caret runs out of frame the field slides, and its right half comes
 * in. The sentence finishes there, and the field goes back.
 *
 * The two things that make scaled type look cheap are both handled:
 *
 *  1. **The scale pivots on the text baseline.** A browser gives glyph origins no
 *     vertical sub-pixel precision — it rounds them to a whole device pixel — so a
 *     scale that *moves* the baseline makes the type climb the pixel grid in whole
 *     pixel jumps. Pivot on it and its device Y never changes. Measured, not
 *     guessed from a line-height.
 *  2. **`text-rendering: geometricPrecision`.** Hinting bends each glyph so its
 *     stems land on whole pixels; under a sliding scale they re-snap every frame
 *     and the letterforms boil.
 *
 * The sentence itself is laid out once, in full, and revealed by clipping to a
 * measured character boundary — never re-sliced, so a settled glyph cannot re-kern
 * as the next one lands.
 */
export function SearchTyping({
  text,
  charsPerSecond = 14,
  humanize = 0.35,
  wordPause = 1.55,
  punctuationPause = 2.2,
  startDelay = 0.5,
  dollyDuration = 0.8,
  panDuration = 0.5,
  holdAfter = 0.9,
  recedeDuration = 1.2,
  dolly = 1.25,
  fieldHeight = 0.27,
  frontVisible = 0.56,
  edgeInset = 40,
  caretBlinksPerSecond = 1,
  caret = true,
  surface = "shadcn",
  theme,
  mode,
  icon = "search",
  fontFamily,
  fontWeight = 300,
  seed = "search-typing",
  speed = 1,
  className,
}: SearchTypingProps) {
  const frame = useCurrentFrame();
  const { fps, width: frameWidth, height: frameHeight } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily ?? t.fontFamily) ?? OUTFIT;
  // The very same context the shadcn <Input> paints itself from, so this field and
  // that one cannot drift apart.
  const ui = inputStyleContext(t);
  const resolvedFontFamily = face;

  const H = LAYOUT_UNIT;
  const fontSize = R.fontSize * H;
  const textLeft = R_TEXT_LEFT * H;
  const caretWidth = Math.max(1, R.caretWidth * H);
  const caretHeight = R.caretHeight * H;
  const iconSize = R.iconSize * H;
  const lineHeight = Math.round(fontSize * 1.4);

  const schedule = buildTypingSchedule(text, {
    fps,
    charsPerSecond,
    humanize,
    wordPause,
    punctuationPause,
    seed,
  });

  const clock = frame * speed;
  const typingStart = startDelay * fps;
  const typingEnd = typingStart + (schedule[schedule.length - 1] ?? 0);
  const count = typedCount(clock - typingStart, schedule);

  // ---- measurement -------------------------------------------------------
  const cameraRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const baselineRef = useRef<HTMLSpanElement>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [handle] = useState(() =>
    delayRender("search-typing: measuring field, baseline and advances"),
  );

  useLayoutEffect(() => {
    const camEl = cameraRef.current;
    const fieldEl = fieldRef.current;
    const textEl = textRef.current;
    const baseEl = baselineRef.current;
    if (!camEl || !fieldEl || !textEl || !baseEl) return;
    let cancelled = false;

    const measure = () => {
      if (cancelled) return;

      // getBoundingClientRect reports *device* px, so it sees the camera's scale
      // and would hand back every advance multiplied by it. Switch the transform
      // off for the read; useLayoutEffect runs before paint, so it never shows.
      const previous = camEl.style.transform;
      camEl.style.transform = "none";

      const fieldRect = fieldEl.getBoundingClientRect();
      const baselineY = baseEl.getBoundingClientRect().top - fieldRect.top;
      const fieldWidth = fieldRect.width;

      const advances: number[] = [0];
      const node = textEl.firstChild;
      if (node) {
        // The run is `white-space: pre` and holds the *whole* sentence, so a range
        // ending on a space is never a trailing space — its advance is real. That
        // is why the caret sits after the space in "the most |".
        const range = document.createRange();
        for (let i = 1; i <= text.length; i++) {
          range.setStart(node, 0);
          range.setEnd(node, i);
          advances.push(range.getBoundingClientRect().width);
        }
      }

      camEl.style.transform = previous;
      setMetrics({ advances, baselineY, fieldWidth });
    };

    // Measuring against a fallback face measures the wrong face: the real one swaps
    // in a frame later and every advance — and the baseline — moves.
    if (typeof document !== "undefined" && document.fonts) {
      if (document.fonts.status === "loaded") measure();
      else void document.fonts.ready.then(measure);
    } else {
      measure();
    }

    return () => {
      cancelled = true;
    };
  }, [text]);

  useEffect(() => {
    if (metrics) continueRender(handle);
  }, [metrics, handle]);

  // ---- camera ------------------------------------------------------------
  const pageWidth = frameWidth - edgeInset * 2;

  // The scale is set by the height we want the field to READ at, not by its
  // length. Length is then whatever the framing needs — the field is padded out
  // to it. Doing this the other way round is what made the field chunky: a field
  // only as long as its sentence has a fixed aspect, so demanding that half of it
  // fill the frame forces its height.
  const frontScale = (fieldHeight * frameHeight) / H;
  const restScale = frontScale / Math.max(1.0001, dolly);

  // The field's natural length: icon + sentence + the reference's padding.
  const naturalWidth = metrics?.fieldWidth ?? frameWidth * 2;
  const framedWidth =
    pageWidth / Math.max(0.05, Math.min(1, frontVisible)) / frontScale;
  // Never shorter than its own content — a long sentence simply makes a long field.
  const fieldWidth = Math.max(naturalWidth, framedWidth);

  const advances = metrics?.advances ?? null;
  const triggerIndex = advances
    ? pageTriggerIndex(advances, textLeft, frontScale, pageWidth * PAN_TRIGGER)
    : null;

  const marks: CameraMarks = {
    typingStart,
    dollyEnd: typingStart + dollyDuration * fps,
    panStart:
      triggerIndex !== null ? typingStart + schedule[triggerIndex] : null,
    panEnd:
      triggerIndex !== null
        ? typingStart + schedule[triggerIndex] + panDuration * fps
        : 0,
    holdEnd: typingEnd + holdAfter * fps,
    recedeEnd: typingEnd + holdAfter * fps + recedeDuration * fps,
  };

  // The depth the field ends at: exactly wide enough that the whole of it fits the
  // page. `edgeInset` then leaves it an equal margin on both sides, so anchoring
  // the retreat on its right cap lands it centred without any special case.
  const endScale = pageWidth / Math.max(1, fieldWidth);

  const push = cameraPush(clock, marks);
  const back = cameraRetreat(clock, marks);
  const pan = cameraPan(clock, marks);

  // rest → front on the push, then front → end on the retreat.
  const forward = restScale + (frontScale - restScale) * push;
  const scale = forward + (endScale - forward) * back;

  // Left cap pinned to the frame's left edge, or right cap pinned to its right —
  // the pan crossfades between the two anchors. Because the right anchor is a
  // function of the *current* scale, the retreat pulls back around the right cap
  // instead of dragging it off screen.
  const leftAnchored = edgeInset;
  const rightAnchored = frameWidth - edgeInset - fieldWidth * scale;
  const originX = leftAnchored + (rightAnchored - leftAnchored) * pan;

  const contentWidth = advances ? advances[advances.length - 1] : 0;
  const caretX = advances ? advances[Math.min(count, advances.length - 1)] : 0;

  const blinkOpacity = caretOpacity(clock, {
    fps,
    blinksPerSecond: caretBlinksPerSecond,
  });

  const baselineY = metrics?.baselineY ?? H / 2;

  // NO drop shadow. shadcn defines a control with a hairline border, not with a
  // shadow doing the border's job — and a shadow big enough to be seen under a
  // field this size is a grey smear on a light page, which is what the first two
  // attempts here looked like. The border carries it, and the field is clean.
  // A hairline is specified for a ~40px control, where 1px is 2.5% of its height.
  // This field is five times that, so the same hairline all but disappears — the
  // border has to be stepped up, in weight AND in contrast, or the field has no
  // edge at all. Both still come from the design system: the width is a ratio of
  // the field's height, and the colour is the hairline walked toward the
  // foreground with the system's own `mixOklch`.
  const border = Math.max(1, 0.009 * H);
  const borderColor = mixOklch(ui.idleBorder, t.foreground, 0.28);
  const shadcnSurface = {
    background: t.card,
    border: `${border}px solid ${borderColor}`,
    boxShadow: "none",
  };
  // The reference's field, measured: a grey crown falling to white, lit from below.
  // It is lit for a DARK backdrop — on a light one the crown reads as an inner
  // shadow and the drop shadow as a smear. Opt in only over something dark.
  const glassSurface = {
    background:
      "linear-gradient(180deg, #C4C4C4 0%, #D6D6D6 15%, #E7E7E7 30%, #F3F3F3 40%, #FDFDFD 50%, #FDFDFD 100%)",
    border: "none",
    boxShadow: `0 ${0.045 * H}px ${0.12 * H}px rgba(9, 9, 12, 0.45)`,
  };
  const field = surface === "glass" ? glassSurface : shadcnSurface;
  const inkColor = surface === "glass" ? "#000000" : ui.foreground;
  const iconColor = surface === "glass" ? "#000000" : ui.mutedForeground;

  const textStyle: CSSProperties = {
    fontSize,
    fontWeight,
    fontFamily: resolvedFontFamily,
    lineHeight: `${lineHeight}px`,
    color: inkColor,
    whiteSpace: "pre",
    // A ligature is one glyph for two characters; clipping through one would paint
    // half an "fi".
    fontVariantLigatures: "none",
    fontKerning: "normal",
    // The type rides a moving scale, so hinting would re-snap every stem to the
    // pixel grid each frame and the letterforms would boil.
    textRendering: "geometricPrecision",
    display: "block",
  };

  // box-shadow takes no percentages, so the offsets are computed from the field's
  // height — the shadow then scales with the field instead of detaching from it.

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div
        ref={cameraRef}
        style={{
          position: "absolute",
          left: 0,
          top: (frameHeight - H) / 2,
          transform: `translateX(${originX}px) scale(${scale})`,
          // x=0 is the field's left cap, so translateX places it exactly. y is the
          // baseline, so the type cannot climb the pixel grid as the scale moves.
          transformOrigin: `0px ${baselineY}px`,
          ...(getRemotionEnvironment().isRendering
            ? null
            : { willChange: "transform" as const }),
        }}
      >
        <div
          ref={fieldRef}
          className={className}
          style={{
            display: "flex",
            alignItems: "center",
            // max-content until the content has been measured; then the field is
            // padded out to the length the framing wants.
            width: metrics ? fieldWidth : "max-content",
            height: H,
            paddingLeft: R.iconInset * H,
            paddingRight: R.rightPad * H,
            gap: R_GAP * H,
            borderRadius: R.radius * H,
            background: field.background,
            border: field.border,
            boxShadow: field.boxShadow,
            boxSizing: "border-box",
          }}
        >
          {icon === "search" ? (
            <SearchGlyph size={iconSize} color={iconColor} />
          ) : null}
          {icon === "sparkle" ? (
            <SparkleGlyph size={iconSize} color={iconColor} />
          ) : null}

          <div
            style={{
              position: "relative",
              height: lineHeight,
              flexShrink: 0,
              // Lifts the line onto the reference's baseline. The caret and the
              // measured baselineY ride along with it, so the pivot stays true.
              marginTop: -2 * R.baselineNudge * H,
            }}
          >
            <span
              ref={textRef}
              style={{
                ...textStyle,
                // Negative vertical insets so ascenders and descenders are never
                // clipped; only the right edge does any work.
                clipPath: `inset(-0.5em ${Math.max(0, contentWidth - caretX)}px -0.5em 0)`,
              }}
            >
              {text}
              <span
                ref={baselineRef}
                style={{ display: "inline-block", width: 0, height: 0 }}
              />
            </span>

            {caret ? (
              <Caret
                color={inkColor}
                width={caretWidth}
                height={caretHeight}
                radius={0}
                opacity={blinkOpacity}
                style={{
                  position: "absolute",
                  left: caretX,
                  top: (lineHeight - caretHeight) / 2,
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface SearchTypingDurationOptions extends TypingScheduleOptions {
  startDelay: number;
  holdAfter: number;
  recedeDuration: number;
}

/**
 * Frames the whole clip needs: the lead-in, the typing, the hold at the front and
 * the retreat. The camera's dolly and pan both finish inside the typing, so they
 * never extend it.
 */
export function searchTypingDuration(
  text: string,
  opts: SearchTypingDurationOptions,
): number {
  const schedule = buildTypingSchedule(text, opts);
  const typing = schedule[schedule.length - 1] ?? 0;
  return Math.ceil(
    opts.startDelay * opts.fps +
      typing +
      opts.holdAfter * opts.fps +
      opts.recedeDuration * opts.fps,
  );
}
