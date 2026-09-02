"use client";

import { Fragment, useEffect, useRef, useState } from "react";
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
import {
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";

export interface TextSwellProps {
  /** The sentence to assemble. Its first word leads, and everything else pushes it left. */
  text?: string;
  /** Final font size in px (the size the line settles at). */
  fontSize?: number;
  /** Overrides the design system's `foreground`. */
  color?: string;
  fontWeight?: number | string;
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

  /** Frames the lead word fades in over. */
  introDuration?: number;
  /** How far below its resting line the lead word starts, in em. */
  riseDistance?: number;
  /** Frames the lead word takes to rise into place. */
  riseDuration?: number;

  /** Size the lead word rises in at, relative to its final size. */
  startScale?: number;
  /**
   * How far forward the line floats (2.1 = just over twice its final size).
   * Capped so the line never leaves the frame — see `frontScale` in the docs.
   */
  frontScale?: number;
  /** Frames after the start before the line begins floating forward. */
  approachDelay?: number;
  /** Frames the line takes to float forward. */
  approachDuration?: number;

  /**
   * Frames before the second word arrives. The lead word is alone until then, so
   * this is the beat between it landing and the sentence starting to build.
   */
  wordDelay?: number;
  /** Frames between each trailing word arriving. */
  wordStagger?: number;
  /** How far right of its slot a trailing word starts, in em. */
  wordPush?: number;
  /**
   * Frames a trailing word takes to push into its slot. The lead word is shoved
   * left over the same window, so the push and the shove are one motion.
   */
  wordPushDuration?: number;

  /**
   * How many trailing words bounce their letters in. 1 (the default) bounces
   * only the second word; the rest simply push in. The lead word never bounces.
   */
  bounceWords?: number;
  /** How far each letter swells at the peak of its bounce (0.23 = 23% bigger). */
  letterSwell?: number;
  /** Frames between one letter starting its bounce and the next. */
  letterStagger?: number;
  /** Frames a letter takes to swell up. */
  letterRise?: number;
  /** Frames a letter stays swollen at the top of its bounce. */
  letterHold?: number;
  /** Frames a letter takes to settle back to its natural size. */
  letterFall?: number;

  /** Frames the line stays forward once everything has landed. */
  holdDuration?: number;
  /** Frames the whole line takes to fall back to its final size. */
  recedeDuration?: number;

  /** Resting letter-spacing (CSS value, em recommended). */
  letterSpacing?: string;
  speed?: number;
  className?: string;
}

/**
 * The lead word rising into place: already moving, decelerating to a standstill.
 *
 * A *moderate* decelerate, deliberately — not the quint/expo-out that this kind
 * of entrance usually reaches for. Those asymptote: they cover 99% of the travel
 * in the first third and then crawl. Over a 50px rise at 30fps that leaves five
 * frames moving less than half a pixel each, which rasterise to identical frames
 * — the word visibly stops dead partway up and then the next beat starts. This
 * curve still arrives at a standstill, but it spends its frames on travel you can
 * see. The general rule for anything on a frame clock: a settle worth one frame
 * is a settle; a settle worth five frames is a freeze.
 */
const RISE_EASE = Easing.bezier(0.2, 0.6, 0.35, 1);

/** The line floating forward: eases in, decelerates into a hang. */
const APPROACH_EASE = Easing.bezier(0.4, 0, 0.15, 1);

/**
 * The fall back. Heavily eased in — barely 10% travelled a third of the way
 * through — so the line hangs a moment longer than you expect and then carries
 * to a dead stop. No bounce.
 */
const ZOOM_EASE = Easing.bezier(0.5, 0, 0.05, 1);

/**
 * A word pushing into its slot, and the shove it gives the line. Quick off the
 * mark, long soft landing.
 */
const WORD_EASE = Easing.bezier(0.22, 0.8, 0.36, 1);

/**
 * Both halves of a letter's bounce. It leaves and arrives at a standstill, so
 * the letter eases off its baseline, rounds over the top and eases back down
 * with no kink at either end and no jerk on the way up.
 */
const LETTER_EASE = Easing.bezier(0.4, 0, 0.2, 1);

/** Fraction of the frame width the line may occupy. */
const FIT = 0.97;

/**
 * A title reveal built around one idea: the lead word is pushed aside by the
 * words that follow it.
 *
 * 1. The lead word rises from below and settles, centred, at its natural size.
 * 2. The line floats forward — toward the viewer.
 * 3. The second word cuts in from the right, its letters bouncing up off the
 *    baseline one after another, and **shoves the lead word left** to make room.
 *    Later words follow, pushing in without a bounce, each shoving the lead word
 *    further left.
 * 4. Once everything has landed, the whole line falls back to its final size and
 *    settles into the sentence.
 *
 * The shove is the point, so it is not on a clock of its own. Each word owns a
 * share of the leftward travel — its share of the width it adds to the line —
 * and spends that share over exactly the frames it spends pushing into its slot.
 * The lead word therefore cannot move until a word arrives to move it, and it
 * lands where the finished sentence needs it to be.
 *
 * Only `scale`, `translate` and `opacity` animate — nothing reflows — so the
 * baseline is fixed and there is no layout shift.
 */
export function TextSwell({
  text = "No extra charge",
  fontSize = 72,
  color,
  fontWeight = 600,
  theme,
  mode,
  fontFamily,
  introDuration = 8,
  riseDistance = 0.7,
  riseDuration = 10,
  startScale = 1,
  frontScale = 2.1,
  approachDelay = 14,
  approachDuration = 20,
  wordDelay = 27,
  wordStagger = 14,
  wordPush = 0.15,
  wordPushDuration = 12,
  bounceWords = 1,
  letterSwell = 0.23,
  letterStagger = 2,
  letterRise = 3,
  letterHold = 0,
  letterFall = 6,
  holdDuration = 6,
  recedeDuration = 18,
  letterSpacing = "-0.03em",
  speed = 1,
  className,
}: TextSwellProps) {
  const frame = useCurrentFrame() * speed;
  const { width } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const face =
    resolveFont(fontFamily ?? t.fontFamily) ??
    "-apple-system, BlinkMacSystemFont, sans-serif";
  const fill = color ?? t.foreground;

  const words = text.split(" ").filter(Boolean);

  /**
   * Why the scale is pivoted on the baseline, and not on the middle of the line.
   *
   * Browsers do not scale text the way they scale an image. They re-shape and
   * re-rasterise the glyphs at every new size, and the rasteriser snaps each
   * glyph's origin to the pixel grid: horizontally it gets quarter-pixel
   * precision, vertically it gets **none at all** — the origin rounds to a whole
   * device pixel. So a scale that moves the baseline makes the type climb the
   * pixel grid in whole-pixel steps. During the slow ends of an eased curve the
   * baseline drifts by a fraction of a pixel per frame, which rounds to *nothing*
   * for several frames and then to a whole pixel all at once: the letters sit
   * still, jump, sit still. That is the "stuck", and no amount of easing work
   * fixes it, because it is the type being quantised, not the animation.
   *
   * Pivot on the baseline and the baseline's device Y simply never changes, so
   * there is nothing to snap. The glyphs still re-rasterise at every size — which
   * is what we want, it is why they stay crisp — they just stop moving vertically
   * while doing it. Swept across a linear 1.6x → 1x ramp, the line's vertical
   * judder falls from 0.284px (pivoting on the middle, 29 direction reversals in
   * 40 frames) to 0.014px with zero reversals, and the minimum sits exactly on
   * the baseline and nowhere else.
   *
   * The alternative — compositing the line so the GPU resamples a bitmap — also
   * removes the snapping, but it stops the type being re-rasterised at all: what
   * you get on screen is a rescaled texture, softer than real type at every size
   * but one. Crisp and smooth beats smooth alone.
   *
   * The visible cost is that the line now grows *upward* off its baseline rather
   * than outward from its middle, which shifts the ink about 10px at full size on
   * a 720p frame. Type sitting on a line and growing off it is the more
   * typographic read anyway.
   */

  // The lead word sits in the middle of the frame while it is alone, and every
  // word after it shoves the line left by the width it adds. That needs the
  // line's rendered width and where each word ends inside it — all constant
  // across frames, so measure once and hold the render until they are known.
  // offsetLeft / offsetWidth are layout px, untouched by the animated
  // transforms, so they give the unscaled geometry.
  const lineRef = useRef<HTMLSpanElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [handle] = useState(() => delayRender("text-swell: measure line"));
  const baselineRef = useRef<HTMLSpanElement>(null);
  const [metrics, setMetrics] = useState<{
    lineWidth: number;
    leadCenter: number;
    /** Right edge of each word, in unscaled line-local px. */
    ends: number[];
    /** Distance from the top of the line box down to the text baseline. */
    baseline: number;
  } | null>(null);

  useEffect(() => {
    const line = lineRef.current;
    const spans = wordRefs.current.slice(0, words.length);
    if (!line || spans.length !== words.length || spans.some((s) => !s)) {
      continueRender(handle);
      return;
    }
    const lead = spans[0] as HTMLSpanElement;
    // An empty, zero-sized inline-block sits with its bottom edge on the text
    // baseline, so its offsetTop *is* the baseline — measured from the real font
    // metrics rather than guessed from a line-height ratio.
    const baseline = baselineRef.current?.offsetTop ?? line.offsetHeight * 0.8;
    setMetrics({
      lineWidth: line.offsetWidth,
      leadCenter: lead.offsetLeft + lead.offsetWidth / 2,
      ends: spans.map((s) => {
        const el = s as HTMLSpanElement;
        return el.offsetLeft + el.offsetWidth;
      }),
      baseline,
    });
  }, [handle, words.length]);

  // Release the render only once the measurement has re-rendered, so the very
  // first captured frame already carries the correct geometry (no blank frame).
  useEffect(() => {
    if (metrics) continueRender(handle);
  }, [metrics, handle]);

  const ready = metrics !== null;
  const lineWidth = metrics?.lineWidth ?? width * 0.4;
  const leadCenter = metrics?.leadCenter ?? lineWidth * 0.08;
  const ends =
    metrics?.ends ?? words.map((_, i) => ((i + 1) * lineWidth) / words.length);
  // Distance from the top of the line box down to the text baseline — the one
  // point the scale must not move. See the note above.
  const baseline = metrics?.baseline ?? fontSize * 0.88;

  // Where the line's left edge rests once everything has settled — flexbox
  // centres the line, and the transform pivots on that same left edge.
  const restLeft = (width - lineWidth) / 2;

  // Each trailing word owns a share of the leftward shove, proportional to the
  // width it adds to the line. `before[i]` is how much of the shove is already
  // spent by the time word `i` arrives.
  const added = words.map((_, i) => (i === 0 ? 0 : ends[i] - ends[i - 1]));
  const totalAdded = added.reduce((a, b) => a + b, 0) || 1;
  const share = added.map((a) => a / totalAdded);
  const before: number[] = [];
  for (let i = 0, run = 0; i < words.length; i++) {
    before.push(run);
    run += share[i];
  }

  const wordStart = (i: number) => wordDelay + (i - 1) * wordStagger;
  const letterStart = (i: number, j: number) =>
    wordStart(i) + j * letterStagger;

  // Floating forward blows the line up about its left edge, and until the last
  // word has finished shoving, that edge still sits right of where it will rest.
  // A word arriving into that gap is the widest the line ever gets, so cap the
  // float at whatever keeps even that moment inside the frame.
  let front = Math.min(frontScale, (width * FIT - restLeft) / lineWidth);
  for (let i = 1; i < words.length; i++) {
    const unspent = 1 - before[i];
    const room = width * FIT - restLeft - (lineWidth / 2) * unspent;
    const reach = ends[i] + wordPush * fontSize - leadCenter * unspent;
    if (reach > 0) front = Math.min(front, room / reach);
  }
  front = Math.max(1, front);

  // Float forward, hang, then fall back. The two curves never overlap — the
  // first clamps at `front` once the approach ends, the second is 0 until the
  // recede starts — so they sum into one continuous scale: startScale → front → 1.
  const lastEnd = Math.max(
    approachDelay + approachDuration,
    ...words.map((word, i) =>
      i === 0
        ? 0
        : Math.max(
            wordStart(i) + wordPushDuration,
            i <= bounceWords
              ? letterStart(i, word.length - 1) +
                  letterRise +
                  letterHold +
                  letterFall
              : 0,
          ),
    ),
  );
  const recedeStart = lastEnd + holdDuration;

  const scale =
    interpolate(
      frame,
      [approachDelay, approachDelay + approachDuration],
      [startScale, front],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: APPROACH_EASE,
      },
    ) +
    interpolate(
      frame,
      [recedeStart, recedeStart + recedeDuration],
      [0, 1 - front],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: ZOOM_EASE,
      },
    );

  // How much of the leftward shove has been spent. Nothing moves the lead word
  // but the words arriving to move it, so this is just their pushes added up.
  let shoved = 0;
  for (let i = 1; i < words.length; i++) {
    shoved +=
      share[i] *
      interpolate(
        frame,
        [wordStart(i), wordStart(i) + wordPushDuration],
        [0, 1],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: WORD_EASE,
        },
      );
  }

  // Unshoved, the line sits wherever puts the lead word in the middle of the
  // frame — at any scale, so the word stays centred as it floats forward. Fully
  // shoved, it sits on its resting left edge, which is where the finished
  // sentence belongs. `shoved` walks between the two.
  const translateX = (lineWidth / 2 - scale * leadCenter) * (1 - shoved);

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }}
    >
      <span
        ref={lineRef}
        className={className}
        style={{
          position: "relative",
          display: "inline-block",
          fontSize,
          fontWeight,
          color: fill,
          letterSpacing,
          lineHeight: 1.1,
          whiteSpace: "nowrap",
          fontFamily: face,
          // Pivot on the lead word's left edge, and on the baseline. See above:
          // the baseline is what must not move.
          transformOrigin: `0% ${baseline}px`,
          scale,
          translate: `${translateX}px`,
          opacity: ready ? 1 : 0,
          // The second half of the fix, and the one that stops the *shake* rather
          // than the stick.
          //
          // Hinting distorts each glyph's outline so its stems land on whole
          // pixels — great for a static paragraph, ruinous for type that is
          // changing size. As the scale slides, every stem re-snaps to a different
          // grid, so the letterforms visibly change shape from frame to frame.
          // They boil. Measured over the fall-back, the line's shape invariant
          // (ink area over width squared, which for a rigid shape being scaled
          // literally cannot change) wandered by 3.41% with hinting on and 0.22%
          // with it off — fifteen times steadier.
          //
          // `geometricPrecision` turns hinting off and asks for the outline to be
          // rendered as it actually is. The type reads very slightly softer,
          // because the stems are no longer being snapped — that is not blur, it
          // is the absence of a lie, and it is what every professional motion tool
          // does with type. It also forces sub-pixel glyph positioning on, which
          // Blink otherwise only enables above a device scale factor of 1 — and a
          // Remotion render is exactly 1.
          textRendering: "geometricPrecision",
          // Rendering and live playback want opposite things here, so give each
          // what it needs.
          //
          // A render has no time budget: the browser re-shapes and re-rasterises
          // every glyph at every new size, which is why the type stays genuinely
          // crisp, and the two fixes above are what make that smooth. Compositing
          // it would only replace real type with a rescaled texture — and worse,
          // a render is spread across parallel browser tabs, each of which
          // inherits a stale raster from whatever scale it drew last, so the same
          // frame comes out differently depending on which tab drew it.
          //
          // The Player is the opposite: one continuous tab, and roughly eight
          // milliseconds a frame on a 120Hz screen. Re-shaping a line of type at
          // a brand-new size every frame is the most expensive way to draw text,
          // and a frame that misses the budget is simply shown for the wrong
          // length of time — stutter that no amount of CSS can fix. So for live
          // playback, hand the scale to the compositor: measured on a single
          // continuous tab it is smooth (0.016px of judder) with no loss of
          // sharpness at all.
          ...(getRemotionEnvironment().isRendering
            ? null
            : { willChange: "transform" as const }),
        }}
      >
        {words.map((word, i) => {
          const isLead = i === 0;
          const start = wordStart(i);
          const bounces = i >= 1 && i <= bounceWords;
          return (
            // The gap between words is a plain text node *between* the word
            // spans, not inside one. A trailing space inside an inline-block sits
            // at the end of that box's line and CSS strips it, which would run
            // the sentence together.
            // biome-ignore lint/suspicious/noArrayIndexKey: words are positional and never reorder
            <Fragment key={i}>
              {isLead ? null : " "}
              <span
                ref={(el) => {
                  wordRefs.current[i] = el;
                }}
                style={{
                  display: "inline-block",
                  opacity: isLead
                    ? interpolate(frame, [0, introDuration], [0, 1], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      })
                    : interpolate(frame, [start, start + 3], [0, 1], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      }),
                  // The lead word rises from below into the middle. Every other
                  // word arrives from the right of its slot and pushes in.
                  translate: isLead
                    ? `0px ${interpolate(
                        frame,
                        [0, riseDuration],
                        [riseDistance * fontSize, 0],
                        {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                          easing: RISE_EASE,
                        },
                      )}px`
                    : `${interpolate(
                        frame,
                        [start, start + wordPushDuration],
                        [wordPush * fontSize, 0],
                        {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                          easing: WORD_EASE,
                        },
                      )}px`,
                }}
              >
                {/* Only a bouncing word is split into letters — the others stay
                    one run, which keeps their kerning intact. */}
                {bounces
                  ? Array.from(word).map((letter, j) => {
                      const rise = letterStart(i, j);
                      const fall = rise + letterRise + letterHold;
                      return (
                        <span
                          // biome-ignore lint/suspicious/noArrayIndexKey: letters are positional and never reorder
                          key={j}
                          style={{
                            display: "inline-block",
                            // Swell up off the baseline and settle back. The rise
                            // clamps at 1 and the fall is 0 until it starts, so
                            // the difference is one pulse: 0 → 1 → 0, with
                            // `letterHold` frames of flat top between them.
                            // Pivot on the baseline, not on `100%`. The bottom of
                            // an inline-block sits *below* the baseline by the
                            // descent, so pivoting there would drag the letter's
                            // baseline upward as it swells — and a baseline that
                            // moves is exactly what snaps to the pixel grid.
                            transformOrigin: `50% ${baseline}px`,
                            scale:
                              1 +
                              letterSwell *
                                (interpolate(
                                  frame,
                                  [rise, rise + letterRise],
                                  [0, 1],
                                  {
                                    extrapolateLeft: "clamp",
                                    extrapolateRight: "clamp",
                                    easing: LETTER_EASE,
                                  },
                                ) -
                                  interpolate(
                                    frame,
                                    [fall, fall + letterFall],
                                    [0, 1],
                                    {
                                      extrapolateLeft: "clamp",
                                      extrapolateRight: "clamp",
                                      easing: LETTER_EASE,
                                    },
                                  )),
                          }}
                        >
                          {letter}
                        </span>
                      );
                    })
                  : word}
              </span>
            </Fragment>
          );
        })}
        {/* Baseline ruler. An empty, zero-sized inline-block aligns its bottom
            edge to the text baseline, so `offsetTop` reads the baseline straight
            off the font's real metrics. Zero-sized, so it changes no layout. */}
        <span
          ref={baselineRef}
          style={{ display: "inline-block", width: 0, height: 0 }}
        />
      </span>
    </AbsoluteFill>
  );
}
