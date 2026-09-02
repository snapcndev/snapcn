"use client";

import { loadFont } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  continueRender,
  delayRender,
  Easing,
  getRemotionEnvironment,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
  withAlpha,
} from "@/lib/snap-cn-ui";

// The face the look is made of. Inter at 600 is a subtitle; a caption is a heavy
// geometric grotesque carrying an outline.
const { fontFamily: MONTSERRAT, waitUntilDone: montserratReady } = loadFont(
  "normal",
  {
    weights: ["700", "800", "900"],
    subsets: ["latin"],
  },
);

// The `boxed` look is the YouTube auto-caption, which is set in Roboto — a
// neutral grotesque, not a geometric one.
const { fontFamily: ROBOTO } = loadRoboto("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
});

export type CaptionTheme = "light" | "dark";
export type SafeAreaPreset = "landscape" | "portrait" | "square";

export interface CaptionLine {
  text: string;
  /** First frame the line is on screen and the fill sweep begins. */
  startFrame: number;
  /** Frame the sweep completes; the line fades out shortly after. */
  endFrame: number;
  /**
   * Absolute frame each word starts filling (one entry per word).
   * Omitted → words are spread evenly across [startFrame, endFrame].
   */
  wordTimings?: number[];
  /** Word indices rendered in the accent color with a subtle scale-up. */
  emphasize?: number[];
}

export interface KaraokeCaptionsProps {
  /**
   * Word-level captions in MILLISECONDS — the shape Whisper, CapCut and Remotion's
   * own `@remotion/captions` all speak. This is the input you will actually have.
   */
  captions?: Caption[];
  /** An .srt, pasted straight in. */
  srt?: string;
  /** The look. See {@link KaraokePreset}. */
  preset?: KaraokePreset;
  /** Outline width as a fraction of the font size. 0 turns it off. */
  strokeRatio?: number;
  strokeColor?: string;
  uppercase?: boolean;
  /** Timed caption lines. Omit to build a single line from `text`. */
  lines?: CaptionLine[];
  /** Convenience single line used when `lines` is not provided. */
  text?: string;
  /** Comma-separated words of `text` to emphasize (case-insensitive). */
  emphasize?: string;
  /** Design-system token overrides. */
  theme?: Partial<SnapCnTheme>;
  /**
   * The face this scene paints its words in — a label from `fonts.ts`
   * ("Inter", "Space Grotesk", "Instrument Serif") or a CSS family you have
   * loaded yourself. Unset, the scene keeps the face it was designed around.
   *
   * Overrides `theme.fontFamily`, which is how a brand kit re-skins a whole
   * timeline from one value.
   */
  fontFamily?: string;
  /** Light or dark pill chrome. */
  mode?: CaptionTheme;
  /** Color of emphasized words. */
  accentColor?: string;
  fontSize?: number;
  fontWeight?: number;
  /** Safe-area preset positioning the caption block per aspect ratio. */
  aspect?: SafeAreaPreset;
  /** Rounded surface behind the line. */
  pill?: boolean;
  /** Scale emphasized words grow to as their fill completes. */
  emphasisScale?: number;
  /** Unfilled (not-yet-spoken) word color override. Defaults per theme. */
  baseColor?: string;
  /** Filled (spoken) word color override. Defaults per theme. */
  fillColor?: string;
  speed?: number;
  className?: string;
}

/**
 * The looks.
 *
 * - `karaoke`   — a heavy outlined line; each word snaps from dimmed to full white
 *                 as it is spoken. The read-along look.
 * - `highlight` — the spoken word rides a rounded accent bar that sweeps along the
 *                 line, like a marker running under the voice.
 * - `clean`     — the quiet pill. No outline. (The old default.)
 */
export type KaraokePreset = "boxed" | "karaoke" | "highlight" | "clean";

export interface KaraokeLook {
  weight: number;
  uppercase: boolean;
  /** Font size as a fraction of the frame's SHORT side. */
  sizeRatio: number;
  strokeRatio: number;
  bar: boolean;
  pill: boolean;
  shadow: boolean;
  /** Per-line solid box behind the line (YouTube auto-caption look). */
  box?: boolean;
}

export const KARAOKE_LOOKS: Record<KaraokePreset, KaraokeLook> = {
  /**
   * The default: the YouTube auto-caption — white Roboto on a solid black box
   * that wraps each line tight (`box-decoration-break: clone`). No outline, no
   * sweep; the box carries the contrast.
   */
  boxed: {
    weight: 700,
    uppercase: false,
    sizeRatio: 0.062,
    strokeRatio: 0,
    bar: false,
    pill: false,
    shadow: false,
    box: true,
  },
  karaoke: {
    weight: 900,
    uppercase: true,
    sizeRatio: 0.085,
    strokeRatio: 0.09,
    bar: false,
    pill: false,
    shadow: true,
  },
  highlight: {
    weight: 800,
    uppercase: false,
    sizeRatio: 0.08,
    strokeRatio: 0.07,
    bar: true,
    pill: false,
    shadow: true,
  },
  clean: {
    weight: 600,
    uppercase: false,
    sizeRatio: 0.067,
    strokeRatio: 0,
    bar: false,
    pill: true,
    shadow: false,
  },
};

/** Frames the line takes to rise/fade in and to fade out past `endFrame`. */
export const LINE_FADE_FRAMES = 8;

/**
 * The pill's chrome, taken from the design system.
 *
 * A caption pill IS app chrome — a card floating over footage — so it follows
 * the tokens. The burned-in type it carries does not: its accent, its outline
 * and its white fill are the caption's look, and stay props.
 */
export function karaokePalette(t: SnapCnTheme): {
  base: string;
  fill: string;
  pillBg: string;
  pillBorder: string;
  pillShadow: string;
} {
  return {
    base: t.mutedForeground,
    fill: t.foreground,
    pillBg: withAlpha(t.card, 0.92),
    pillBorder: t.border,
    pillShadow: `0 8px 24px ${withAlpha(t.foreground, 0.1)}`,
  };
}

/**
 * Aspect-ratio safe areas for social placements. Shared caption-block
 * positioning (portrait keeps clear of TikTok/Reels UI chrome).
 */
export const CAPTION_SAFE_AREAS: Record<
  SafeAreaPreset,
  { bottom: string; horizontal: string }
> = {
  landscape: { bottom: "8%", horizontal: "10%" },
  portrait: { bottom: "18%", horizontal: "7%" },
  square: { bottom: "10%", horizontal: "8%" },
};

/** Whitespace-split words, empties dropped. */
export function splitWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

export interface WordWindow {
  start: number;
  end: number;
}

/**
 * Per-word fill windows for a line. Uses `wordTimings` (absolute start
 * frames; a word ends when the next begins, the last at `endFrame`) when
 * provided, otherwise splits [startFrame, endFrame] evenly.
 */
export function wordWindows(line: CaptionLine): WordWindow[] {
  const words = splitWords(line.text);
  const n = words.length;
  if (n === 0) return [];
  const { startFrame, endFrame, wordTimings } = line;
  if (wordTimings && wordTimings.length > 0) {
    return words.map((_, i) => {
      const start = wordTimings[i] ?? wordTimings[wordTimings.length - 1];
      const end = wordTimings[i + 1] ?? endFrame;
      return { start, end: Math.max(end, start + 1) };
    });
  }
  const step = (endFrame - startFrame) / n;
  return words.map((_, i) => ({
    start: startFrame + step * i,
    end: startFrame + step * (i + 1),
  }));
}

/** 0..1 sweep progress of one word at `frame`. */
export function fillProgress(frame: number, window: WordWindow): number {
  if (window.end <= window.start) return frame >= window.end ? 1 : 0;
  return Math.min(
    1,
    Math.max(0, (frame - window.start) / (window.end - window.start)),
  );
}

/**
 * Word indices of `text` matching the comma-separated `emphasize` list.
 * Comparison is case-insensitive and ignores surrounding punctuation.
 */
export function emphasisIndices(text: string, emphasize: string): number[] {
  const targets = emphasize
    .split(",")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length > 0);
  if (targets.length === 0) return [];
  const strip = (w: string) =>
    w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
  return splitWords(text)
    .map((word, i) => (targets.includes(strip(word)) ? i : -1))
    .filter((i) => i >= 0);
}

/** Single demo line built from the convenience `text` prop. */
export function linesFromText(
  text: string,
  emphasize: string,
  startFrame: number,
  endFrame: number,
): CaptionLine[] {
  return [
    {
      text,
      startFrame,
      endFrame: Math.max(endFrame, startFrame + 1),
      emphasize: emphasisIndices(text, emphasize),
    },
  ];
}

/* ---------------------------------------------------------------------------
 * Real transcripts.
 *
 * Nobody has frame numbers. A caption comes out of Whisper, whisper.cpp, CapCut or
 * Descript in MILLISECONDS, or as an .srt. Remotion's own `@remotion/captions` type
 * is `{ text, startMs, endMs }` — so that is what this takes.
 *
 * (Deliberately duplicated from word-captions rather than imported: this is a
 * copy-paste registry, and installing a caption line should not drag a second
 * component in with it.)
 * ------------------------------------------------------------------------- */

/** The standard caption token. Structurally identical to `@remotion/captions`. */
export interface Caption {
  text: string;
  startMs: number;
  endMs: number;
}

/** `00:00:01,234` (or `.234`) → 1234. Null when it isn't a timestamp. */
export function srtTimeToMs(stamp: string): number | null {
  const m = stamp.trim().match(/^(?:(\d+):)?(\d+):(\d+)[,.](\d{1,3})$/);
  if (!m) return null;
  const [, h, min, sec, frac] = m;
  return (
    (h ? Number(h) : 0) * 3600000 +
    Number(min) * 60000 +
    Number(sec) * 1000 +
    Number(frac.padEnd(3, "0"))
  );
}

/** Cues from an .srt. Handles `,` and `.` separators and multi-line cues. */
export function parseSrt(srt: string): Caption[] {
  const out: Caption[] = [];
  for (const raw of srt
    .replace(/\r/g, "")
    .trim()
    .split(/\n\s*\n/)) {
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;
    const [from, to] = timeLine.split("-->").map((t) => t.trim());
    const startMs = srtTimeToMs(from);
    const endMs = srtTimeToMs(to);
    if (startMs === null || endMs === null) continue;
    const text = lines
      .filter((l) => l !== timeLine && !/^\d+$/.test(l.trim()))
      .join(" ")
      .trim();
    if (text) out.push({ text, startMs, endMs });
  }
  return out;
}

/**
 * Captions (ms) → the line model this component draws. One cue is one line; its
 * words are spread across the cue so the fill has something to track. Word-level
 * Whisper output collapses naturally: consecutive words inside `groupWithinMs` of
 * each other become one line, which is how a caption tool builds a line too.
 */
export function linesFromCaptions(
  captions: Caption[],
  fps: number,
  groupWithinMs = 1200,
): CaptionLine[] {
  if (captions.length === 0) return [];
  const toFrame = (ms: number) => (ms / 1000) * fps;

  const groups: Caption[][] = [];
  let current: Caption[] = [];
  for (const c of captions) {
    const prev = current[current.length - 1];
    if (prev && c.startMs - prev.endMs > groupWithinMs) {
      groups.push(current);
      current = [];
    }
    current.push(c);
  }
  if (current.length) groups.push(current);

  return groups.map((group) => {
    const words = group.flatMap((c) => c.text.split(/\s+/).filter(Boolean));
    const startMs = group[0].startMs;
    const endMs = group[group.length - 1].endMs;
    // One timing per word: a multi-word cue is spread across its own span.
    const timings: number[] = [];
    for (const c of group) {
      const parts = c.text.split(/\s+/).filter(Boolean);
      const per = Math.max(1, c.endMs - c.startMs) / Math.max(1, parts.length);
      for (let i = 0; i < parts.length; i++) {
        timings.push(toFrame(c.startMs + i * per));
      }
    }
    return {
      text: words.join(" "),
      startFrame: toFrame(startMs),
      endFrame: Math.max(toFrame(endMs), toFrame(startMs) + 1),
      wordTimings: timings,
    };
  });
}

/**
 * Index of the line on screen at `frame` (the last one whose window contains it,
 * including its fade-out tail), or -1 when nothing is showing.
 */
export function activeLineIndex(
  lines: CaptionLine[],
  frame: number,
  fadeOut = LINE_FADE_FRAMES,
): number {
  let active = -1;
  for (let i = 0; i < lines.length; i++) {
    if (frame >= lines[i].startFrame && frame < lines[i].endFrame + fadeOut) {
      active = i;
    }
  }
  return active;
}

/**
 * A caption line that fills word by word as it is spoken — the read-along look.
 *
 * Same three things that separate a caption from a subtitle:
 *
 * 1. **An OUTSIDE outline.** `-webkit-text-stroke` centres the stroke on the glyph
 *    and eats it from the inside (measured: a 14px stroke takes a 38px stem down to
 *    22px). `paint-order: stroke fill` puts the fill back over it. Without this a
 *    caption is unreadable the moment the footage behind it is bright.
 * 2. **Weight and size.** Montserrat 800–900 at ~8.5% of the frame's short side.
 * 3. **The spoken word actually lands** — it snaps to full white (or rides an accent
 *    bar), rather than easing politely.
 *
 * The emphasis scale pivots on the MEASURED baseline: a browser gives glyph origins
 * no vertical sub-pixel precision, so a scale that moves the baseline makes the word
 * climb the pixel grid in whole-pixel jumps.
 */
export function KaraokeCaptions({
  captions,
  srt,
  lines,
  text = "Acme reconciles every transaction automatically",
  emphasize = "automatically",
  preset = "boxed",
  theme,
  fontFamily,
  mode = "dark",
  accentColor = "#FFE81F",
  fontSize,
  fontWeight,
  aspect = "landscape",
  pill,
  emphasisScale = 1.08,
  baseColor,
  fillColor,
  strokeColor = "#000000",
  strokeRatio,
  uppercase,
  speed = 1,
  className,
}: KaraokeCaptionsProps) {
  const frame = useCurrentFrame() * speed;
  const { durationInFrames, fps, width, height } = useVideoConfig();

  const look = KARAOKE_LOOKS[preset] ?? KARAOKE_LOOKS.karaoke;
  const t = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily ?? t.fontFamily) ?? MONTSERRAT;
  const palette = karaokePalette(t);
  const safeArea = CAPTION_SAFE_AREAS[aspect] ?? CAPTION_SAFE_AREAS.landscape;

  const shortSide = Math.min(width, height);
  // 0 (or omitted) means "the preset decides" — the preset IS the design.
  const size =
    fontSize && fontSize > 0
      ? fontSize
      : Math.round(look.sizeRatio * shortSide);
  const weight = fontWeight && fontWeight > 0 ? fontWeight : look.weight;
  const stroke =
    (strokeRatio !== undefined && strokeRatio >= 0
      ? strokeRatio
      : look.strokeRatio) * size;
  const caps = uppercase ?? look.uppercase;
  const showPill = pill ?? look.pill;

  // An outlined caption is white-on-black by definition; the muted grey of the old
  // "unspoken" colour disappears the moment there is footage behind it. Unspoken
  // words are DIMMED WHITE, which still reads.
  const unfilled =
    baseColor ?? (look.pill ? palette.base : "rgba(255,255,255,0.45)");
  const filled = fillColor ?? (look.pill ? palette.fill : "#FFFFFF");

  // Real captions first; the evenly-paced string is only a demo.
  const resolvedLines = captions?.length
    ? linesFromCaptions(captions, fps)
    : srt && srt.trim().length > 0
      ? linesFromCaptions(parseSrt(srt), fps)
      : lines && lines.length > 0
        ? lines
        : linesFromText(
            text,
            emphasize,
            10,
            Math.max(11, durationInFrames - 24),
          );

  const lineIndex = activeLineIndex(resolvedLines, frame);

  // The baseline inside a word span, measured once — the pivot for the emphasis
  // scale. Guessing it from a line-height ratio is what makes an emphasised word
  // judder.
  const probeRef = useRef<HTMLSpanElement>(null);
  const baseRef = useRef<HTMLSpanElement>(null);
  const [baselineY, setBaselineY] = useState<number | null>(null);
  // The delayRender exists only to hold the *mp4 render* on its first frame until
  // the baseline is measured — there the font is already loaded, so that one
  // measurement is exact. In the Player we never block: `baselineY === null`
  // falls back to a line-height pivot until the mount measurement lands, which is
  // invisible on a looping preview. Blocking the Player here is what stranded
  // every caption card behind an orphaned delayRender handle that React
  // StrictMode's double-invoked initializer creates and never clears.
  const [handle] = useState(() =>
    getRemotionEnvironment().isRendering
      ? delayRender(
          "karaoke-captions: measuring the baseline for the emphasis pivot",
        )
      : null,
  );

  useLayoutEffect(() => {
    const probe = probeRef.current;
    const base = baseRef.current;
    if (probe && base) {
      setBaselineY(
        base.getBoundingClientRect().top - probe.getBoundingClientRect().top,
      );
    } else if (handle != null) {
      // Nothing to measure in a render — release it rather than hang the frame.
      continueRender(handle);
    }
    // Re-measure once Montserrat lands: a best-effort refinement for the Player
    // (the render already has the font). Never blocks — the pivot above is set.
    let cancelled = false;
    void montserratReady().then(() => {
      if (cancelled) return;
      const p = probeRef.current;
      const b = baseRef.current;
      if (p && b) {
        setBaselineY(
          b.getBoundingClientRect().top - p.getBoundingClientRect().top,
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  // In a render, release the held first frame the moment the baseline is known.
  useEffect(() => {
    if (baselineY != null && handle != null) continueRender(handle);
  }, [baselineY, handle]);

  const lineHeight = Math.round(size * 1.2);
  const willChange = getRemotionEnvironment().isRendering
    ? undefined
    : ("transform" as const);

  const typeStyle = {
    fontFamily: face,
    fontWeight: weight,
    fontSize: size,
    lineHeight: `${lineHeight}px`,
    letterSpacing: caps ? "-0.005em" : "-0.015em",
    textRendering: "geometricPrecision" as const,
    fontVariantLigatures: "none" as const,
  };

  const outline =
    stroke > 0
      ? {
          WebkitTextStrokeWidth: `${stroke}px`,
          WebkitTextStrokeColor: strokeColor,
          // Stroke first, fill over it — an OUTSIDE outline, not one eating the glyph.
          paintOrder: "stroke fill" as const,
        }
      : {};

  const shadow = look.shadow
    ? { textShadow: `0 ${size * 0.05}px ${size * 0.045}px rgba(0,0,0,0.42)` }
    : {};

  const probe = (
    <span
      ref={probeRef}
      aria-hidden
      style={{
        ...typeStyle,
        position: "absolute",
        left: -99999,
        top: 0,
        visibility: "hidden",
        display: "inline-block",
      }}
    >
      Hg
      <span
        ref={baseRef}
        style={{ display: "inline-block", width: 0, height: 0 }}
      />
    </span>
  );

  if (lineIndex === -1) {
    // The probe still has to mount, or delayRender never resolves and the render hangs.
    return (
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {probe}
      </div>
    );
  }

  const line = resolvedLines[lineIndex];
  const words = splitWords(line.text);
  const windows = wordWindows(line);
  const emphasized = new Set(line.emphasize ?? []);

  const enter = interpolate(
    frame - line.startFrame,
    [0, LINE_FADE_FRAMES],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const exit = interpolate(
    frame - line.endFrame,
    [0, LINE_FADE_FRAMES],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: safeArea.bottom,
        paddingLeft: safeArea.horizontal,
        paddingRight: safeArea.horizontal,
        pointerEvents: "none",
      }}
    >
      {probe}
      {look.box ? (
        <div
          style={{
            maxWidth: Math.round(width * 0.82),
            textAlign: "center",
            opacity: Math.min(enter, exit),
          }}
        >
          {/* White Roboto on a solid black box that clones per line — the
              YouTube auto-caption look. Inline text so the box wraps each line. */}
          <span
            style={{
              ...typeStyle,
              fontFamily: ROBOTO,
              display: "inline",
              color: "#FFFFFF",
              backgroundColor: "rgba(0,0,0,0.9)",
              padding: `${size * 0.06}px ${size * 0.32}px`,
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
              lineHeight: `${Math.round(size * 1.46)}px`,
              borderRadius: 2,
            }}
          >
            {caps ? line.text.toUpperCase() : line.text}
          </span>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "center",
            columnGap: size * 0.28,
            rowGap: size * 0.06,
            textAlign: "center",
            opacity: Math.min(enter, exit),
            ...(showPill
              ? {
                  padding: `${size * 0.3}px ${size * 0.55}px`,
                  borderRadius: size * 0.24,
                  background: palette.pillBg,
                  border: `1px solid ${palette.pillBorder}`,
                  boxShadow: palette.pillShadow,
                }
              : {}),
          }}
        >
          {words.map((word, i) => {
            const progress = fillProgress(frame, windows[i]);
            const spoken = progress >= 0.999;
            const isEmphasized = emphasized.has(i);
            const scale = isEmphasized
              ? interpolate(progress, [0, 1], [1, emphasisScale], {
                  easing: Easing.out(Easing.cubic),
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 1;

            // The bar preset: the spoken word rides a rounded accent block.
            const onBar =
              look.bar && progress > 0 && !spoken ? false : look.bar && spoken;
            const color = look.bar
              ? spoken
                ? "#0B0B0C"
                : unfilled
              : isEmphasized && spoken
                ? accentColor
                : spoken
                  ? filled
                  : unfilled;

            return (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: words in a line repeat, so the index is what makes each key unique
                key={`${word}-${i}`}
                style={{
                  ...typeStyle,
                  ...outline,
                  ...shadow,
                  display: "inline-block",
                  color,
                  transform: `scale(${scale})`,
                  // Pivot on the BASELINE. `50% 80%` is a guess, and a guess drags the
                  // word down the pixel grid as it scales.
                  transformOrigin:
                    baselineY === null ? "50% 82%" : `50% ${baselineY}px`,
                  willChange,
                  ...(onBar
                    ? {
                        background: accentColor,
                        borderRadius: size * 0.14,
                        padding: `0 ${size * 0.11}px`,
                        WebkitTextStrokeWidth: 0,
                      }
                    : {}),
                }}
              >
                {caps ? word.toUpperCase() : word}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
