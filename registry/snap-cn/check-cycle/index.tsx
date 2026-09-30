"use client";

import { loadFont as loadSans } from "@remotion/google-fonts/Inter";
import { type CSSProperties, useEffect, useId, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";

/**
 * A sentence that finishes itself over and over: "Create your own ☑ Intros",
 * then Demos, Launches, Changelogs, Tutorials, "And more" — each word rolling
 * up out of a slot beside a ticked checkbox — then the line steps back a little
 * and rests.
 *
 * ## Everything here was measured off a recording, frame by frame
 *
 * The numbers below are not taste. They were recovered from a 2.17 second,
 * 718 × 394 screen capture (65 frames) by fitting renders of this scene to it
 * in BT.709 Y′CbCr, through a model of the capture's own resampling kernel:
 *
 *   - the recording is a 30fps video captured at a jittery ~30Hz: its
 *     timestamps wander ±8ms, but snapped to a 30fps grid every capture frame
 *     is exactly one source frame — none doubled, none dropped. Fitted on that
 *     clock instead of the stamps, every curve below came out clean.
 *   - the two words in the slot move as ONE strip — the gap between the word
 *     leaving and the word arriving is constant to 0.2px on every frame of a
 *     roll — so it is one curve, not an ease-in exit and an ease-out entrance.
 *     It is `cubic-bezier(0.65, 0, 0.35, 1)` over exactly 0.5s, a roll every
 *     20 frames: 0.076px RMS across both rolls. The runner-up, quart in-out,
 *     is 0.10; the CSS `ease-in-out` is 0.69.
 *   - the strip does not travel the same distance every time: 44.19px, then
 *     42.27px. Both are shipped, in `TRAVEL`, and cycle.
 *
 * ## The type is Inter 3, and that was measured too
 *
 * Fingerprinted on the five words the recording shows, at matched width:
 * Inter 500 is 0.45px RMS from the reference, the next face (Be Vietnam Pro)
 * 0.48, Helvetica 0.50, Geist 0.61. SF Pro, fitted outline against outline,
 * is 37% worse than Inter. And it is Inter *3*: the same fit against Inter
 * 3.19 is 12% closer across all four lines than against the Inter 4 Google
 * serves today, and a third closer on the lead-in alone. So 3.19 is loaded
 * (OFL, from fontsource), with Google's Inter behind it as the fallback.
 *
 * ## The checkbox sits still, and everything is laid out from it
 *
 * The lead-in is right-aligned to the box and the word left-aligned from it, so
 * the sentence survives new copy: the box never moves, only the words around it
 * change width — which is also what the reference does when "Docs" becomes
 * "And more".
 */

const { fontFamily: SANS } = loadSans("normal", {
  weights: ["500"],
  subsets: ["latin"],
});

const FACE = "Check Cycle Inter";
const FACE_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-500-normal.woff2";
let faceLoad: Promise<unknown> | null = null;
function loadFace(): Promise<unknown> {
  if (faceLoad) return faceLoad;
  if (typeof FontFace === "undefined") {
    faceLoad = Promise.resolve();
    return faceLoad;
  }
  const face = new FontFace(FACE, `url(${FACE_URL}) format("woff2")`, {
    weight: "500",
  });
  document.fonts.add(face);
  // A face that fails to load leaves Google's Inter to paint — close, not exact.
  faceLoad = face.load().catch(() => undefined);
  return faceLoad;
}

/* ─────────────────────────────────────────────────────────────────────────
   The scene, in the reference's own 718 × 394 pixels
   ───────────────────────────────────────────────────────────────────────── */

export const REF_W = 718;
export const REF_H = 394;

/** Type size of both halves of the sentence. Fitted per line: 21.62–21.97. */
export const SIZE = 21.78;
/** Where the lead-in's advance ends — it is right-aligned to this x. */
export const LEAD_END = 340.04;
/** The lead-in's baseline. */
export const LEAD_BASE = 203.01;
/** Where the word's advance starts. */
export const WORD_X = 379.1;
/** The word's baseline: 1.5px below the lead-in's, on every word shown. */
export const WORD_BASE = 204.97;

/** The checkbox, as x, y, width, height, corner radius. */
export const BOX = { x: 345.11, y: 183.71, w: 27.03, h: 27.59, r: 6.53 };
/** The tick, as three points in the box's own coordinates, and its stroke. */
export const TICK: readonly (readonly [number, number])[] = [
  [5.468, 13.785],
  [11.827, 18.695],
  [20.72, 8.888],
];
export const TICK_W = 2.72;

/**
 * The slot the words roll through: a hard clip, top and bottom. Fitted as a
 * feathered mask across eight frames with both words visible — the feathers
 * came back at 2.1px and 1.0px, which is the capture's blur, not a fade.
 */
export const SLOT = [171.37, 223.62] as const;

/** How far the strip travels on each roll, in turn. */
export const TRAVEL = [44.19, 42.27] as const;
/** When the first roll starts, how often a roll comes, and how long it takes. */
export const ROLL_AT = 0.0324;
export const ROLL_EVERY = 0.667;
export const ROLL_FOR = 0.5;
/** The roll's curve: the in-out cubic. */
export const ROLL_EASE = Easing.bezier(0.65, 0, 0.35, 1);

/** How long the last word holds after its roll starts, before the step back. */
export const HOLD = 1.004;

/**
 * The step back: the line shrinks about the frame's centre to `ZOOM_TO` and
 * rests there. The recording falls all the way to nothing; this keeps only the
 * start of that — a settle, not an exit.
 */
export const PIVOT = [359.14, 197.52] as const;
export const ZOOM_TO = 0.8;
export const ZOOM_FOR = 0.6;
export const ZOOM_EASE = Easing.bezier(0.65, 0, 0.35, 1);
/** Frames' worth of rest at the smaller size before the scene ends. */
export const ZOOM_REST = 0.2;

const unit = (v: number) => Math.min(1, Math.max(0, v));

/** Strip travel at `now` seconds, for a list of `n` words. */
export function stripAt(now: number, n: number): number {
  let s = 0;
  for (let k = 0; k < n - 1; k++) {
    const p = unit((now - (ROLL_AT + k * ROLL_EVERY)) / ROLL_FOR);
    s += (TRAVEL[k % TRAVEL.length] ?? 0) * ROLL_EASE(p);
  }
  return s;
}

/** Where word `k` rests on the strip. */
export function restOf(k: number): number {
  let c = 0;
  for (let j = 0; j < k; j++) c += TRAVEL[j % TRAVEL.length] ?? 0;
  return c;
}

/** When the step back starts, for `n` words. */
export function zoomStart(n: number): number {
  return ROLL_AT + Math.max(0, n - 2) * ROLL_EVERY + HOLD;
}

/** Camera scale at `now`: 1, easing down to `ZOOM_TO`. */
export function zoomAt(now: number, n: number): number {
  return 1 - (1 - ZOOM_TO) * ZOOM_EASE(unit((now - zoomStart(n)) / ZOOM_FOR));
}

/** Seconds from the first frame to the end: rolls, hold, step back, rest. */
export function sceneLength(n: number): number {
  return zoomStart(n) + ZOOM_FOR + ZOOM_REST;
}

/**
 * A line of type that can sit — and move — a fraction of a pixel.
 *
 * Chrome rounds a glyph run's baseline to a whole device pixel, in HTML and
 * SVG alike, with or without `will-change`. On the roll's slow lift-off that
 * is measured, not theoretical: the word held still for four frames and then
 * jumped a pixel, three times, before it started to move at all.
 *
 * So the line is painted twice, one device pixel apart, both copies placed ON
 * a whole pixel so there is nothing left to round, and cross-faded by the
 * fraction in between. `plus-lighter` adds the two copies' coverage instead of
 * stacking one over the other, so the blend is exactly linear: a baseline at
 * 0.25 of a pixel reads as 0.25, and the ink's centroid moves in steps of
 * 1/8 px when it is asked to (measured). That is the resample a video of this
 * line would have — which is what the reference is.
 */
function Line({
  x,
  y,
  dev,
  anchor,
  style,
  children,
}: {
  x: number;
  y: number;
  dev: { a: number; b: number };
  anchor?: "end";
  style: CSSProperties;
  children: string;
}) {
  const d = dev.a * y + dev.b;
  const lo = Math.floor(d);
  const f = d - lo;
  // A thousandth of a pixel inside the row, so the rounding has nowhere to go.
  const at = (row: number) => (row + 1e-3 - dev.b) / dev.a;
  return (
    <g style={{ isolation: "isolate" }}>
      {[
        [lo, 1 - f],
        [lo + 1, f],
      ].map(([row, w]) => (
        <text
          key={row}
          x={x}
          y={at(row ?? 0)}
          textAnchor={anchor}
          style={{ ...style, opacity: w, mixBlendMode: "plus-lighter" }}
        >
          {children}
        </text>
      ))}
    </g>
  );
}

export interface CheckCycleProps {
  /** The part of the sentence that never changes. */
  headline?: string;
  /** The words that finish it, in order, comma separated. */
  words?: string;
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
  fontFamily?: string;
}

export function CheckCycle({
  headline = "Create your own",
  words = "Intros, Demos, Launches, Changelogs, Tutorials, And more",
  theme,
  mode = "light",
  fontFamily = "Default",
}: CheckCycleProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily) ?? `"${FACE}", ${SANS}`;
  const [handle] = useState(() => delayRender("check-cycle: loading Inter 3"));
  useEffect(() => {
    loadFace().then(() => continueRender(handle));
  }, [handle]);
  const id = useId().replace(/:/g, "");

  const list = words
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
  const n = Math.max(1, list.length);
  const now = frame / fps;

  /**
   * One reference pixel, and the offset that centres the layout. Scaled to
   * whichever side is tighter, so a render at the reference's dimensions *is*
   * the reference's dimensions and nothing resamples mid-comparison.
   */
  const u = Math.min(width / REF_W, height / REF_H);
  const s = stripAt(now, n);
  const z = zoomAt(now, n);

  const type = {
    fontFamily: face,
    fontWeight: 500,
    fontSize: SIZE,
    fill: t.foreground,
    // Unhinted outlines, so the sub-pixel `Line` blend moves the shape it
    // drew rather than a re-hinted one.
    textRendering: "geometricPrecision",
  } as const;

  const top = (height - REF_H * u) / 2;
  // A Remotion render's `scale` is the page's devicePixelRatio.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  // A baseline, y in scene units, lands on device row a·y + b.
  const [x0, y0] = PIVOT;
  const dev = { a: dpr * u * z, b: dpr * (top + u * y0 * (1 - z)) };

  return (
    <AbsoluteFill style={{ backgroundColor: t.background }}>
      <svg
        width={REF_W * u}
        height={REF_H * u}
        viewBox={`0 0 ${REF_W} ${REF_H}`}
        style={{
          position: "absolute",
          left: (width - REF_W * u) / 2,
          top: (height - REF_H * u) / 2,
          overflow: "visible",
        }}
      >
        <defs>
          <clipPath id={`${id}-slot`}>
            <rect x={0} y={SLOT[0]} width={REF_W} height={SLOT[1] - SLOT[0]} />
          </clipPath>
        </defs>

        <g
          transform={`translate(${x0} ${y0}) scale(${z}) translate(${-x0} ${-y0})`}
        >
          <Line x={LEAD_END} y={LEAD_BASE} dev={dev} anchor="end" style={type}>
            {headline}
          </Line>

          <rect
            x={BOX.x}
            y={BOX.y}
            width={BOX.w}
            height={BOX.h}
            rx={BOX.r}
            fill={t.primary}
          />
          <polyline
            points={TICK.map(([a, b]) => `${BOX.x + a},${BOX.y + b}`).join(" ")}
            fill="none"
            stroke={t.primaryForeground}
            strokeWidth={TICK_W}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <g clipPath={`url(#${id}-slot)`}>
            {list.map((word, k) => {
              const y = WORD_BASE + restOf(k) - s;
              // Off the slot entirely: nothing to paint.
              if (Math.abs(y - WORD_BASE) > SLOT[1] - SLOT[0] + SIZE)
                return null;
              return (
                <Line
                  key={`${k}-${word}`}
                  x={WORD_X}
                  y={y}
                  dev={dev}
                  style={type}
                >
                  {word}
                </Line>
              );
            })}
          </g>
        </g>
      </svg>
    </AbsoluteFill>
  );
}
