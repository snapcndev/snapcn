"use client";

import { useEffect, useMemo, useState } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { type SnapCnTheme, useSnapCnTheme } from "@/lib/snap-cn-ui";

export type TextBuildAxis = "x" | "y";

export interface TextBuildProps {
  text: string;
  /** Build direction: "x" pushes the line sideways, "y" stacks rows. */
  axis?: TextBuildAxis;
  /** Distance a new word travels in from (px). Defaults: 88 on x, 28 on y. */
  entryOffset?: number;
  /** Space between words (px on x) or between rows (px on y, default 12). */
  gap?: number;
  /** Frames the first word takes to settle. */
  firstDuration?: number;
  /** Frames each subsequent enter/push/reflow step takes. */
  pushDuration?: number;
  /** Scale a word enters at before settling to 1. */
  entryScale?: number;
  /** Blur (px) a word enters with. Defaults: 3.5 on x, 2.4 on y. */
  entryBlur?: number;
  /** Peak blur (px) on already-placed words while they reflow. */
  reflowBlur?: number;
  /** Cubic-bezier easing for every move. */
  easing?: [number, number, number, number];
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

const MEASURE_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/** Per-axis defaults harvested from the two legacy looks. */
const AXIS_DEFAULTS: Record<
  TextBuildAxis,
  {
    entryOffset: number;
    gap: number;
    entryBlur: number;
    /** Subtle drift the very first word settles from, on the cross axis (x)
     * or the primary axis (y). */
    firstDrift: number;
  }
> = {
  x: { entryOffset: 88, gap: 10, entryBlur: 3.5, firstDrift: 6 },
  y: { entryOffset: 28, gap: 12, entryBlur: 2.4, firstDrift: -14 },
};

/**
 * Size of each word along the build axis. On "x" this is the measured text
 * width (canvas measureText, with a `length * fontSize * 0.55` SSR fallback);
 * on "y" every row is one `fontSize` tall.
 */
function fallbackWordSizes(
  words: string[],
  axis: TextBuildAxis,
  fontSize: number,
): number[] {
  if (axis === "y") return words.map(() => fontSize);
  return words.map((w) => w.length * fontSize * 0.55);
}

export function measureWordSizes(
  words: string[],
  axis: TextBuildAxis,
  fontSize: number,
  fontWeight: number,
): number[] {
  if (axis === "y") return words.map(() => fontSize);
  if (typeof document === "undefined")
    return fallbackWordSizes(words, axis, fontSize);
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return fallbackWordSizes(words, axis, fontSize);
  ctx.font = `${fontWeight} ${fontSize}px ${MEASURE_FONT}`;
  return words.map((w) => ctx.measureText(w).width);
}

/**
 * Center coordinates for every intermediate layout. `result[k - 1][j]` is the
 * centered position of word `j` while the first `k` words are on stage, so
 * placed words can be interpolated between consecutive layouts as new words
 * land.
 */
export function centeredPositions(sizes: number[], gap: number): number[][] {
  const out: number[][] = [];
  for (let k = 1; k <= sizes.length; k++) {
    let total = gap * (k - 1);
    for (let j = 0; j < k; j++) total += sizes[j];
    let cursor = -total / 2;
    const centers: number[] = [];
    for (let j = 0; j < k; j++) {
      centers.push(cursor + sizes[j] / 2);
      cursor += sizes[j] + gap;
    }
    out.push(centers);
  }
  return out;
}

export function TextBuild({
  text,
  axis = "x",
  entryOffset,
  gap,
  firstDuration = 10,
  pushDuration = 13,
  entryScale = 0.992,
  entryBlur,
  reflowBlur = 0.8,
  easing = [0.2, 0.8, 0.2, 1],
  fontSize = 72,
  color,
  fontWeight = 600,
  speed = 1,
  className,
  theme,
  mode,
}: TextBuildProps) {
  const frame = useCurrentFrame() * speed;
  const t = useSnapCnTheme(theme, mode);
  const fill = color ?? t.foreground;

  const defaults = AXIS_DEFAULTS[axis];
  const offset = entryOffset ?? defaults.entryOffset;
  const spacing = gap ?? defaults.gap;
  const inBlur = entryBlur ?? defaults.entryBlur;

  const words = useMemo(() => text.split(" "), [text]);

  // Canvas text measurement isn't available during SSR, so the first client
  // render must also use the fallback estimate (matching the server-rendered
  // markup) before upgrading to the precise canvas measurement post-mount —
  // otherwise the two renders disagree and React logs a hydration mismatch.
  const [measured, setMeasured] = useState(false);
  useEffect(() => setMeasured(true), []);
  const sizes = useMemo(
    () =>
      measured
        ? measureWordSizes(words, axis, fontSize, fontWeight)
        : fallbackWordSizes(words, axis, fontSize),
    [measured, words, axis, fontSize, fontWeight],
  );
  const positionsAt = useMemo(
    () => centeredPositions(sizes, spacing),
    [sizes, spacing],
  );

  const n = words.length;
  const ease = Easing.bezier(easing[0], easing[1], easing[2], easing[3]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }}
    >
      <div
        className={className}
        style={{
          position: "relative",
          fontSize,
          fontWeight,
          color: fill,
          letterSpacing: "-0.03em",
          fontFamily: FONT_FAMILY,
          whiteSpace: "nowrap",
        }}
      >
        {words.map((word, j) => {
          const entryStart =
            j === 0 ? 0 : firstDuration + (j - 1) * pushDuration;
          const entryEnd =
            entryStart + (j === 0 ? firstDuration : pushDuration);
          const target = positionsAt[j][j];

          // Where the word enters from. Later words travel `offset` along the
          // build axis (from the right on x, from above on y). The first word
          // only drifts subtly: cross-axis on x, a short drop on y.
          const primaryFrom =
            j === 0
              ? axis === "y"
                ? target + defaults.firstDrift
                : target
              : axis === "y"
                ? target - offset
                : target + offset;
          const crossFrom = j === 0 && axis === "x" ? defaults.firstDrift : 0;

          let primary = target;
          let cross = 0;
          let opacity = 1;
          let scale = 1;
          let blur = 0;

          if (frame < entryStart) {
            opacity = 0;
            primary = primaryFrom;
            cross = crossFrom;
            scale = entryScale;
            blur = inBlur;
          } else if (frame <= entryEnd) {
            const range: [number, number] = [entryStart, entryEnd];
            const opts = {
              extrapolateLeft: "clamp" as const,
              extrapolateRight: "clamp" as const,
              easing: ease,
            };
            primary = interpolate(frame, range, [primaryFrom, target], opts);
            cross = interpolate(frame, range, [crossFrom, 0], opts);
            opacity = interpolate(frame, range, [0, 1], opts);
            scale = interpolate(frame, range, [entryScale, 1], opts);
            blur = interpolate(frame, range, [inBlur, 0], opts);
          } else {
            // Placed word: reflow between consecutive layouts as each later
            // word lands, with a soft blur pulse mid-move.
            for (let w = j + 1; w < n; w++) {
              const pushStart = firstDuration + (w - 1) * pushDuration;
              const pushEnd = pushStart + pushDuration;
              const from = positionsAt[w - 1][j];
              const to = positionsAt[w][j];
              if (frame >= pushEnd) {
                primary = to;
              } else if (frame >= pushStart) {
                primary = interpolate(frame, [pushStart, pushEnd], [from, to], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: ease,
                });
                blur = interpolate(
                  frame,
                  [pushStart, (pushStart + pushEnd) / 2, pushEnd],
                  [0, reflowBlur, 0],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                );
                break;
              } else {
                primary = from;
                break;
              }
            }
          }

          const tx = axis === "x" ? primary : 0;
          const ty = axis === "x" ? cross : primary;

          return (
            <span
              key={`${j}-${word}`}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                whiteSpace: "nowrap",
                // Plain 2D transforms, deliberately. `translate3d(…, 0)` and
                // `backfaceVisibility: hidden` are the same layer-promotion
                // trick wearing two hats: they buy smoothness by handing the
                // scale to the compositor, which resamples a bitmap instead of
                // re-rasterising real type. On a word that is both scaling and
                // blurring, that is the whole deliverable.
                transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${scale})`,
                filter: `blur(${blur}px)`,
                opacity,
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
}
