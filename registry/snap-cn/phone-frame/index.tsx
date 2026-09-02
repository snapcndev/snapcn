"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  Easing,
  getRemotionEnvironment,
  Img,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
  withAlpha,
} from "@/lib/snap-cn-ui";

export type PhoneFrameVariant = "flat" | "tilt" | "showcase";
export type PhoneFrameEntrance = "rise" | "rotate-in" | "float";

export interface PhoneFrameProps {
  /** Screen content. Falls back to `screenSrc`, then the ride-summary placeholder. */
  children?: ReactNode;
  /**
   * Image *or* video to fill the screen when `children` is omitted. Videos
   * (.mp4/.webm/.mov/.m4v) play via `<OffthreadVideo>`, images via `<Img>` —
   * both cover-fit the screen.
   */
  screenSrc?: string;
  /**
   * `flat` faces the camera; `tilt` adds a static 3D rotateY; `showcase` is a
   * cinematic crane move — the camera starts low at the bottom-left corner of
   * the laid-back device, sweeps up the screen while zooming in, then pulls
   * back and settles on a straight frontal view.
   */
  variant?: PhoneFrameVariant;
  /** How the device enters the frame. */
  entrance?: PhoneFrameEntrance;
  /** Device shell color. Defaults to the theme's `foreground`. */
  bezelColor?: string;
  /** Screen fill behind the children. Defaults to the theme's `card`. */
  screenColor?: string;
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
  /** Outer body corner radius. Defaults to real-device curvature. */
  radius?: number;
  /** Screen corner radius. Defaults to `radius - bezel` (concentric corners). */
  screenRadius?: number;
  /** CSS box-shadow under the device. Empty string disables it. */
  shadow?: string;
  /** Uniform size multiplier for the whole device. */
  scale?: number;
  /** Render the dynamic-island cutout over the screen. */
  showDynamicIsland?: boolean;
  /** Gentle vertical bob after the entrance settles. */
  floatLoop?: boolean;
  /** Peak float displacement in pixels. */
  floatAmplitude?: number;
  /** rotateY angle (degrees) used by the `tilt` variant. */
  tiltAngle?: number;
  speed?: number;
  className?: string;
}

const FONT_FAMILY =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/** Device shell size — matches the ~0.488 width:height ratio of a real iPhone. */
export const DEVICE_WIDTH = 320;
export const DEVICE_HEIGHT = 656;

/** Shell thickness between the body edge and the screen. */
export const BEZEL_WIDTH = 12;

/** Outer body curvature: real devices sit near 16.5% of the body width. */
export const DEVICE_RADIUS_RATIO = 0.165;

/** Frames the entrance takes before the device is fully settled. */
export const ENTRANCE_FRAMES = 30;

/** Seconds per full float-loop cycle. */
export const FLOAT_PERIOD_SECONDS = 4.5;

/** Default outer radius for a given device width (real-device curvature). */
export function deviceRadius(deviceWidth: number): number {
  return Math.round(deviceWidth * DEVICE_RADIUS_RATIO);
}

/**
 * Concentric-corner rule: the screen radius is the body radius minus the
 * bezel thickness, floored so tiny radii never go negative.
 */
export function screenRadiusFor(
  radius: number,
  bezel: number = BEZEL_WIDTH,
): number {
  return Math.max(4, radius - bezel);
}

export interface EntrancePose {
  opacity: number;
  translateY: number;
  rotateDeg: number;
  scale: number;
}

/**
 * Pure entrance schedule. All three entrances settle to the identity pose by
 * `ENTRANCE_FRAMES`, so the float loop can take over without a seam.
 */
export function entrancePose(
  frame: number,
  entrance: PhoneFrameEntrance,
): EntrancePose {
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const easeOut = Easing.out(Easing.cubic);

  if (entrance === "rotate-in") {
    return {
      opacity: interpolate(frame, [0, 12], [0, 1], clamp),
      translateY: interpolate(frame, [0, 28], [60, 0], {
        ...clamp,
        easing: easeOut,
      }),
      rotateDeg: interpolate(frame, [0, 28], [-8, 0], {
        ...clamp,
        easing: easeOut,
      }),
      scale: interpolate(frame, [0, 28], [0.94, 1], {
        ...clamp,
        easing: easeOut,
      }),
    };
  }

  if (entrance === "float") {
    return {
      opacity: interpolate(frame, [0, 16], [0, 1], clamp),
      translateY: 0,
      rotateDeg: 0,
      scale: interpolate(frame, [0, 24], [0.96, 1], {
        ...clamp,
        easing: easeOut,
      }),
    };
  }

  // rise (default)
  return {
    opacity: interpolate(frame, [0, 12], [0, 1], clamp),
    translateY: interpolate(frame, [0, 26], [70, 0], {
      ...clamp,
      easing: easeOut,
    }),
    rotateDeg: 0,
    scale: 1,
  };
}

/**
 * Deterministic float-loop offset in pixels. Starts at 0 with an upward
 * drift at `startFrame`, so it blends seamlessly out of any entrance.
 */
export function floatOffset(
  frame: number,
  fps: number,
  amplitude: number,
  startFrame = 0,
  periodSeconds: number = FLOAT_PERIOD_SECONDS,
): number {
  const local = Math.max(0, frame - startFrame);
  const value =
    Math.sin((local / (fps * periodSeconds)) * Math.PI * 2) * amplitude;
  // Negative = upward drift; the `=== 0` guard avoids returning -0.
  return value === 0 ? 0 : -value;
}

/** Side-button spec (position along the edge, length) in body pixels. */
export const SIDE_BUTTONS: Array<{
  side: "left" | "right";
  top: number;
  length: number;
}> = [
  { side: "left", top: 118, length: 26 }, // action button
  { side: "left", top: 166, length: 46 }, // volume up
  { side: "left", top: 222, length: 46 }, // volume down
  { side: "right", top: 176, length: 68 }, // power
];

// ─── Ride-summary demo screen ────────────────────────────────────────────────
// A glowing GPS route draws itself across a dark map while stat "insight" pills
// pop in along it — the default screen the phone shows off as it rotates.

/** Screen interior (device minus bezel on both sides). */
const SCREEN_W = DEVICE_WIDTH - BEZEL_WIDTH * 2; // 296
const SCREEN_H = DEVICE_HEIGHT - BEZEL_WIDTH * 2; // 632

/** Route waypoints in screen space; a closed loop drawn head-first from [0]. */
const ROUTE: ReadonlyArray<readonly [number, number]> = [
  [224, 450],
  [172, 462],
  [116, 460],
  [70, 450],
  [52, 412],
  [74, 382],
  [104, 388],
  [134, 372],
  [162, 380],
  [192, 364],
  [222, 372],
  [248, 396],
  [256, 424],
  [244, 448],
];

/** Cumulative segment lengths of the closed polyline (last→first closes it). */
function routeCumLengths(pts: ReadonlyArray<readonly [number, number]>) {
  const cum = [0];
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
    cum.push(total);
  }
  return { cum, total };
}

const ROUTE_LEN = routeCumLengths(ROUTE);

/** Point at fraction `f` (0..1) along the closed route — the draw head. */
export function pointAtFraction(
  f: number,
  pts: ReadonlyArray<readonly [number, number]> = ROUTE,
): { x: number; y: number } {
  const { cum, total } = pts === ROUTE ? ROUTE_LEN : routeCumLengths(pts);
  const target = Math.max(0, Math.min(1, f)) * total;
  for (let i = 0; i < pts.length; i++) {
    if (cum[i + 1] >= target) {
      const seg = cum[i + 1] - cum[i] || 1;
      const t = (target - cum[i]) / seg;
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t };
    }
  }
  const last = pts[pts.length - 1];
  return { x: last[0], y: last[1] };
}

/** Catmull-Rom → cubic-bezier smoothing of a closed point loop into an SVG `d`. */
export function smoothClosedPath(
  pts: ReadonlyArray<readonly [number, number]>,
): string {
  const n = pts.length;
  const p = (i: number) => pts[((i % n) + n) % n];
  let d = `M ${p(0)[0]} ${p(0)[1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${p2[0]} ${p2[1]}`;
  }
  return `${d} Z`;
}

const ROUTE_PATH = smoothClosedPath(ROUTE);

/** An "insight" pill anchored to a point on the route. */
interface Pill {
  title: string;
  sub: string;
  icon: "climb" | "heart" | "trophy" | "bolt" | "flame";
  tint: string;
  x: number;
  y: number;
  anchor: readonly [number, number];
  appear: number;
}

const PILLS: Pill[] = [
  {
    title: "BIG CLIMB",
    sub: "+993 ft",
    icon: "climb",
    tint: "#D2925F",
    x: 100,
    y: 196,
    anchor: [148, 372],
    appear: 74,
  },
  {
    title: "SETTLED",
    sub: "HR steady at 116",
    icon: "heart",
    tint: "#84B27C",
    x: 80,
    y: 234,
    anchor: [132, 374],
    appear: 60,
  },
  {
    title: "NEW PR",
    sub: "Fastest 5 mi",
    icon: "trophy",
    tint: "#ADA69E",
    x: 44,
    y: 292,
    anchor: [64, 398],
    appear: 40,
  },
  {
    title: "FASTEST SPLIT",
    sub: "23 mph avg",
    icon: "bolt",
    tint: "#ADA69E",
    x: 168,
    y: 300,
    anchor: [242, 378],
    appear: 52,
  },
  {
    title: "SPRINT",
    sub: "Hit 32 mph",
    icon: "flame",
    tint: "#CC6D5C",
    x: 158,
    y: 402,
    anchor: [232, 448],
    appear: 22,
  },
];

/** Small monochrome pill glyphs, tinted per pill. */
function PillIcon({ kind, color }: { kind: Pill["icon"]; color: string }) {
  const stroke = {
    width: 11,
    height: 11,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (kind === "climb") {
    return (
      <svg aria-hidden {...stroke}>
        <title>climb</title>
        <path d="M7 17 17 7" />
        <path d="M8 7h9v9" />
      </svg>
    );
  }
  if (kind === "trophy") {
    return (
      <svg aria-hidden {...stroke}>
        <title>trophy</title>
        <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
        <path d="M7 6H4v1a3 3 0 0 0 3 3" />
        <path d="M17 6h3v1a3 3 0 0 1-3 3" />
        <path d="M9 20h6M12 14v6" />
      </svg>
    );
  }
  if (kind === "heart") {
    return (
      <svg aria-hidden width={11} height={11} viewBox="0 0 24 24" fill={color}>
        <title>heart</title>
        <path d="M12 21S3.5 15.4 3.5 9.4C3.5 6.4 5.6 4.5 8 4.5c1.8 0 3.2 1.1 4 2.4.8-1.3 2.2-2.4 4-2.4 2.4 0 4.5 1.9 4.5 4.9 0 6-8.5 11.6-8.5 11.6z" />
      </svg>
    );
  }
  if (kind === "bolt") {
    return (
      <svg aria-hidden width={11} height={11} viewBox="0 0 24 24" fill={color}>
        <title>bolt</title>
        <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
      </svg>
    );
  }
  return (
    <svg aria-hidden width={11} height={11} viewBox="0 0 24 24" fill={color}>
      <title>flame</title>
      <path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-1.6.7-2.8 1.6-3.7.2 1.7 1.2 2.7 2.6 2.7-1-3 1-4 .8-9z" />
    </svg>
  );
}

/** iOS-style status-bar right cluster: signal, wifi, battery. */
function StatusIcons() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <svg aria-hidden width={16} height={11} viewBox="0 0 18 12" fill="#fff">
        <title>signal</title>
        <rect x="0" y="8" width="3" height="4" rx="1" />
        <rect x="5" y="5" width="3" height="7" rx="1" />
        <rect x="10" y="2.5" width="3" height="9.5" rx="1" />
        <rect x="15" y="0" width="3" height="12" rx="1" opacity="0.4" />
      </svg>
      <svg aria-hidden width={15} height={11} viewBox="0 0 16 12" fill="#fff">
        <title>wifi</title>
        <path d="M8 2.2c2.7 0 5.2 1 7 2.8l-1.5 1.6A7.8 7.8 0 0 0 8 4.4 7.8 7.8 0 0 0 2.5 6.6L1 5C2.8 3.2 5.3 2.2 8 2.2Z" />
        <path d="M8 6c1.5 0 2.9.6 4 1.6l-1.6 1.6A3.4 3.4 0 0 0 8 8.2c-.9 0-1.7.4-2.4 1L4 7.6A5.7 5.7 0 0 1 8 6Z" />
        <circle cx="8" cy="10.4" r="1.4" />
      </svg>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <div
          style={{
            width: 20,
            height: 10,
            borderRadius: 3,
            border: "1px solid rgba(255,255,255,0.5)",
            padding: 1.5,
          }}
        >
          <div
            style={{
              width: "42%",
              height: "100%",
              borderRadius: 1,
              background: "#fff",
            }}
          />
        </div>
        <div
          style={{
            width: 1.5,
            height: 4,
            borderRadius: 1,
            background: "rgba(255,255,255,0.5)",
          }}
        />
      </div>
    </div>
  );
}

/** One stat column in the header. */
function Stat({
  value,
  unit,
  label,
  accent,
}: {
  value: string;
  unit: string;
  label: string;
  accent?: boolean;
}) {
  const color = accent ? "#F0842E" : "#FFFFFF";
  const dim = accent ? "rgba(240,132,46,0.85)" : "rgba(255,255,255,0.42)";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            color,
            letterSpacing: "-0.02em",
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 8, fontWeight: 600, color: dim }}>{unit}</span>
      </div>
      <span
        style={{
          fontSize: 7,
          fontWeight: 700,
          letterSpacing: "0.06em",
          color: dim,
        }}
      >
        {label}
      </span>
    </div>
  );
}

export interface ShowcasePose {
  /** Device orientation (deg), applied inside the perspective. */
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  /** Camera zoom + pan (screen px), applied outside the perspective. */
  zoom: number;
  x: number;
  y: number;
}

/**
 * Keyframes of the `showcase` crane move, on normalized progress 0..1:
 * hold low at the bottom-left of the laid-back device → sweep up the screen
 * while zooming in → linger near the top → pull back to a straight frontal
 * view. Ends exactly at the identity pose, so a float loop can take over.
 */
const SHOWCASE_STOPS = [0, 0.1, 0.42, 0.62, 0.9, 1];
const SHOWCASE_KEYS: Record<keyof ShowcasePose, number[]> = {
  rotateX: [52, 36, 26, 12, 1.5, 0],
  rotateY: [28, 20, 10, 6, 1, 0],
  rotateZ: [30, 14, 2, 0, 0, 0],
  zoom: [2.6, 1.35, 2.75, 2.3, 1.04, 1],
  x: [60, 30, 0, -10, 0, 0],
  y: [-195, -40, 430, 380, 15, 0],
};

/**
 * Cinematic "showcase" pose at `frame`, normalized to the composition length
 * so the move always completes regardless of duration. Each keyframe is a
 * natural rest point, so per-segment ease-in-out reads as one continuous move.
 */
export function showcasePose(
  frame: number,
  durationInFrames: number,
): ShowcasePose {
  const p = Math.max(0, Math.min(1, frame / Math.max(1, durationInFrames - 1)));
  const easing = Easing.inOut(Easing.cubic);
  const at = (values: number[]) =>
    interpolate(p, SHOWCASE_STOPS, values, { easing });
  return {
    rotateX: at(SHOWCASE_KEYS.rotateX),
    rotateY: at(SHOWCASE_KEYS.rotateY),
    rotateZ: at(SHOWCASE_KEYS.rotateZ),
    zoom: at(SHOWCASE_KEYS.zoom),
    x: at(SHOWCASE_KEYS.x),
    y: at(SHOWCASE_KEYS.y),
  };
}

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Default screen: a glowing ride-summary map that draws itself with insight pills. */
function RideSummaryDemo({ frame, face }: { frame: number; face: string }) {
  const ease = Easing.bezier(0.2, 0.6, 0.35, 1);
  const draw = interpolate(frame, [12, 128], [0, 1], {
    ...CLAMP,
    easing: ease,
  });
  const fillIn = interpolate(frame, [70, 150], [0, 1], CLAMP);
  const head = pointAtFraction(draw);
  const hint = interpolate(frame, [0, 8, 70, 88], [0, 1, 1, 0], CLAMP);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        backgroundColor: "#0A0A0B",
        fontFamily: face,
        textRendering: "geometricPrecision",
        color: "#fff",
      }}
    >
      {/* Ambient terrain bleed under the route */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: fillIn,
          background:
            "radial-gradient(120% 55% at 54% 90%, rgba(214,124,54,0.32), transparent 60%), radial-gradient(70% 40% at 46% 62%, rgba(104,158,92,0.24), transparent 62%)",
        }}
      />

      {/* Route + glow + draw head */}
      <svg
        width={SCREEN_W}
        height={SCREEN_H}
        viewBox={`0 0 ${SCREEN_W} ${SCREEN_H}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <title>ride route</title>
        <defs>
          <linearGradient
            id="pf-elev"
            x1="0"
            y1="340"
            x2="0"
            y2="470"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#7FA85E" stopOpacity="0.32" />
            <stop offset="0.55" stopColor="#BE9150" stopOpacity="0.28" />
            <stop offset="1" stopColor="#DE8138" stopOpacity="0.42" />
          </linearGradient>
          <filter id="pf-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4.5" />
          </filter>
        </defs>

        <path d={ROUTE_PATH} fill="url(#pf-elev)" opacity={fillIn} />

        {/* connectors from pills down to the route */}
        {PILLS.map((p) => (
          <line
            key={`c-${p.title}`}
            x1={p.anchor[0]}
            y1={p.anchor[1]}
            x2={p.x + 22}
            y2={p.y + 30}
            stroke="rgba(255,255,255,0.28)"
            strokeWidth={1}
            opacity={interpolate(
              frame,
              [p.appear, p.appear + 10],
              [0, 1],
              CLAMP,
            )}
          />
        ))}

        {/* glow underlay + crisp stroke, both revealed by the draw */}
        <path
          d={ROUTE_PATH}
          fill="none"
          stroke="#FFEBD6"
          strokeWidth={7}
          strokeLinecap="round"
          opacity={0.55}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - draw}
          filter="url(#pf-glow)"
        />
        <path
          d={ROUTE_PATH}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={2.4}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - draw}
        />

        {/* anchor dots where pills attach */}
        {PILLS.map((p) => (
          <circle
            key={`a-${p.title}`}
            cx={p.anchor[0]}
            cy={p.anchor[1]}
            r={2.4}
            fill="#EE8348"
            opacity={interpolate(
              frame,
              [p.appear, p.appear + 8],
              [0, 0.95],
              CLAMP,
            )}
          />
        ))}

        {/* draw head */}
        {draw > 0 && (
          <>
            <circle
              cx={head.x}
              cy={head.y}
              r={7}
              fill="#FFFFFF"
              filter="url(#pf-glow)"
            />
            <circle cx={head.x} cy={head.y} r={3.4} fill="#FFFFFF" />
          </>
        )}
      </svg>

      {/* Insight pills */}
      {PILLS.map((p) => {
        const t = interpolate(frame, [p.appear, p.appear + 12], [0, 1], {
          ...CLAMP,
          easing: ease,
        });
        return (
          <div
            key={p.title}
            style={{
              position: "absolute",
              left: p.x,
              top: p.y,
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 9px 4px 4px",
              borderRadius: 999,
              background: "rgba(26,24,23,0.82)",
              border: "1px solid rgba(255,255,255,0.07)",
              opacity: t,
              transform: `translateY(${(1 - t) * 6}px)`,
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PillIcon kind={p.icon} color={p.tint} />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                lineHeight: 1.15,
              }}
            >
              <span
                style={{
                  fontSize: 8.5,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  color: "#F4F1EC",
                }}
              >
                {p.title}
              </span>
              <span style={{ fontSize: 8, color: "rgba(232,227,220,0.6)" }}>
                {p.sub}
              </span>
            </div>
          </div>
        );
      })}

      {/* Status bar (split around the dynamic island) */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 18,
          right: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>9:41</span>
          <svg
            aria-hidden
            width={12}
            height={12}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <title>alerts off</title>
            <path d="M6 8a6 6 0 0 1 9-5" />
            <path d="M18 8v5l2 3H8" />
            <path d="M10.5 19a2 2 0 0 0 3 0" />
            <path d="M3 3l18 18" />
          </svg>
        </div>
        <StatusIcons />
      </div>

      {/* Nav row */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 18,
          right: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
          System voice
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>
          Save
        </span>
      </div>

      {/* Athlete selector */}
      <div
        style={{
          position: "absolute",
          top: 60,
          right: 16,
          display: "flex",
          alignItems: "center",
          gap: 3,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        Eddy
        <svg
          aria-hidden
          width={9}
          height={9}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <title>expand</title>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {/* Stats row + reset */}
      <div
        style={{
          position: "absolute",
          top: 86,
          left: 18,
          right: 16,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 14 }}>
          <Stat value="16.5" unit="mph" label="AVG" />
          <Stat value="147" unit="bpm" label="AVG HR •" accent />
          <Stat value="26.0" unit="mph" label="MAX" />
          <Stat value="606" unit="ft" label="ASCENT" />
        </div>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 999,
            background: "rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg
            aria-hidden
            width={13}
            height={13}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>reset</title>
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </div>
      </div>

      {/* Scrub hint */}
      <div
        style={{
          position: "absolute",
          bottom: 54,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 9,
          color: "rgba(255,255,255,0.34)",
          opacity: hint,
        }}
      >
        Scrub along the bottom · Drag to explore
      </div>
    </div>
  );
}

const isVideo = (src: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(src);

/**
 * A root-relative asset (`/showcase-mobile-videos/x.mp4`) is served at the
 * origin root by Next in the Player, but a server render serves `public/`
 * through `staticFile()` — so rewrite local paths only while rendering, and
 * pass http(s)/data/blob URLs straight through.
 */
function resolveSrc(src: string): string {
  const isLocal = src.startsWith("/") && !src.startsWith("//");
  if (isLocal && getRemotionEnvironment().isRendering) {
    return staticFile(src.replace(/^\/+/, ""));
  }
  return src;
}

/** Fills the screen with an image or a video, fading and un-blurring it in. */
function ScreenMedia({ src, frame }: { src: string; frame: number }) {
  const t = interpolate(frame, [4, 22], [0, 1], CLAMP);
  const style: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    // Tailwind's preflight sets `img { max-width: 100% }`, which can collapse a
    // media element we size ourselves to 0px wide. Opt out. (motion-quality skill.)
    maxWidth: "none",
    objectFit: "cover",
    opacity: t,
    filter: `blur(${(1 - t) * 8}px)`,
  };
  const resolved = resolveSrc(src);
  return isVideo(src) ? (
    <OffthreadVideo src={resolved} muted style={style} />
  ) : (
    <Img src={resolved} style={style} />
  );
}

export function PhoneFrame({
  children,
  screenSrc,
  variant = "flat",
  entrance = "rise",
  bezelColor,
  screenColor,
  theme,
  mode,
  fontFamily,
  radius,
  screenRadius,
  shadow,
  scale = 1,
  showDynamicIsland = true,
  floatLoop = true,
  floatAmplitude = 6,
  tiltAngle = -12,
  speed = 1,
  className,
}: PhoneFrameProps) {
  const frame = useCurrentFrame() * speed;
  const { fps, durationInFrames } = useVideoConfig();
  // The screen carries the app, so it follows the app theme. The body and the
  // Dynamic Island are a physical object: they take the dark end of the system
  // whatever mode the screen is in.
  const t = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily ?? t.fontFamily) ?? FONT_FAMILY;
  const island = useSnapCnTheme(theme, "dark");
  const body = bezelColor ?? t.foreground;
  const glass = screenColor ?? t.card;
  const drop = shadow ?? `0 24px 60px ${withAlpha(t.foreground, 0.18)}`;

  const bodyRadius = radius ?? deviceRadius(DEVICE_WIDTH);
  const innerRadius = screenRadius ?? screenRadiusFor(bodyRadius);

  const pose = entrancePose(frame, entrance);
  const floatStart = entrance === "float" ? 0 : ENTRANCE_FRAMES;
  const bob = floatLoop
    ? floatOffset(frame, fps, floatAmplitude, floatStart)
    : 0;

  const crane =
    variant === "showcase" ? showcasePose(frame, durationInFrames) : null;

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: face,
      }}
    >
      {/* Entrance + float rig */}
      <div
        style={{
          opacity: pose.opacity,
          translate: `0px ${pose.translateY + bob}px`,
          rotate: `${pose.rotateDeg}deg`,
          scale: `${pose.scale * scale}`,
        }}
      >
        {/* Camera: pan + zoom in screen space, outside the perspective (showcase only) */}
        <div
          style={{
            transform: crane
              ? `translate(${crane.x}px, ${crane.y}px) scale(${crane.zoom})`
              : undefined,
          }}
        >
          {/* Device orientation: crane pose (showcase), static rotateY (tilt), or flat */}
          <div
            style={{
              transform: `perspective(1400px) rotateX(${
                crane ? crane.rotateX : 0
              }deg) rotateY(${
                crane ? crane.rotateY : variant === "tilt" ? tiltAngle : 0
              }deg) rotateZ(${crane ? crane.rotateZ : 0}deg)`,
            }}
          >
            {/* Device body */}
            <div
              style={{
                position: "relative",
                width: DEVICE_WIDTH,
                height: DEVICE_HEIGHT,
                borderRadius: bodyRadius,
                backgroundColor: body,
                padding: BEZEL_WIDTH,
                ...(shadow === "" ? {} : { boxShadow: drop }),
              }}
            >
              {/* Side buttons */}
              {SIDE_BUTTONS.map((button) => (
                <div
                  key={`${button.side}-${button.top}`}
                  style={{
                    position: "absolute",
                    top: button.top,
                    [button.side]: -3,
                    width: 3,
                    height: button.length,
                    borderRadius: 2,
                    backgroundColor: body,
                  }}
                />
              ))}

              {/* Screen */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  borderRadius: innerRadius,
                  backgroundColor: glass,
                  overflow: "hidden",
                }}
              >
                {children ??
                  (screenSrc ? (
                    <ScreenMedia src={screenSrc} frame={frame} />
                  ) : (
                    <RideSummaryDemo frame={frame} face={face} />
                  ))}

                {/* Dynamic island */}
                {showDynamicIsland && (
                  <div
                    style={{
                      position: "absolute",
                      top: 10,
                      left: "50%",
                      translate: "-50% 0px",
                      width: 90,
                      height: 26,
                      borderRadius: 999,
                      backgroundColor: island.background,
                      zIndex: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-end",
                      paddingRight: 9,
                    }}
                  >
                    {/* Camera lens */}
                    <div
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 999,
                        backgroundColor: island.card,
                        border: `1px solid ${island.border}`,
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
