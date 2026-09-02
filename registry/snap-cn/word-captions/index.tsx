"use client";

import { loadFont } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadRoboto } from "@remotion/google-fonts/Roboto";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  continueRender,
  delayRender,
  getRemotionEnvironment,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
  withAlpha,
} from "@/lib/snap-cn-ui";

// Montserrat, 700–900. This is the face the look is actually made of: the caption
// styles every big channel uses are a heavy geometric grotesque, and Inter at 700
// simply is not heavy enough to carry a stroke. Loaded through
// @remotion/google-fonts so the Player, the mp4 and a user's project all agree.
const { fontFamily: MONTSERRAT, waitUntilDone: montserratReady } = loadFont(
  "normal",
  {
    weights: ["700", "800", "900"],
    subsets: ["latin"],
  },
);

// The `boxed` look is the YouTube/CapCut auto-caption, and that is set in Roboto
// — a neutral grotesque, not a geometric one. Montserrat would read as a logo.
const { fontFamily: ROBOTO } = loadRoboto("normal", {
  weights: ["500", "700"],
  subsets: ["latin"],
});

export type CaptionAspect = "16:9" | "1:1" | "9:16";
export type CaptionActiveStyle = "pop" | "highlight" | "color";

/**
 * The four looks, and they are not invented — they are the caption styles that
 * actually run on big channels:
 *
 * - `beast`   — ALL CAPS, Montserrat Black, white with a heavy black outline and a
 *               hard shadow; the spoken word snaps to yellow and springs. The
 *               YouTube-hook look.
 * - `hormozi` — same weight class, but the spoken word lands inside a filled
 *               rounded block that cycles through an accent set. Reads at a glance
 *               on a phone.
 * - `pop`     — sentence case, outlined, the spoken word takes the accent and pops.
 *               Punchy without shouting.
 * - `clean`   — a quiet pill. No outline. For product footage where captions are
 *               support, not the show. (The old default.)
 */
export type CaptionPreset =
  | "boxed"
  | "youtube"
  | "beast"
  | "hormozi"
  | "pop"
  | "clean";

export interface CaptionWord {
  text: string;
  startFrame: number;
  /** Defaults to the next word's startFrame (or startFrame + fallback for the last word). */
  endFrame?: number;
}

/** A caption word with its endFrame resolved. */
export interface TimedWord {
  text: string;
  startFrame: number;
  endFrame: number;
}

/** One caption beat: 1–3 words shown together in the pill. */
export interface CaptionGroup {
  words: TimedWord[];
  startFrame: number;
  endFrame: number;
}

export interface WordCaptionsProps {
  /**
   * Word-level captions in MILLISECONDS — the shape Whisper, whisper.cpp, CapCut,
   * Submagic and Remotion's own `@remotion/captions` all speak. This is the input
   * you will actually have.
   */
  captions?: Caption[];
  /** An .srt, pasted straight in. Cues are split into words automatically. */
  srt?: string;
  /** The look. See {@link CaptionPreset}. */
  preset?: CaptionPreset;
  /** Words per page. Defaults per preset. */
  maxWords?: number;
  /** Character budget per page — what stops a page wrapping into a tower. */
  maxChars?: number;
  /** A pause longer than this (ms) starts a new page. */
  pageBreakMs?: number;
  /**
   * Outline width, as a fraction of the font size. This is what makes a caption
   * legible on ANY footage, and it is why hand-rolled captions look cheap without
   * it. 0 turns it off.
   */
  strokeRatio?: number;
  strokeColor?: string;
  /** Force upper case. Defaults per preset — the loud ones shout.  */
  uppercase?: boolean;
  /** Accent set the `hormozi` block cycles through, one colour per beat. */
  accentCycle?: string[];
  /**
   * Timed transcript. Pass an array of `{ text, startFrame, endFrame? }`
   * (e.g. mapped from Whisper word timestamps), or a plain string that is
   * paced evenly at `framesPerWord`.
   */
  words?: CaptionWord[] | string;
  /** Tokens shown per caption beat (1–3). */
  groupSize?: number;
  /** How the currently-spoken word is emphasized. */
  activeStyle?: CaptionActiveStyle;
  /** Safe-area position preset for the target frame shape. */
  aspect?: CaptionAspect;
  /** Max width of the caption block in px. */
  maxWidth?: number;
  fontSize?: number;
  /** Overrides the design system's `foreground`. */
  textColor?: string;
  /** Design-system token overrides. */
  theme?: Partial<SnapCnTheme>;
  /** Defaults to `"dark"` — a caption scrim is lit for footage. */
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
  /** Backdrop pill behind the caption line. Any CSS color; empty string hides it. */
  pillColor?: string;
  /** Active-word accent used by the `highlight` and `color` styles. */
  accentColor?: string;
  /** Pacing (frames per word) used when `words` is a plain string. */
  framesPerWord?: number;
  fontWeight?: number;
  speed?: number;
  className?: string;
}

/**
 * Bottom inset of the caption block per aspect, as a percentage of the
 * composition height — keeps captions clear of platform chrome (9:16 stays
 * above the feed UI, 16:9 sits in the lower third).
 */
export const SAFE_AREA_BOTTOM_PCT: Record<CaptionAspect, number> = {
  "16:9": 8,
  "1:1": 11,
  "9:16": 20,
};

/** Clamps the beat size to the supported 1–3 token range. */
export function clampGroupSize(groupSize: number): number {
  if (!Number.isFinite(groupSize)) return 1;
  return Math.min(3, Math.max(1, Math.floor(groupSize)));
}

/** Evenly paces a plain transcript string into timed words. */
export function scheduleWords(
  text: string,
  framesPerWord: number,
  startFrame = 0,
): CaptionWord[] {
  const pace = Math.max(1, framesPerWord);
  return text
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token, i) => ({
      text: token,
      startFrame: startFrame + i * pace,
      endFrame: startFrame + (i + 1) * pace,
    }));
}

/**
 * Fills in missing endFrames: a word ends when the next one starts, and the
 * last word holds for `fallbackFrames`. Every word lasts at least 1 frame.
 */
export function resolveWordTimings(
  words: CaptionWord[],
  fallbackFrames: number,
): TimedWord[] {
  return words.map((word, i) => {
    const next = words[i + 1];
    const endFrame =
      word.endFrame ??
      (next ? next.startFrame : word.startFrame + Math.max(1, fallbackFrames));
    return {
      text: word.text,
      startFrame: word.startFrame,
      endFrame: Math.max(endFrame, word.startFrame + 1),
    };
  });
}

/** Chunks timed words into caption beats of `groupSize` tokens. */
export function groupWords(
  words: TimedWord[],
  groupSize: number,
): CaptionGroup[] {
  const size = clampGroupSize(groupSize);
  const groups: CaptionGroup[] = [];
  for (let i = 0; i < words.length; i += size) {
    const chunk = words.slice(i, i + size);
    groups.push({
      words: chunk,
      startFrame: chunk[0].startFrame,
      endFrame: chunk[chunk.length - 1].endFrame,
    });
  }
  return groups;
}

/** Index of the group on screen at `frame`, or -1 when no caption shows. */
export function activeGroupIndex(
  groups: CaptionGroup[],
  frame: number,
): number {
  for (let i = groups.length - 1; i >= 0; i--) {
    if (frame >= groups[i].startFrame && frame < groups[i].endFrame) return i;
  }
  return -1;
}

export interface CaptionLook {
  weight: number;
  uppercase: boolean;
  /** Words per page, and the character budget that keeps a page on 1–2 lines. */
  maxWords: number;
  maxChars: number;
  /** Font size as a fraction of the composition's SHORT side, so it reads the
   *  same on 9:16 and 16:9 instead of shrinking to nothing on one of them. */
  sizeRatio: number;
  strokeRatio: number;
  tracking: string;
  /** Scale the spoken word springs to. */
  pop: number;
  /** Does the spoken word sit inside a filled block? */
  block: boolean;
  pill: boolean;
  shadow: boolean;
  /** Per-line solid box behind the whole line (YouTube auto-caption look). */
  box?: boolean;
}

/**
 * Sizes are a fraction of the frame's SHORT side. The old default was 54px on a
 * 1920-tall frame — 2.8% of its height — which is a subtitle, not a caption. These
 * run 11–13% of the short side, which is where burned-in captions actually live.
 */
export const CAPTION_LOOKS: Record<CaptionPreset, CaptionLook> = {
  /**
   * The default: the YouTube / TikTok auto-caption look — white text on a solid
   * black box that wraps each line tight (`box-decoration-break: clone`). No
   * outline, no pop; the box carries the contrast. Clean and unmistakable.
   */
  boxed: {
    weight: 700,
    uppercase: false,
    maxWords: 7,
    maxChars: 28,
    sizeRatio: 0.062,
    strokeRatio: 0,
    tracking: "-0.005em",
    pop: 1,
    block: false,
    pill: false,
    shadow: false,
    box: true,
  },
  /**
   * The default, and the one you actually see under a talking head: a phrase per
   * page, big enough to read on a phone but small enough to stay on 1–2 lines, with
   * the spoken word lit up inside it. This is what Submagic / Opus / CapCut put out
   * and what most channels burn in.
   */
  youtube: {
    weight: 800,
    uppercase: false,
    maxWords: 6,
    maxChars: 26,
    sizeRatio: 0.075,
    strokeRatio: 0.075,
    tracking: "-0.015em",
    pop: 1.07,
    block: false,
    pill: false,
    shadow: true,
  },
  beast: {
    weight: 900,
    uppercase: true,
    maxWords: 3,
    maxChars: 16,
    sizeRatio: 0.125,
    strokeRatio: 0.1,
    tracking: "-0.005em",
    pop: 1.14,
    block: false,
    pill: false,
    shadow: true,
  },
  hormozi: {
    weight: 800,
    uppercase: true,
    maxWords: 3,
    maxChars: 14,
    sizeRatio: 0.115,
    strokeRatio: 0.085,
    tracking: "-0.005em",
    pop: 1.06,
    block: true,
    pill: false,
    shadow: true,
  },
  pop: {
    weight: 800,
    uppercase: false,
    maxWords: 4,
    maxChars: 22,
    sizeRatio: 0.11,
    strokeRatio: 0.07,
    tracking: "-0.015em",
    pop: 1.12,
    block: false,
    pill: false,
    shadow: true,
  },
  clean: {
    weight: 700,
    uppercase: false,
    maxWords: 8,
    maxChars: 42,
    sizeRatio: 0.06,
    strokeRatio: 0,
    tracking: "-0.01em",
    pop: 1.06,
    block: false,
    pill: true,
    shadow: false,
  },
};

/** The accent set the `hormozi` block cycles through, one colour per beat. */
export const DEFAULT_ACCENT_CYCLE = [
  "#27E36B",
  "#FFE81F",
  "#FF4D4D",
  "#3EA8FF",
];

/**
 * The spoken word's scale. A spring with a little overshoot — a caption that eases
 * politely into place does not read as a caption, it reads as a lower third.
 */
export function popScale(
  frame: number,
  startFrame: number,
  fps: number,
  peak: number,
): number {
  const s = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 11, stiffness: 190, mass: 0.7 },
    durationInFrames: 14,
  });
  return 1 + (peak - 1) * s;
}

/* ---------------------------------------------------------------------------
 * Real transcripts. This is the part that makes the component usable.
 *
 * Nobody has frame numbers. A caption comes out of Whisper, whisper.cpp, CapCut,
 * Submagic, Opus Clip or Descript, and it comes out in MILLISECONDS — or as an
 * .srt file. Remotion's own `@remotion/captions` type is `{ text, startMs, endMs }`,
 * and that is the shape the whole ecosystem speaks.
 *
 * So that is the shape this takes. Paste a Whisper JSON, or paste an .srt straight
 * in. The frame maths is ours, not yours.
 * ------------------------------------------------------------------------- */

/** The standard caption token. Structurally identical to `@remotion/captions`. */
export interface Caption {
  text: string;
  startMs: number;
  endMs: number;
}

/** ms → frame, at the composition's own rate. */
export function msToFrame(ms: number, fps: number): number {
  return (ms / 1000) * fps;
}

/**
 * Word-level captions from an SRT. Handles both `,` and `.` as the millisecond
 * separator (Whisper writes commas; some tools write dots), and multi-line cues.
 */
export function parseSrt(srt: string): Caption[] {
  const out: Caption[] = [];
  const blocks = srt
    .replace(/\r/g, "")
    .trim()
    .split(/\n\s*\n/);
  for (const raw of blocks) {
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0) continue;
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
    if (text.length > 0) out.push({ text, startMs, endMs });
  }
  return out;
}

/** `00:00:01,234` (or `.234`, or `00:01,234`) → 1234. Null when it isn't a timestamp. */
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

/**
 * An SRT cue is usually a whole phrase, not a word. Split it into words and spread
 * them across the cue so the active-word highlight still has something to track.
 * (Word-level Whisper output needs none of this — it already IS one word per cue.)
 */
export function explodeCue(caption: Caption): Caption[] {
  const words = caption.text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [caption];
  const span = Math.max(1, caption.endMs - caption.startMs);
  const per = span / words.length;
  return words.map((text, i) => ({
    text,
    startMs: caption.startMs + i * per,
    endMs: caption.startMs + (i + 1) * per,
  }));
}

/** Captions (ms) → the internal frame-timed model. */
export function captionsToWords(
  captions: Caption[],
  fps: number,
  explode = true,
): TimedWord[] {
  const tokens = explode ? captions.flatMap(explodeCue) : captions;
  return tokens.map((c) => ({
    text: c.text,
    startFrame: msToFrame(c.startMs, fps),
    endFrame: Math.max(msToFrame(c.endMs, fps), msToFrame(c.startMs, fps) + 1),
  }));
}

export interface PageOptions {
  /** Hard cap on words per page. */
  maxWords: number;
  /** Character budget, so a page actually FITS the frame instead of wrapping to a tower. */
  maxChars: number;
  /** A pause longer than this starts a new page — that is where a sentence breaks. */
  maxGapFrames: number;
}

/**
 * Group words into PAGES the way real caption tools do — by the shape of the speech,
 * not by a fixed count.
 *
 * A page ends when it runs out of words, runs out of characters, or the speaker
 * pauses. The old `groupWords` chopped every 3 words regardless, which is how you
 * end up with "STOP / LOSING / HOURS" stacked in a tower: three words that never
 * belonged on their own page.
 */
export function buildPages(
  words: TimedWord[],
  opts: PageOptions,
): CaptionGroup[] {
  const pages: CaptionGroup[] = [];
  let current: TimedWord[] = [];
  let chars = 0;

  const flush = () => {
    if (current.length === 0) return;
    pages.push({
      words: current,
      startFrame: current[0].startFrame,
      endFrame: current[current.length - 1].endFrame,
    });
    current = [];
    chars = 0;
  };

  for (const word of words) {
    const prev = current[current.length - 1];
    const gap = prev ? word.startFrame - prev.endFrame : 0;
    const wouldOverflow =
      current.length >= Math.max(1, opts.maxWords) ||
      chars + word.text.length + 1 > Math.max(1, opts.maxChars);

    if (prev && (wouldOverflow || gap > opts.maxGapFrames)) flush();

    current.push(word);
    chars += word.text.length + 1;
  }
  flush();
  return pages;
}

/**
 * Burned-in captions, in the styles big channels actually use.
 *
 * Three things separate a premium caption from a subtitle, and all three are here:
 *
 * 1. **The outline.** A caption has to be legible over footage it has never seen —
 *    a face, a sky, a white desk. A heavy black outline does that, and nothing else
 *    does. It has to be an OUTSIDE outline: `-webkit-text-stroke` centres the stroke
 *    on the glyph, so half of it eats inwards and the letterform goes thin and
 *    mushy (measured: a 14px stroke takes a 38px stem down to 22px). `paint-order:
 *    stroke fill` draws the stroke first and the fill over it, and the stem comes
 *    back to 38px. That one line is most of the look.
 * 2. **The weight and the size.** Montserrat 800–900, at 11–13% of the frame's
 *    short side. The old default was 2.8%.
 * 3. **The spoken word pops.** A spring with overshoot, not an ease.
 *
 * That pop is a scale on text, which is where captions usually fall apart: a browser
 * gives glyph origins no vertical sub-pixel precision, so a scale that moves the
 * baseline makes the word climb the pixel grid in whole-pixel jumps. The scale
 * pivots on the **measured baseline**, so the baseline's device Y never changes.
 */
export function WordCaptions({
  captions,
  srt,
  words = "Stop losing hours to manual invoices",
  preset = "boxed",
  maxWords,
  maxChars,
  pageBreakMs = 420,
  groupSize,
  activeStyle = "pop",
  aspect = "16:9",
  maxWidth,
  fontSize,
  textColor,
  pillColor,
  theme,
  mode,
  fontFamily,
  accentColor = "#FFE81F",
  accentCycle = DEFAULT_ACCENT_CYCLE,
  strokeColor = "#000000",
  strokeRatio,
  uppercase,
  framesPerWord = 14,
  fontWeight,
  speed = 1,
  className,
}: WordCaptionsProps) {
  const frame = useCurrentFrame() * speed;
  const { fps, width, height } = useVideoConfig();
  // A caption pill is a legibility scrim over footage, so its neutrals come
  // from the dark end of the system by default. The accent, the outline and
  // the cycle are the caption's look and stay props (design-system Rule 3c).
  const t = useSnapCnTheme(theme, mode ?? "dark");
  const face = resolveFont(fontFamily ?? t.fontFamily) ?? MONTSERRAT;
  const ink = textColor ?? t.foreground;
  const scrim = pillColor ?? withAlpha(t.background, 0.55);

  const look = CAPTION_LOOKS[preset] ?? CAPTION_LOOKS.beast;
  const shortSide = Math.min(width, height);
  // 0 (or omitted) means "the preset decides" — the preset IS the design, so a
  // customizer knob that silently overrode it would make every preset identical.
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
  const block = maxWidth && maxWidth > 0 ? maxWidth : Math.round(width * 0.86);

  // Real captions first, the toy string last. `captions` (ms) and `srt` are what a
  // user actually has; `words` (frames) is the legacy path; a bare string is a demo.
  const timed: TimedWord[] = captions?.length
    ? captionsToWords(captions, fps)
    : srt && srt.trim().length > 0
      ? captionsToWords(parseSrt(srt), fps)
      : resolveWordTimings(
          typeof words === "string"
            ? scheduleWords(words, framesPerWord)
            : words,
          framesPerWord,
        );

  // Pages, not fixed-size chunks. `groupSize` still forces a hard count if you pass
  // it, so nothing that relied on it breaks.
  const groups = groupSize
    ? groupWords(timed, groupSize)
    : buildPages(timed, {
        maxWords: maxWords ?? look.maxWords,
        maxChars: maxChars ?? look.maxChars,
        maxGapFrames: (pageBreakMs / 1000) * fps,
      });
  const groupIdx = activeGroupIndex(groups, frame);
  const group = groupIdx === -1 ? null : groups[groupIdx];

  // The baseline inside a word span, measured once. Guessing it from a line-height
  // ratio is what makes a popping word judder: the pivot has to be exact.
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
      ? delayRender("word-captions: measuring the baseline for the pop pivot")
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

  const accent =
    look.block && accentCycle.length > 0
      ? accentCycle[Math.max(0, groupIdx) % accentCycle.length]
      : accentColor;

  const lineHeight = Math.round(size * 1.14);
  const willChange = getRemotionEnvironment().isRendering
    ? undefined
    : ("transform" as const);

  const typeStyle = {
    fontFamily: face,
    fontWeight: weight,
    fontSize: size,
    lineHeight: `${lineHeight}px`,
    letterSpacing: look.tracking,
    // Hinting re-snaps every stem to the pixel grid as a word scales, and the
    // letterforms visibly boil. This turns it off.
    textRendering: "geometricPrecision" as const,
    fontVariantLigatures: "none" as const,
  };

  const outline =
    stroke > 0
      ? {
          WebkitTextStrokeWidth: `${stroke}px`,
          WebkitTextStrokeColor: strokeColor,
          // Draw the stroke, THEN the fill on top of it. Without this the stroke is
          // centred on the outline and eats the letterform from the inside.
          paintOrder: "stroke fill" as const,
        }
      : {};

  const shadow = look.shadow
    ? {
        textShadow: `0 ${size * 0.055}px ${size * 0.05}px ${withAlpha(
          t.background,
          0.42,
        )}`,
      }
    : {};

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: `${SAFE_AREA_BOTTOM_PCT[aspect] ?? SAFE_AREA_BOTTOM_PCT["9:16"]}%`,
        paddingLeft: "5%",
        paddingRight: "5%",
        pointerEvents: "none",
      }}
    >
      {/* Off-screen probe: one word, same type, with a zero-sized inline-block
          sitting on its baseline. Read once, used as the pivot for every pop. */}
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

      {/* Boxed look: white text on a solid black box that clones per line. The
          words stay inline (no flex, no per-word transform), so the background
          wraps each line tight — the YouTube auto-caption look. */}
      {group && look.box && (
        <div
          style={{
            maxWidth: block,
            textAlign: "center",
            opacity: interpolate(frame - group.startFrame, [0, 3], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <span
            style={{
              ...typeStyle,
              fontFamily: ROBOTO,
              display: "inline",
              color: ink,
              backgroundColor: withAlpha(t.background, 0.9),
              padding: `${size * 0.06}px ${size * 0.32}px`,
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
              lineHeight: `${Math.round(size * 1.46)}px`,
              borderRadius: 2,
            }}
          >
            {group.words
              .map((w) => (caps ? w.text.toUpperCase() : w.text))
              .join(" ")}
          </span>
        </div>
      )}

      {group && !look.box && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-end",
            justifyContent: "center",
            // px, not em: `em` here would resolve against the CONTAINER's font size,
            // which is the inherited 16px — not the caption's. That is how the words
            // ended up welded together as "STOPLOSING".
            columnGap: size * 0.26,
            rowGap: size * 0.04,
            maxWidth: block,
            textAlign: "center",
            ...(look.pill
              ? {
                  padding: `${size * 0.3}px ${size * 0.5}px`,
                  borderRadius: size * 0.22,
                  backgroundColor: pillColor === "" ? "transparent" : scrim,
                }
              : {}),
            opacity: interpolate(frame - group.startFrame, [0, 3], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {group.words.map((word, i) => {
            const spoken =
              frame >= word.startFrame &&
              (frame < word.endFrame || i === group.words.length - 1);
            const isActive =
              spoken && frame >= word.startFrame && frame < word.endFrame;

            const scale =
              isActive && activeStyle === "pop"
                ? popScale(frame, word.startFrame, fps, look.pop)
                : 1;

            // Not yet spoken words in a beat stay white; the spoken one takes the
            // accent (or the block). That is what makes the beat readable AHEAD of
            // the voice instead of only with it.
            const useAccent = isActive && activeStyle !== "pop";
            const fill = look.block ? ink : isActive ? accent : ink;

            return (
              <span
                key={`${word.text}-${word.startFrame}`}
                style={{
                  ...typeStyle,
                  ...outline,
                  ...shadow,
                  display: "inline-block",
                  color: useAccent ? accent : fill,
                  transform: `scale(${scale})`,
                  // The pivot is the BASELINE, not the middle of the box. 50% 100%
                  // is the bottom of the box, which sits a descent BELOW the
                  // baseline — it drags the word down the pixel grid as it scales.
                  transformOrigin:
                    baselineY === null ? "50% 85%" : `50% ${baselineY}px`,
                  willChange,
                  ...(look.block && isActive
                    ? {
                        backgroundColor: accent,
                        borderRadius: size * 0.12,
                        padding: `0 ${size * 0.1}px`,
                        // The block wants the fill on top of the stroke too, or the
                        // stroke shows as a dark halo inside the block.
                        WebkitTextStrokeWidth: `${stroke * 0.6}px`,
                      }
                    : {}),
                }}
              >
                {caps ? word.text.toUpperCase() : word.text}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
