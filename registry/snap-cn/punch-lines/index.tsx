"use client";

import { loadFont as loadSans } from "@remotion/google-fonts/Inter";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";

/**
 * A run of full-frame title cards that cut hard between beats.
 *
 * Two looks, and the sequence alternates them:
 *
 * - **slide** — the statement card. Its lines are already at full size when the
 *   card opens, sitting left of centre; each one is flicked right and settles
 *   home on a critically damped curve, one line behind the last. It leaves by
 *   rushing past the camera.
 * - **punch** — the hero line. Every word starts a third of its size and swells
 *   into place in a wave, while the whole line pushes slowly forward for as long
 *   as it is on screen. It leaves on a cut.
 *
 * It paints a whole page rather than a control, so it takes the design system's
 * two page colours — `background` and `foreground` — and inverts with `mode`.
 * Only the accent is a bare prop, because an accent that is supposed to shout is
 * the design and not a token.
 *
 * ## Where the numbers come from
 *
 * Every curve here was fitted to a reference recording, frame by frame, not
 * eyeballed. The recording is 24fps variable-rate, so each fit is against the
 * frames' real timestamps and the results are stored in **seconds** — a frame
 * index is not a clock.
 *
 * | beat | signal | fit |
 * | --- | --- | --- |
 * | slide | each line's ink centroid, 37 frames, both lines at once | `(A + Bt)·e^(-λt)`, **rms 0.42px** |
 * | punch | per-word ink width, 27 frames | scale `0.32 → 1` on an in-out cubic |
 * | push | per-word ink width once the wave has landed | linear, `+20.5%/s` |
 * | rush | ink second moment (`rmsX`/`rmsY` agreed to 0.02%, so it is a pure scale) | `1/(1 − travel)`, travel on a hard ease-in |
 *
 * Two of those are worth keeping because they are the sort of thing you cannot
 * see and would never guess:
 *
 * - **The slide is not a spring.** A damped sinusoid fits the overshoot and then
 *   demands an undershoot that is not there; a spring released from rest cannot
 *   overshoot 36px without starting 2,000px out. What actually fits, to under
 *   half a pixel over 37 frames, is a **critically damped** system given an
 *   initial kick: `(A + Bt)·e^(-λt)`. It starts 0.74em left of centre, sails
 *   0.71em past it, and comes home without ever crossing back.
 * - **The rush is a scale about the frame centre, not the type's own centre.**
 *   Solving the ink centroid for the pivot lands on the middle of the frame in
 *   both axes, which is why the lower line dives *down* out of shot while the
 *   upper one climbs out of the top.
 *
 * ## The cadence, and why a card is already moving when you first see it
 *
 * `holds` is time **on screen**, one entry per card, so the rhythm is exactly
 * what you wrote and no card can ever bleed over the one in front of it. The
 * cards are a straight run of hard cuts.
 *
 * The one thing that happens off screen is `lead`: a card's clock starts a few
 * frames before its cut, so it is caught mid-entrance rather than starting from
 * nothing. That is the reference's own trick — its third card is at 87% of its
 * size on the first frame you can see it, with not one coloured pixel on the
 * frame before — and it is most of what makes a cut read as expensive rather
 * than abrupt. `lead: 0` plays every entrance in full.
 */
const { fontFamily: SANS } = loadSans("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

/** How a card arrives, and how it leaves. */
export type PunchLineStyle = "slide" | "punch";

export interface PunchLinesProps {
  /**
   * The whole script in one string. `|` starts a new card, `/` starts a new
   * line inside a card:
   *
   * ```
   * "Ready-made scenes / for Remotion. | One command. Own it. | snapcn."
   * ```
   */
  script?: string;
  /**
   * Per-card look — `slide` or `punch` — comma separated. The last value repeats,
   * so `"slide,punch"` gives the first card the statement look and every card
   * after it the hero look.
   */
  styles?: string;
  /**
   * Per-card type size, as a multiple of `fontSize`, comma separated; the last
   * value repeats. A one-word payoff wants to be much bigger than the sentence
   * that set it up — that is the whole point of the beat.
   */
  sizes?: string;
  /**
   * Per-card length in frames, comma separated; the last value repeats. Measured
   * from the frame the card's own clock starts, so it includes the entrance and
   * the exit.
   */
  holds?: string;
  /** Which card is painted in `accentColor`, counting from 1. `0` = none. */
  accentBeat?: number;

  /**
   * Frames of a card's entrance that run before it is cut to — it arrives
   * already moving instead of from nothing. `0` plays every entrance in full.
   */
  lead?: number;

  /** Type size of a `size = 1` card, in px. */
  fontSize?: number;
  fontWeight?: number | string;
  /**
   * Baseline-to-baseline distance inside a card, in em. Tight on purpose — a
   * statement card is a lockup, not a paragraph — but a face's descender depth
   * and ascender height both eat into the gap, so a number carried over from
   * another face will collide rather than kiss.
   */
  lineHeight?: number;
  /** Resting letter-spacing. */
  letterSpacing?: string;
  /**
   * Resting word-spacing. The reference crushes it almost to nothing — measured,
   * its word gaps are 0.17em where the face's own space is 0.26em — which is what
   * makes a line read as one block of type rather than four words.
   */
  wordSpacing?: string;

  /** The ground the cards are cut on. Defaults to the design system's page. */
  ground?: string;
  /** The type. Defaults to the design system's foreground. */
  ink?: string;
  /**
   * The one card that is not the type colour.
   *
   * A prop and not `theme.primary` on purpose: an accent that is *supposed* to
   * shout is the design, not a token — see the design system's note on burned-in
   * video type. Swap it for your brand's and the rest of the card still follows
   * whatever palette it was dropped into.
   */
  accentColor?: string;

  /** Design-system token overrides. */
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
  /**
   * The face the cards are set in — a label from `fonts.ts` ("Geist", "Outfit",
   * "Montserrat") or a CSS family you have loaded yourself. Unset, the cards are
   * set in Inter, the same face the rest of the text tier uses.
   */
  fontFamily?: string;

  /** How far left of centre a slide card's line starts, in em. */
  slideFrom?: number;
  /** The kick that throws it right, in em per second. */
  slideKick?: number;
  /** How fast the slide settles. Higher is tighter. */
  slideSettle?: number;
  /** Frames between one line of a slide card leaving and the next. */
  lineStagger?: number;
  /**
   * How far below the optical centre a slide card hangs, in em. The reference's
   * two-line statement sits low so the eye lands on the first line rather than
   * in the gap between them.
   */
  slideDrop?: number;
  /**
   * Shutter angle for the slide's motion blur, as a fraction of the frame — `1`
   * is a fully open shutter, `0` turns it off.
   *
   * A browser animating `translate` draws every frame perfectly sharp. Film, and
   * anything rendered with a shutter, does not: a line travelling 30px in a
   * frame is smeared across those 30px, and its absence is most of what makes a
   * fast move read as "computer graphics". The reference has it — measured, its
   * first frame's ink is spread by exactly the frame's own travel — so this
   * smears the line horizontally by the distance it covered, and by nothing at
   * all once it has stopped.
   */
  motionBlur?: number;

  /** The size a punch card's word starts at, relative to its final size. */
  punchFrom?: number;
  /** Frames a word takes to swell into place. */
  punchFrames?: number;
  /** Frames between one word starting to swell and the next. */
  wordStagger?: number;
  /** The size a punch card's line opens at, relative to its final size. */
  pushFrom?: number;
  /** How fast the line keeps growing while it holds, per second. */
  pushRate?: number;

  /** Frames before a rushing card ends that it starts to rush. */
  rushLead?: number;
  /** Frames the rush would take to run its whole travel. */
  rushFrames?: number;
  /**
   * How far the card travels toward the camera, as a fraction of its distance.
   * `0.85` ends at 6.7× — long gone off every edge.
   */
  rushTravel?: number;

  /** Fraction of the frame width a line may occupy before it is scaled down. */
  fit?: number;
  speed?: number;
  className?: string;
}

/**
 * A word swelling into place. Symmetric in-out cubic: it leaves and arrives at a
 * standstill, and spends its frames in the middle where you can see them.
 *
 * Fitted twice — on the last word of the second beat and on the single word of
 * the third — and both landed on 11 frames at 30fps, which is the check that it
 * is the real curve and not one that happened to fit one sample.
 */
const PUNCH_EASE = Easing.bezier(0.65, 0, 0.35, 1);

/**
 * The card's travel toward the camera on the way out.
 *
 * Brutally eased in: 28% of the travel in the first 60% of the time, and the
 * rest in the last 40%. That is what makes the exit read as a *rush* rather than
 * a zoom — nothing appears to happen, and then the type is past you.
 */
const RUSH_EASE = Easing.bezier(1, 0, 0.48, 1);

/**
 * The furthest a slide card's line ever gets from centre, in em — its start, or
 * the far side of its overshoot, whichever is bigger. Needed to fit a card: the
 * line has to be inside the frame at both ends of the swing, not just at rest.
 */
export function slideSwing(from: number, kick: number, settle: number): number {
  // (A + Bt)·e^(-λt) turns over where B = λ(A + Bt). No kick, no turn — and the
  // division would be an infinity that comes back as NaN and quietly disables
  // the fit for the one card that most needs it.
  const peakAt = kick > 0 ? Math.max(0, 1 / settle - from / kick) : 0;
  const peak = (from + kick * peakAt) * Math.exp(-settle * peakAt);
  return Math.max(Math.abs(from), Math.abs(peak));
}

/** Split a comma list, trimmed, empties dropped. */
const list = (s: string | undefined): string[] =>
  (s ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

/** Read index `i` out of a list, repeating the last value forever. */
const at = <T,>(values: T[], i: number, fallback: T): T =>
  values.length === 0
    ? fallback
    : (values[Math.min(i, values.length - 1)] as T);

export interface PunchBeat {
  lines: string[][];
  style: PunchLineStyle;
  size: number;
  accent: boolean;
  /** Frame the card's own clock starts — `lead` frames before it is revealed. */
  start: number;
  /** Frame the card leaves the screen. */
  end: number;
  /** Frame the card is cut to, which is the frame the card in front of it ends. */
  revealAt: number;
}

/**
 * Parse the script and lay the cards out on the timeline.
 *
 * `holds[i]` is time **on screen**, so the cards are a straight run of hard cuts
 * and the cadence is exactly what you wrote — no card can bleed over the one in
 * front of it, whichever way that one leaves.
 *
 * `lead` is the only thing that happens off screen: a card's clock starts that
 * many frames before its cut, so it arrives already moving rather than from
 * nothing. Raise it and the cut lands harder; set it to 0 and every card plays
 * its entrance in full.
 */
export function planPunchLines(
  script: string,
  styles: string,
  sizes: string,
  holds: string,
  accentBeat: number,
  lead: number,
): PunchBeat[] {
  const texts = script
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const styleList = list(styles) as PunchLineStyle[];
  const sizeList = list(sizes).map(Number).filter(Number.isFinite);
  const holdList = list(holds).map(Number).filter(Number.isFinite);

  const beats: PunchBeat[] = [];
  let revealAt = 0;
  for (let i = 0; i < texts.length; i++) {
    const style = at(styleList, i, "punch");
    const hold = Math.max(1, at(holdList, i, 48));
    beats.push({
      lines: (texts[i] as string)
        .split("/")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.split(/\s+/)),
      style: style === "slide" ? "slide" : "punch",
      size: at(sizeList, i, 1),
      accent: i + 1 === accentBeat,
      // Nothing is behind the first card, so there is nothing for it to arrive
      // out of — it starts where it is revealed.
      start: i === 0 ? 0 : revealAt - lead,
      revealAt,
      end: revealAt + hold,
    });
    revealAt += hold;
  }
  return beats;
}

/** Total frames a script needs, so the config and the component cannot drift. */
export function punchLinesDuration(script: string, holds: string): number {
  const n = script
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean).length;
  const holdList = list(holds).map(Number).filter(Number.isFinite);
  let total = 0;
  for (let i = 0; i < n; i++) total += Math.max(1, at(holdList, i, 48));
  return total;
}

interface FaceMetrics {
  /** Top of the line box down to the baseline, at `fontSize` 100. */
  baseline: number;
  /**
   * Per card, at `fontSize` 100: how far its first line's *ink* rises above the
   * baseline, and how far its last line's ink falls below one.
   *
   * Both measured from the copy actually passed, because a card is centred on
   * the ink you can see and nothing else knows where that is. A face's cap
   * height is the wrong number twice over: some faces draw their ascenders
   * taller than their caps, so a line with an ascender sits high; and a word
   * with no ascender at all but a descender in it — a lowercase wordmark, say —
   * is not a cap band, and centring it as one drops it half a descender low.
   */
  inkAscent: number[];
  inkDescent: number[];
}

export function PunchLines({
  script = "Ready-made scenes / for Remotion. | One command. Own it. | snapcn.",
  styles = "slide,punch",
  sizes = "1,0.945,2.7",
  holds = "48",
  accentBeat = 3,
  lead = 4,

  fontSize = 93,
  fontWeight = 600,
  lineHeight = 0.89,
  letterSpacing = "-0.022em",
  wordSpacing = "-0.02em",

  ground,
  ink,
  accentColor = "#ff1c8e",

  theme,
  mode,
  fontFamily,

  slideFrom = -0.737,
  slideKick = 7.34,
  slideSettle = 2.846,
  lineStagger = 3.5,
  slideDrop = 0.313,
  motionBlur = 1,

  punchFrom = 0.32,
  punchFrames = 15,
  wordStagger = 2.8,
  pushFrom = 0.778,
  pushRate = 0.205,

  rushLead = 12.2,
  rushFrames = 18,
  rushTravel = 0.85,

  fit = 0.92,
  speed = 1,
  className,
}: PunchLinesProps) {
  const frame = useCurrentFrame() * speed;
  const { width, fps } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily ?? t.fontFamily) ?? SANS;
  // A card is a full-bleed page, so it takes the page's own two colours rather
  // than inventing a pair. Pass `mode="dark"` and the whole run inverts.
  const paper = ground ?? t.background;
  const type = ink ?? t.foreground;

  const beats = useMemo(
    () => planPunchLines(script, styles, sizes, holds, accentBeat, lead),
    [script, styles, sizes, holds, accentBeat, lead],
  );

  // Two things have to be measured rather than assumed, both constant across
  // every frame: where the baseline sits inside a line box, and how far each
  // card's own first line rises above it. Together they place the block — a card
  // is centred on its *ink*, not on its line boxes, which is what keeps a
  // one-line hero optically centred while a two-line statement hangs from the
  // same rule.
  const probeRef = useRef<HTMLSpanElement>(null);
  const baselineRef = useRef<HTMLSpanElement>(null);
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [handle] = useState(() => delayRender("punch-lines: measure the face"));
  const [metrics, setMetrics] = useState<FaceMetrics | null>(null);
  const [lineWidths, setLineWidths] = useState<number[] | null>(null);

  useEffect(() => {
    const probe = probeRef.current;
    if (!probe) {
      continueRender(handle);
      return;
    }
    // An empty, zero-sized inline-block sits with its bottom edge on the text
    // baseline, so its offsetTop *is* the baseline — read off the real font
    // metrics instead of guessed from a line-height ratio.
    const baseline = baselineRef.current?.offsetTop ?? 88;
    const firstLines = beats.map((b) => (b.lines[0] ?? []).join(" "));
    const lastLines = beats.map((b) =>
      (b.lines[b.lines.length - 1] ?? []).join(" "),
    );
    let inkAscent = firstLines.map(() => 70);
    let inkDescent = lastLines.map(() => 0);
    try {
      const ctx = document.createElement("canvas").getContext("2d");
      if (ctx) {
        ctx.font = `${fontWeight} 100px ${face}`;
        inkAscent = firstLines.map((text) => {
          const a = ctx.measureText(text).actualBoundingBoxAscent;
          return a > 0 ? a : 70;
        });
        inkDescent = lastLines.map((text) =>
          Math.max(0, ctx.measureText(text).actualBoundingBoxDescent),
        );
      }
    } catch {
      // A context can be refused (a headless tab with no GPU, a hardened
      // browser). 0.70em is a sane cap height for any grotesque.
    }
    const lineCount = beats.reduce((n, b) => n + b.lines.length, 0);
    setLineWidths(
      lineRefs.current
        .slice(0, lineCount)
        .map((el) => (el ? el.offsetWidth : 0)),
    );
    setMetrics({ baseline, inkAscent, inkDescent });
  }, [handle, face, fontWeight, beats]);

  // Release the render only once the measurement has re-rendered, so the very
  // first captured frame already carries the correct geometry.
  useEffect(() => {
    if (metrics) continueRender(handle);
  }, [metrics, handle]);

  const M: FaceMetrics = metrics ?? {
    baseline: 88,
    inkAscent: beats.map(() => 70),
    inkDescent: beats.map(() => 0),
  };

  // Index every line of every card into one flat list, so one hidden probe row
  // measures them all and each card can look its own lines up by offset.
  const lineIndex: number[] = [];
  {
    let n = 0;
    for (const beat of beats) {
      lineIndex.push(n);
      n += beat.lines.length;
    }
  }
  const allLines = beats.flatMap((beat) =>
    beat.lines.map((words) => ({ words, size: beat.size })),
  );

  return (
    <AbsoluteFill
      className={className}
      style={{
        backgroundColor: paper,
        fontFamily: face,
        fontWeight,
        // Hinting re-snaps every stem as a size slides, and the letterforms
        // literally change shape frame to frame. This turns it off and renders
        // the outline as it is — 15× steadier under a scale, measured. The
        // slight softness is the absence of a lie, not blur.
        textRendering: "geometricPrecision",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/*
        Two measuring rows, laid out and never painted, and separate on purpose:
        the baseline probe reads a line box, and a line box grows to fit the
        tallest thing on it. Share a row with a 250px card title and the baseline
        it reports is that title's, not the type's.
      */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          visibility: "hidden",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        <span
          ref={probeRef}
          style={{ fontSize: 100, lineHeight: `${lineHeight * 100}px` }}
        >
          Hxg
          <span
            ref={baselineRef}
            style={{ display: "inline-block", width: 0, height: 0 }}
          />
        </span>
      </div>
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          visibility: "hidden",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        {allLines.map((line, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: the probe row is positional
            key={i}
            ref={(el) => {
              lineRefs.current[i] = el;
            }}
            style={{
              // inline-block, NOT block. A block-level child of a shrink-to-fit
              // absolutely positioned box fills that box, so every probe reported
              // the *widest line in the whole script* as its own width — and one
              // long card quietly took a size off every other card.
              display: "inline-block",
              fontSize: fontSize * line.size,
              lineHeight: `${lineHeight}em`,
              letterSpacing,
              wordSpacing,
            }}
          >
            {line.words.join(" ")}
          </span>
        ))}
      </div>

      {beats.map((beat, i) => (
        <Card
          // biome-ignore lint/suspicious/noArrayIndexKey: cards are positional
          key={i}
          beat={beat}
          frame={frame}
          fps={fps}
          width={width}
          fontSize={fontSize}
          lineHeight={lineHeight}
          letterSpacing={letterSpacing}
          wordSpacing={wordSpacing}
          metrics={M}
          beatIndex={i}
          widths={
            lineWidths
              ? lineWidths.slice(
                  lineIndex[i] as number,
                  (lineIndex[i] as number) + beat.lines.length,
                )
              : null
          }
          color={beat.accent ? accentColor : type}
          fit={fit}
          slideFrom={slideFrom}
          slideKick={slideKick}
          slideSettle={slideSettle}
          lineStagger={lineStagger}
          slideDrop={slideDrop}
          motionBlur={motionBlur}
          punchFrom={punchFrom}
          punchFrames={punchFrames}
          wordStagger={wordStagger}
          pushFrom={pushFrom}
          pushRate={pushRate}
          rushLead={rushLead}
          rushFrames={rushFrames}
          rushTravel={rushTravel}
        />
      ))}
    </AbsoluteFill>
  );
}

/**
 * One card.
 *
 * Nothing here reflows: the type is laid out once at its resting size and every
 * beat of the animation is a `scale` or a `translate` on top of it.
 */
function Card({
  beat,
  frame,
  fps,
  width,
  fontSize,
  lineHeight,
  letterSpacing,
  wordSpacing,
  metrics,
  beatIndex,
  widths,
  color,
  fit,
  slideFrom,
  slideKick,
  slideSettle,
  lineStagger,
  slideDrop,
  motionBlur,
  punchFrom,
  punchFrames,
  wordStagger,
  pushFrom,
  pushRate,
  rushLead,
  rushFrames,
  rushTravel,
}: {
  beat: PunchBeat;
  frame: number;
  fps: number;
  width: number;
  fontSize: number;
  lineHeight: number;
  letterSpacing: string;
  wordSpacing: string;
  metrics: FaceMetrics;
  beatIndex: number;
  widths: number[] | null;
  color: string;
  fit: number;
  slideFrom: number;
  slideKick: number;
  slideSettle: number;
  lineStagger: number;
  slideDrop: number;
  motionBlur: number;
  punchFrom: number;
  punchFrames: number;
  wordStagger: number;
  pushFrom: number;
  pushRate: number;
  rushLead: number;
  rushFrames: number;
  rushTravel: number;
}) {
  if (frame < beat.revealAt || frame >= beat.end) return null;

  // The card's own clock, in seconds. Everything below is fitted in seconds
  // because the reference is variable-rate and a frame index is not a clock.
  const t = (frame - beat.start) / fps;

  // Longest line decides whether the whole card has to come down a size, so the
  // block never changes shape when one line happens to be the long one — and it
  // is fitted against the widest the card will ever be, not the width it is laid
  // out at. A punch card keeps growing for its whole life and a slide card swings
  // most of an em either side of centre; a fit that ignores both passes at frame
  // one and runs off the stage later, which is the worst way to find out. The
  // rush is left out on purpose: leaving the frame is what it is for.
  const natural = widths?.length ? Math.max(...widths) : 0;
  const maxPush =
    beat.style === "punch"
      ? pushFrom + pushRate * ((beat.end - beat.start) / fps)
      : 1;
  const swing =
    beat.style === "slide"
      ? slideSwing(slideFrom, slideKick, slideSettle) * fontSize * beat.size
      : 0;
  const need = natural * maxPush + 2 * swing;
  const shrink = need > width * fit && need > 0 ? (width * fit) / need : 1;
  const em = fontSize * beat.size * shrink;
  const L = lineHeight * em;

  // A card is centred on its *ink*: the top of its first line's tallest letter
  // down to the bottom of its last line's lowest one. Flexbox centres the *line
  // boxes* instead, and `dy` is the difference — one number, the same for every
  // line of a card.
  const baseline = (metrics.baseline / 100) * em;
  const rise = ((metrics.inkAscent[beatIndex] ?? 70) / 100) * em;
  const fall = ((metrics.inkDescent[beatIndex] ?? 0) / 100) * em;
  const dy =
    L / 2 -
    baseline +
    (rise - fall) / 2 +
    (beat.style === "slide" ? slideDrop * em : 0);

  // The push, and the rush, are both scales about the middle of the frame. The
  // rush's pivot is not a guess: solving the ink centroid across the exit for
  // the fixed point of the scale puts it within a couple of pixels of the frame
  // centre in both axes.
  const push =
    beat.style === "punch" ? pushFrom + pushRate * Math.max(0, t) : 1;
  const rushT = (frame - (beat.end - rushLead)) / fps;
  const rush =
    beat.style === "slide" && rushT > 0
      ? 1 /
        (1 - rushTravel * RUSH_EASE(Math.min(1, rushT / (rushFrames / fps))))
      : 1;

  let wordIndex = 0;

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        color,
        transform: `scale(${push * rush})`,
        transformOrigin: "50% 50%",
        // The compositor resampling a bitmap is the right trade in a live
        // Player, where a line of type reshaped at a brand-new size every frame
        // will not fit an 8ms budget — and the wrong one in a render, where
        // parallel tabs inherit each other's stale rasters and a still frame
        // shimmers. So it is on in one and off in the other.
        ...(getRemotionEnvironment().isRendering
          ? null
          : { willChange: "transform" as const }),
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `translateY(${dy}px)`,
        }}
      >
        {beat.lines.map((words, li) => {
          // Each line of a slide card leaves after the one above it, and the
          // whole travel is one critically damped move: out at speed, past the
          // mark by 0.71em, home without ever crossing back.
          const lt = t - (li * lineStagger) / fps;
          const slide = (u: number) =>
            beat.style !== "slide"
              ? 0
              : u <= 0
                ? slideFrom * em
                : (slideFrom * em + slideKick * em * u) *
                  Math.exp(-slideSettle * u);
          const x = slide(lt);
          // The smear is the travel: a box blur one frame wide has a Gaussian
          // equivalent of width/√12, and the reference measures at exactly that.
          const sigma =
            (motionBlur * Math.abs(x - slide(lt - 1 / fps))) / Math.sqrt(12);
          const blurId = `punch-lines-${beatIndex}-${li}`;

          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional
              key={li}
              style={{
                whiteSpace: "nowrap",
                fontSize: em,
                lineHeight: `${L}px`,
                letterSpacing,
                wordSpacing,
                transform: `translateX(${x}px)`,
                // Under a fifth of a pixel there is nothing to smear, and a
                // filter that is on for a still frame only costs it sharpness.
                filter: sigma > 0.2 ? `url(#${blurId})` : undefined,
              }}
            >
              {sigma > 0.2 ? (
                <svg
                  aria-hidden
                  width={0}
                  height={0}
                  style={{ position: "absolute" }}
                >
                  <title>motion blur</title>
                  <filter
                    id={blurId}
                    x="-25%"
                    y="-25%"
                    width="150%"
                    height="150%"
                    colorInterpolationFilters="sRGB"
                  >
                    <feGaussianBlur stdDeviation={`${sigma} 0`} />
                  </filter>
                </svg>
              ) : null}
              {words.map((word, wi) => {
                const w = wordIndex++;
                const wt = t - (w * wordStagger) / fps;
                const p =
                  beat.style === "punch"
                    ? PUNCH_EASE(
                        Math.max(0, Math.min(1, wt / (punchFrames / fps))),
                      )
                    : 1;
                const s =
                  beat.style === "punch" ? punchFrom + (1 - punchFrom) * p : 1;
                return (
                  // A trailing space inside an inline-block is stripped — it
                  // sits at the end of that box's line and CSS removes it — so
                  // the separator goes *between* the spans, never inside one.
                  <Fragment key={w}>
                    {wi > 0 ? " " : null}
                    <span
                      style={{
                        display: "inline-block",
                        transform: `scale(${s})`,
                        // Not the baseline. The reference's words plainly grow
                        // about their own middles — at a third of their size
                        // they sit on a shared centre line, with their baselines
                        // nowhere near each other — and half the line box is
                        // that middle for a face whose ascent and descent
                        // straddle it evenly.
                        transformOrigin: `50% ${L / 2}px`,
                      }}
                    >
                      {word}
                    </span>
                  </Fragment>
                );
              })}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
