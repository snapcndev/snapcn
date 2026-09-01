"use client";

import type { ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  getRemotionEnvironment,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { type SnapCnTheme, useSnapCnTheme, withAlpha } from "@/lib/snap-cn-ui";

export type CursorVariant = "arrow" | "dot";

export interface CursorWaypoint {
  /**
   * Frame the cursor starts travelling TOWARDS this point, on this component's
   * own clock (i.e. against `useCurrentFrame() * speed`). Absolute, not
   * relative to the previous waypoint. Waypoints are sorted by `at`; ties break
   * on array order and the last one wins.
   *
   * The FIRST waypoint has nothing to travel from, so it places the cursor
   * rather than moving it — give it an off-frame `x` to have the cursor walk in.
   */
  at: number;
  /**
   * Destination, normalized: 0 -> 1 left to right across the composition,
   * origin top-left. FRAME coordinates — a camera move inside a child
   * `<ScreenRecording>` does not move the cursor. Values outside 0-1 are legal
   * and mean off-frame, so a cursor entering from the left starts at `x: -0.1`.
   */
  x: number;
  /** Destination, normalized: 0 -> 1 top to bottom. */
  y: number;
  /**
   * Frames the travel takes. Default 14. The cursor then RESTS here until the
   * next waypoint's `at` — there is no hold field, the hold is the gap. On the
   * first waypoint there is no travel, so this is the fade-up window instead.
   */
  duration?: number;
  /**
   * Pulse a click ring on ARRIVAL, i.e. at `at + duration`. To click twice
   * without moving, add a second waypoint at the same `x`/`y`.
   */
  click?: boolean;
}

export interface CursorTrackProps {
  /**
   * What the cursor moves over — anything. Rendered full-bleed underneath it.
   * Put the `<ScreenRecording>` (or the UI sim) in here, not this inside that:
   * the cursor has to be the top layer to read as a cursor.
   */
  children?: ReactNode;
  /**
   * The path, in any order. Defaults to `DEMO_PATH` so the component is worth
   * looking at with no props; pass `[]` and it renders nothing at all, i.e. it
   * becomes a no-op wrapper.
   */
  path?: CursorWaypoint[];
  /** `arrow` (default) is a pointer; `dot` is a touch/tap puck. */
  variant?: CursorVariant;
  /**
   * Cursor height in px. Omit it and the component computes 3.9% of the
   * composition height, so it stays the size a real cursor looks at any crop.
   */
  size?: number;
  /**
   * Cursor fill. Defaults to the theme's `foreground` — so pass `mode="dark"`
   * when the recording underneath is dark, and the cursor and its outline swap
   * together.
   */
  color?: string;
  /**
   * The outline that keeps the cursor readable over arbitrary footage. Defaults
   * to the theme's `background`, the opposite end of `color`.
   */
  outlineColor?: string;
  /** The click ring. Defaults to the theme's `primary`. */
  ringColor?: string;
  /** Frames a click ring lives for. Default 14. */
  clickFrames?: number;
  /**
   * Show the cursor parked at the first waypoint before its `at`. Default
   * false — it fades in as the first move starts, which is what stops a cursor
   * sitting inertly on frame 0.
   */
  showBefore?: boolean;
  /** Design-system token overrides. */
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
  /** Time multiplier. Every `at` is measured against `useCurrentFrame() * speed`. */
  speed?: number;
  className?: string;
}

// --- Constants -------------------------------------------------------------

/**
 * Cursor travel, and deliberately NOT the camera curve. A pointer accelerates
 * and decelerates; a camera decelerate on a cursor reads robotic. Same curve
 * the notch morph and the showcase crane already use.
 */
export const CURSOR_EASE = Easing.inOut(Easing.cubic);

/** Click ring growth. Opacity fades linearly under it. */
export const RING_EASE = Easing.out(Easing.cubic);

export const TRAVEL_FRAMES = 14;
export const CLICK_FRAMES = 14;
export const TAIL_FRAMES = 18;

/** Cursor height as a fraction of the composition height, when `size` is omitted. */
export const CURSOR_HEIGHT_RATIO = 0.039;

/** Ring radius at birth and at death, as multiples of the cursor height. */
export const RING_START = 0.18;
export const RING_END = 1.1;

/**
 * The macOS-style arrow, drawn in a 13x21 box with its hotspot — the tip — at
 * (1, 1). An SVG and not an emoji or a font glyph: a glyph is whatever face the
 * renderer happens to resolve, and it would carry the hinting problems the
 * motion-quality skill is about into the one element that moves every frame.
 */
const ARROW_VIEW_W = 13;
const ARROW_VIEW_H = 21;
const ARROW_TIP = 1;
const ARROW_PATH =
  "M1 1 L1 16.6 L4.6 13.2 L6.6 19.6 L9 18.8 L7.1 12.6 L11.6 12.6 Z";

/** The `dot` puck's diameter, as a multiple of the cursor height. */
const DOT_RATIO = 0.62;

/**
 * A short demo path: in from off-frame bottom-left, click, cross the frame,
 * click, then move off to the top-right. Carries the customizer preview and the
 * MCP skeleton, because `ControlType` has no array control to expose `path`
 * through — the same way `terminal-simulator` handles `lines`.
 */
export const DEMO_PATH: CursorWaypoint[] = [
  { at: 0, x: -0.06, y: 0.86, duration: 6 },
  { at: 8, x: 0.34, y: 0.44, duration: 22, click: true },
  { at: 52, x: 0.68, y: 0.62, duration: 20, click: true },
  { at: 96, x: 0.82, y: 0.28, duration: 18 },
];

// --- Pure helpers (unit-tested) -------------------------------------------

export interface CursorPose {
  /** Position, normalized to the frame, origin top-left. */
  x: number;
  y: number;
  /** Click-ring progress, 0 -> 1, or 0 when no ring is up. */
  click: number;
  /** 0 before the cursor has appeared, 1 once it has. */
  opacity: number;
}

const CLAMP = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

/**
 * Waypoints in the order they actually play. Same-`at` ties: the later array
 * entry wins and the earlier tied entries never display, so they can never act
 * as a leg's origin — the rule `useStateTransition` already uses for `Step`.
 */
function ordered(path: CursorWaypoint[]): CursorWaypoint[] {
  return path
    .map((w, index) => ({ w, index }))
    .sort((a, b) => a.w.at - b.w.at || a.index - b.index)
    .filter((e, i, arr) => i === arr.length - 1 || arr[i + 1].w.at !== e.w.at)
    .map((e) => e.w);
}

/**
 * The cursor's pose at `frame`, folding the path forward so a waypoint that
 * starts mid-travel takes over from where the cursor actually is. Pure: same
 * frame, same answer, whatever order Remotion renders in.
 *
 * ponytail: straight-line travel. If it reads robotic, add a per-leg arc here,
 * not a prop.
 */
export function cursorPoseAt(
  frame: number,
  path: CursorWaypoint[] = [],
  clickFrames: number = CLICK_FRAMES,
): CursorPose {
  const moves = ordered(path);
  if (moves.length === 0) return { x: 0.5, y: 0.5, click: 0, opacity: 0 };

  // The cursor fades up over the first waypoint's own `duration`, so a track
  // tunes its arrival without another prop. `showBefore` overrides this.
  const first = moves[0];
  const firstDur = first.duration ?? TRAVEL_FRAMES;
  const opacity =
    firstDur > 0
      ? interpolate(frame, [first.at, first.at + firstDur], [0, 1], {
          ...CLAMP,
          easing: RING_EASE,
        })
      : frame >= first.at
        ? 1
        : 0;

  // The first waypoint places the cursor — there is nothing to travel from.
  let x = first.x;
  let y = first.y;
  for (let i = 1; i < moves.length; i++) {
    const m = moves[i];
    if (frame < m.at) break;
    const dur = m.duration ?? TRAVEL_FRAMES;
    // Truncated, never blended: a leg that overruns the next move's `at` stops
    // contributing there, so the next leg starts from the pose actually on
    // screen and the cursor never averages two destinations.
    const until =
      i + 1 < moves.length ? Math.min(frame, moves[i + 1].at) : frame;
    const p =
      dur > 0
        ? interpolate(until, [m.at, m.at + dur], [0, 1], {
            ...CLAMP,
            easing: CURSOR_EASE,
          })
        : 1;
    x += (m.x - x) * p;
    y += (m.y - y) * p;
  }

  // The latest ring still alive wins, so two clicks close together do not stack
  // two circles on one point. Progress is measured from the frame AFTER the
  // click so `click === 0` reads as "no ring up" and the caller needs no second
  // flag; one frame of a 14-frame ring is not something you can see.
  let click = 0;
  if (clickFrames > 0) {
    for (const m of moves) {
      if (!m.click) continue;
      const at = m.at + (m.duration ?? TRAVEL_FRAMES);
      if (frame >= at && frame < at + clickFrames) {
        click = (frame - at + 1) / clickFrames;
      }
    }
  }

  return { x, y, click, opacity };
}

/**
 * Natural length of the cursor track — the last waypoint's `at + duration`,
 * plus `clickFrames` if it clicks, plus `TAIL_FRAMES`. A wrapper cannot see how
 * long its children run, so a scene's length is
 * `Math.max(childFrames, cursorTrackFrames(...))`.
 */
export function cursorTrackFrames(
  path: CursorWaypoint[] = [],
  clickFrames: number = CLICK_FRAMES,
): number {
  if (path.length === 0) return 0;
  let last = 0;
  for (const w of path) {
    const end =
      w.at + (w.duration ?? TRAVEL_FRAMES) + (w.click ? clickFrames : 0);
    if (end > last) last = end;
  }
  return last + TAIL_FRAMES;
}

// --- Component -------------------------------------------------------------

export function CursorTrack({
  children,
  path = DEMO_PATH,
  variant = "arrow",
  size,
  color,
  outlineColor,
  ringColor,
  clickFrames = CLICK_FRAMES,
  showBefore = false,
  theme,
  mode,
  speed = 1,
  className,
}: CursorTrackProps) {
  const frame = useCurrentFrame() * speed;
  const t = useSnapCnTheme(theme, mode);
  const { width, height } = useVideoConfig();
  const isRendering = getRemotionEnvironment().isRendering;

  const h = size ?? height * CURSOR_HEIGHT_RATIO;
  const ink = color ?? t.foreground;
  const outline = outlineColor ?? t.background;
  const ring = ringColor ?? t.primary;

  const pose = cursorPoseAt(frame, path, clickFrames);
  const opacity = showBefore ? 1 : pose.opacity;
  const hidden = path.length === 0 || opacity <= 0;

  // Ring: eased radius, linear opacity. It is a circle, not type, so scaling it
  // has none of the glyph-snapping failure modes the motion-quality skill warns
  // about — and it rides the cursor, so a ring never detaches from the pointer.
  const ringRadius = interpolate(
    pose.click,
    [0, 1],
    [h * RING_START, h * RING_END],
    {
      ...CLAMP,
      easing: RING_EASE,
    },
  );
  const ringOpacity = 1 - pose.click;
  const ringStroke = Math.max(1.5, h * 0.07);

  return (
    <AbsoluteFill className={className}>
      {children}
      {!hidden && (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          {/* The one element that transforms every frame, so the one place
              will-change belongs — and only outside a render, where a stale
              raster is inherited across parallel tabs (motion-quality skill). */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              opacity,
              transform: `translate(${pose.x * width}px, ${pose.y * height}px)`,
              ...(isRendering ? {} : { willChange: "transform" as const }),
            }}
          >
            {pose.click > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: -ringRadius,
                  top: -ringRadius,
                  width: ringRadius * 2,
                  height: ringRadius * 2,
                  borderRadius: "50%",
                  border: `${ringStroke}px solid ${ring}`,
                  backgroundColor: withAlpha(ring, 0.12),
                  opacity: ringOpacity,
                }}
              />
            )}
            {variant === "dot" ? (
              <div
                style={{
                  position: "absolute",
                  left: (-h * DOT_RATIO) / 2,
                  top: (-h * DOT_RATIO) / 2,
                  width: h * DOT_RATIO,
                  height: h * DOT_RATIO,
                  borderRadius: "50%",
                  backgroundColor: withAlpha(ink, 0.42),
                  border: `${Math.max(1.5, h * 0.05)}px solid ${outline}`,
                }}
              />
            ) : (
              <svg
                viewBox={`0 0 ${ARROW_VIEW_W} ${ARROW_VIEW_H}`}
                width={(h * ARROW_VIEW_W) / ARROW_VIEW_H}
                height={h}
                style={{
                  // The hotspot is the tip, at (1, 1) of the box — not its
                  // corner. Both axes scale by h / ARROW_VIEW_H.
                  position: "absolute",
                  left: (-h * ARROW_TIP) / ARROW_VIEW_H,
                  top: (-h * ARROW_TIP) / ARROW_VIEW_H,
                  display: "block",
                }}
              >
                <title>Pointer</title>
                {/* `paint-order: stroke` puts the whole outline outside the
                    letterform, the way Rule 3c does for captions — a centred
                    stroke would eat a fifth of the arrow's ink. No drop shadow:
                    the outline is what carries it over arbitrary footage. */}
                <path
                  d={ARROW_PATH}
                  fill={ink}
                  stroke={outline}
                  strokeWidth={1.4}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                />
              </svg>
            )}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
