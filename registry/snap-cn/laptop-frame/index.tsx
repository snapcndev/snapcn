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
  mixOklch,
  type SnapCnTheme,
  useSnapCnTheme,
  withAlpha,
} from "@/lib/snap-cn-ui";

export type LaptopFrameEntrance = "rise" | "open" | "none";
export type LaptopFrameFinale = "none" | "zoom-to-screen";
export type NotchPhase = "idle" | "loading" | "done";

export interface LaptopFrameProps {
  /** Screen content. Falls back to `screenSrc`, then a built-in hero placeholder. */
  children?: ReactNode;
  /**
   * Image *or* video to fill the screen when `children` is omitted. Videos
   * (.mp4/.webm/.mov/.m4v) play via `<OffthreadVideo>`, images via `<Img>` —
   * both cover the screen and fade/un-blur in. A root-relative path
   * (`/showcase-videos/x.mp4`) is served by Next in the Player and rewritten
   * through `staticFile()` in a render.
   */
  screenSrc?: string;
  /** How the laptop enters. `open` lifts the lid up from the deck. */
  entrance?: LaptopFrameEntrance;
  /**
   * How the shot ends. `zoom-to-screen` dollies the camera into the screen and
   * un-tilts it until the content fills the frame — a product "screen takeover".
   * Assumes the frame is the whole composition (the cover scale is derived from
   * `useVideoConfig`).
   */
  finale?: LaptopFrameFinale;
  /** Lid shell + deck base color. Space-grey by default. */
  /** Lid colour. Defaults to a dark neutral from the design system. */
  bezelColor?: string;
  /** Screen fill behind the content. */
  /** Screen fill behind `children`. Defaults to the theme's `card`. */
  screenColor?: string;
  /** Design-system token overrides — applied to the screen's contents. */
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
  /** Notch status indicator. The macOS system green is the look, not a token. */
  indicatorColor?: string;
  /** rotateX of the lid at rest, in degrees (positive tips the top back). */
  restTilt?: number;
  /** Lid top-corner radius. The bottom corners stay near-square (the hinge). */
  radius?: number;
  /** CSS box-shadow under the deck. Empty string disables it. */
  shadow?: string;
  /** Uniform size multiplier for the whole machine. */
  scale?: number;
  /** Render the notch notification pill. */
  showNotch?: boolean;
  /** Text shown in the notch's connected state. */
  notchLabel?: string;
  /** Battery fill (0–100) drawn green in the connected state. */
  batteryLevel?: number;
  /** Gentle vertical bob after the entrance settles. */
  floatLoop?: boolean;
  /** Peak float displacement in pixels. */
  floatAmplitude?: number;
  speed?: number;
  className?: string;
}

const FONT_FAMILY =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

/** Lid (screen panel) size — a 16:10 MacBook-style display. */
export const LID_WIDTH = 820;
export const LID_HEIGHT = 500;

/** Dark shell thickness between the lid edge and the screen. */
export const BEZEL_WIDTH = 14;

/** Deck (base) is a touch wider than the lid — the trapezoid under the hinge. */
export const DECK_WIDTH = 900;
export const DECK_HEIGHT = 22;

/** Lid top-corner radius; bottom corners are near-square where the hinge is. */
export const LID_RADIUS = 22;

/** rotateX of the lid at rest, and the perspective it is rendered through. */
export const REST_TILT = 18;
export const PERSPECTIVE = 1600;

/** Frames the entrance takes before the machine is fully settled. */
export const ENTRANCE_FRAMES = 30;

/** Camera "screen takeover" push: dolly + un-tilt from here to here. */
export const PUSH_START = 140;
export const PUSH_END = 185;

/**
 * The camera-move easing. A *moderate* decelerate — not quint/expo-out, which
 * cover their travel in the first third and then spend frames moving < 0.5px,
 * i.e. freeze on a frame clock. See the motion-quality skill.
 */
export const CAMERA_EASE = Easing.bezier(0.2, 0.6, 0.35, 1);

/**
 * Camera-box height: the lid + deck stack, which is what the outer wrapper
 * shrink-wraps and scales around. Used to find how far the screen centre sits
 * above the box centre so the zoom can recentre it in the frame.
 */
export const COLUMN_HEIGHT = LID_HEIGHT + DECK_HEIGHT;

/** Seconds per full float-loop cycle. */
export const FLOAT_PERIOD_SECONDS = 5;

/** Notch pill height, and its width in each of the three states. */
export const NOTCH_HEIGHT = 30;
export const NOTCH_IDLE_WIDTH = 116;
export const NOTCH_LOADING_WIDTH = 150;
export const NOTCH_DONE_WIDTH = 320;

/** Default frame at which each notch state begins (before `speed`). */
export const NOTCH_TIMING = {
  loadingStart: 72,
  doneStart: 120,
} as const;

export interface EntrancePose {
  opacity: number;
  translateY: number;
  scale: number;
}

/**
 * Pure entrance schedule for the whole machine. Every entrance settles to the
 * identity pose by `ENTRANCE_FRAMES`, so the float loop takes over with no seam.
 * The lid-open rotation is a separate track — see `lidTilt`.
 */
export function entrancePose(
  frame: number,
  entrance: LaptopFrameEntrance,
): EntrancePose {
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;
  const easeOut = Easing.out(Easing.cubic);

  if (entrance === "none") {
    return { opacity: 1, translateY: 0, scale: 1 };
  }

  if (entrance === "open") {
    // The travel is small — the drama is in the lid lifting (lidTilt).
    return {
      opacity: interpolate(frame, [0, 10], [0, 1], clamp),
      translateY: interpolate(frame, [0, 24], [24, 0], {
        ...clamp,
        easing: easeOut,
      }),
      scale: 1,
    };
  }

  // rise (default)
  return {
    opacity: interpolate(frame, [0, 12], [0, 1], clamp),
    translateY: interpolate(frame, [0, 26], [70, 0], {
      ...clamp,
      easing: easeOut,
    }),
    scale: 1,
  };
}

/**
 * rotateX of the lid (degrees). `open` swings it from closed-ish to rest, hinged
 * at the deck (the lid's transform-origin is its bottom edge). `zoom-to-screen`
 * then flattens it back to 0 during the push, so the takeover ends on a flat,
 * head-on screen rather than a foreshortened one.
 */
export function lidTilt(
  frame: number,
  entrance: LaptopFrameEntrance,
  finale: LaptopFrameFinale = "none",
  restTilt: number = REST_TILT,
): number {
  const opened =
    entrance === "open"
      ? interpolate(frame, [0, ENTRANCE_FRAMES], [82, restTilt], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        })
      : restTilt;

  if (finale !== "zoom-to-screen" || frame < PUSH_START) return opened;

  return interpolate(frame, [PUSH_START, PUSH_END], [restTilt, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: CAMERA_EASE,
  });
}

export interface CameraPose {
  scale: number;
  translateY: number;
}

/**
 * The "screen takeover" camera. `zoom-to-screen` dollies in (scale) and slides
 * up (translateY) so the screen's inner rect grows to *cover* the composition
 * and stays centred as it does. The scale is derived from the composition size,
 * so the content lands exactly filling the frame — verified by rendering frames,
 * not eyeballed (motion-quality Rule 0).
 */
export function cameraPose(
  frame: number,
  finale: LaptopFrameFinale,
  baseScale: number,
  compWidth: number,
  compHeight: number,
): CameraPose {
  if (finale !== "zoom-to-screen") return { scale: 1, translateY: 0 };

  const p = interpolate(frame, [PUSH_START, PUSH_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: CAMERA_EASE,
  });

  // Screen inner, at the resting base scale, must cover the whole frame.
  const innerW = (LID_WIDTH - 2 * BEZEL_WIDTH) * baseScale;
  const innerH = (LID_HEIGHT - 2 * BEZEL_WIDTH) * baseScale;
  const cover = Math.max(compWidth / innerW, compHeight / innerH);
  const scale = 1 + (cover - 1) * p;

  // The screen centre sits `d` px above the camera-box centre (the deck pulls the
  // box centre down). Countering `d * cover` as we scale keeps it centred: the
  // screen centre tracks from (centre − d) to (centre) exactly.
  const d = (COLUMN_HEIGHT / 2 - LID_HEIGHT / 2) * baseScale;
  const translateY = d * cover * p;

  return { scale, translateY };
}

/**
 * Deterministic float-loop offset in pixels. Starts at 0 with an upward drift
 * at `startFrame`, so it blends seamlessly out of the entrance. (Same math as
 * the phone-frame float — kept inline so the copied component has no deps.)
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

export interface NotchState {
  phase: NotchPhase;
  /** Pill width in pixels, morphing between the three states. */
  width: number;
  /** Cross-fade weights for the three content layers. */
  idle: number;
  loading: number;
  done: number;
}

/**
 * Pure notch schedule: which state is showing, the morphing pill width, and the
 * cross-fade weights of the three content layers. The pill holds its loading
 * width, then expands to fit the connected label — the dynamic-island morph.
 */
export function notchState(
  frame: number,
  timing: { loadingStart: number; doneStart: number } = NOTCH_TIMING,
): NotchState {
  const { loadingStart, doneStart } = timing;
  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;

  const phase: NotchPhase =
    frame < loadingStart ? "idle" : frame < doneStart ? "loading" : "done";

  const width = interpolate(
    frame,
    [loadingStart - 8, loadingStart, doneStart - 4, doneStart + 12],
    [
      NOTCH_IDLE_WIDTH,
      NOTCH_LOADING_WIDTH,
      NOTCH_LOADING_WIDTH,
      NOTCH_DONE_WIDTH,
    ],
    { ...clamp, easing: Easing.inOut(Easing.cubic) },
  );

  const idle = interpolate(
    frame,
    [loadingStart - 6, loadingStart],
    [1, 0],
    clamp,
  );
  const loading = interpolate(
    frame,
    [loadingStart - 6, loadingStart, doneStart - 6, doneStart],
    [0, 1, 1, 0],
    clamp,
  );
  const done = interpolate(
    frame,
    [doneStart - 4, doneStart + 6],
    [0, 1],
    clamp,
  );

  return { phase, width, idle, loading, done };
}

/**
 * Built-in placeholder: a full-bleed product hero. Full-bleed on purpose — the
 * `zoom-to-screen` finale dives into the screen, so the content has to reward
 * filling the frame, not sit as a small card on empty canvas. Elements stagger
 * in during the open, then hold. Pass `imageSrc`/`children` to use your own.
 */
function PlaceholderScreen({ frame, t }: { frame: number; t: SnapCnTheme }) {
  const rise = (delay: number) => {
    const r = interpolate(frame, [delay, delay + 14], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    return { opacity: r, transform: `translateY(${(1 - r) * 14}px)` };
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `linear-gradient(165deg, ${t.card} 0%, ${mixOklch(
          t.card,
          t.primary,
          0.06,
        )} 100%)`,
        color: t.foreground,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* App bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "22px 34px",
          ...rise(6),
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 7,
              background: `linear-gradient(135deg, ${t.primary}, ${mixOklch(
                t.primary,
                t.foreground,
                0.18,
              )})`,
            }}
          />
          <span
            style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}
          >
            Acme
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {["Product", "Pricing", "Docs"].map((l) => (
            <span key={l} style={{ fontSize: 13.5, color: t.mutedForeground }}>
              {l}
            </span>
          ))}
          <div
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              backgroundColor: t.foreground,
              color: t.background,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Sign in
          </div>
        </div>
      </div>

      {/* Hero */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 40px",
          gap: 18,
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "5px 12px",
            borderRadius: 999,
            border: `1px solid ${t.border}`,
            backgroundColor: t.card,
            fontSize: 12.5,
            fontWeight: 600,
            color: t.primary,
            ...rise(12),
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              backgroundColor: t.primary,
            }}
          />
          Now in public beta
        </div>
        <div
          style={{
            fontSize: 46,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            maxWidth: 560,
            ...rise(16),
          }}
        >
          Ship demos that sell.
        </div>
        <div
          style={{
            fontSize: 16.5,
            lineHeight: 1.5,
            color: t.mutedForeground,
            maxWidth: 440,
            ...rise(20),
          }}
        >
          Turn your product into a polished launch video in minutes — no editor,
          no render farm.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 6, ...rise(24) }}>
          <div
            style={{
              padding: "11px 20px",
              borderRadius: 10,
              background: `linear-gradient(135deg, ${t.primary}, ${mixOklch(
                t.primary,
                t.foreground,
                0.18,
              )})`,
              color: t.primaryForeground,
              fontSize: 14.5,
              fontWeight: 600,
              boxShadow: `0 10px 24px ${withAlpha(t.primary, 0.32)}`,
            }}
          >
            Get started
          </div>
          <div
            style={{
              padding: "11px 20px",
              borderRadius: 10,
              border: `1px solid ${t.border}`,
              backgroundColor: t.card,
              fontSize: 14.5,
              fontWeight: 600,
            }}
          >
            Watch demo
          </div>
        </div>
      </div>
    </div>
  );
}

const isVideo = (src: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(src);

/**
 * A root-relative asset (`/showcase-videos/x.mp4`) is served at the origin root
 * by Next in the Player, but a server render serves `public/` through
 * `staticFile()` — so rewrite local paths only while rendering, and pass
 * http(s)/data/blob URLs straight through.
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
  const t = interpolate(frame, [4, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
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

function Dot({
  size,
  color,
  style,
}: {
  size: number;
  color: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        backgroundColor: color,
        ...style,
      }}
    />
  );
}

/** The notch pill notification, morphing idle → loading → connected. */
function Notch({
  frame,
  label,
  batteryLevel,
  t,
  indicatorColor,
}: {
  frame: number;
  label: string;
  batteryLevel: number;
  /** Resolved in dark mode — the notch is a dark pill whatever the app theme. */
  t: SnapCnTheme;
  indicatorColor: string;
}) {
  const state = notchState(frame);
  const layer: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div
      style={{
        position: "absolute",
        top: 9,
        left: "50%",
        translate: "-50% 0px",
        width: state.width,
        height: NOTCH_HEIGHT,
        borderRadius: 999,
        backgroundColor: t.background,
        overflow: "hidden",
        zIndex: 10,
      }}
    >
      {/* idle — camera dot + sensor dot */}
      <div style={{ ...layer, gap: 6, opacity: state.idle }}>
        <Dot
          size={9}
          color={mixOklch(t.background, t.foreground, 0.12)}
          style={{
            border: `1px solid ${mixOklch(t.background, t.foreground, 0.2)}`,
          }}
        />
        <Dot size={5} color={mixOklch(t.background, t.foreground, 0.06)} />
      </div>

      {/* loading — three pulsing dots */}
      <div style={{ ...layer, gap: 4, opacity: state.loading }}>
        {[0, 1, 2].map((i) => (
          <Dot
            key={i}
            size={5}
            color={t.foreground}
            style={{
              opacity: 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(frame / 4 - i * 0.9)),
            }}
          />
        ))}
      </div>

      {/* done — label + battery */}
      <div style={{ ...layer, gap: 8, opacity: state.done }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            color: t.foreground,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        <div
          style={{
            width: 22,
            height: 11,
            borderRadius: 3,
            border: `1.5px solid ${indicatorColor}`,
            padding: 1.5,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: `${Math.max(0, Math.min(100, batteryLevel))}%`,
              height: "100%",
              borderRadius: 1,
              backgroundColor: indicatorColor,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function LaptopFrame({
  children,
  screenSrc,
  entrance = "rise",
  finale = "none",
  bezelColor,
  screenColor,
  theme,
  mode,
  indicatorColor = "#30D158",
  restTilt = REST_TILT,
  radius = LID_RADIUS,
  shadow,
  scale = 0.95,
  showNotch = true,
  notchLabel = "AirPods Connected",
  batteryLevel = 85,
  floatLoop = true,
  floatAmplitude = 4,
  speed = 1,
  className,
}: LaptopFrameProps) {
  const frame = useCurrentFrame() * speed;
  // The screen shows an app, so it follows the app theme. The lid, the notch
  // and the drop shadow are a physical object photographed on a desk: they take
  // the dark end of the system whatever mode the screen is in.
  const t = useSnapCnTheme(theme, mode);
  const shell = useSnapCnTheme(theme, "dark");
  const lid = bezelColor ?? mixOklch(shell.background, shell.foreground, 0.09);
  const glass = screenColor ?? t.card;
  const drop = shadow ?? `0 40px 80px ${withAlpha(shell.background, 0.45)}`;
  const { fps, width, height } = useVideoConfig();
  const isRendering = getRemotionEnvironment().isRendering;

  const pose = entrancePose(frame, entrance);
  const tilt = lidTilt(frame, entrance, finale, restTilt);
  const camera = cameraPose(frame, finale, scale, width, height);
  // The float loop would fight the camera push, so it stops when the dive starts.
  const bob =
    floatLoop && !(finale === "zoom-to-screen" && frame >= PUSH_START)
      ? floatOffset(frame, fps, floatAmplitude, ENTRANCE_FRAMES)
      : 0;
  // The notch is at the top of the screen; fade it out as we dive past it.
  const notchFade =
    finale === "zoom-to-screen"
      ? interpolate(frame, [PUSH_START, PUSH_START + 10], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  const screenContent =
    children ??
    (screenSrc ? (
      <ScreenMedia src={screenSrc} frame={frame} />
    ) : (
      <PlaceholderScreen frame={frame} t={t} />
    ));

  return (
    <div
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_FAMILY,
      }}
    >
      {/* Camera: the screen-takeover dolly. `geometricPrecision` keeps any scaled
          text from boiling; will-change helps the live Player but is wrong in a
          render (it rasterises type across parallel tabs) — motion-quality skill. */}
      <div
        style={{
          transform: `translateY(${camera.translateY}px) scale(${camera.scale})`,
          transformOrigin: "center center",
          textRendering: "geometricPrecision",
          ...(isRendering ? {} : { willChange: "transform" as const }),
        }}
      >
        {/* Entrance + float rig */}
        <div
          style={{
            opacity: pose.opacity,
            translate: `0px ${pose.translateY + bob}px`,
            scale: `${pose.scale * scale}`,
          }}
        >
          {/* Perspective stage: the lid tilts inside it, the deck stays flat */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              perspective: PERSPECTIVE,
            }}
          >
            {/* Lid — hinged at its bottom edge */}
            <div
              style={{
                width: LID_WIDTH,
                height: LID_HEIGHT,
                borderRadius: `${radius}px ${radius}px 6px 6px`,
                backgroundColor: lid,
                padding: BEZEL_WIDTH,
                transformOrigin: "center bottom",
                transform: `rotateX(${tilt}deg)`,
              }}
            >
              {/* Screen */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  borderRadius: `${Math.max(4, radius - BEZEL_WIDTH)}px ${Math.max(
                    4,
                    radius - BEZEL_WIDTH,
                  )}px 4px 4px`,
                  backgroundColor: glass,
                  overflow: "hidden",
                }}
              >
                {screenContent}
                {showNotch && notchFade > 0 && (
                  <div style={{ opacity: notchFade }}>
                    <Notch
                      t={shell}
                      indicatorColor={indicatorColor}
                      frame={frame}
                      label={notchLabel}
                      batteryLevel={batteryLevel}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Deck — wider than the lid, with the lift-lip on top */}
            <div
              style={{
                position: "relative",
                width: DECK_WIDTH,
                height: DECK_HEIGHT,
                borderRadius: "6px 6px 40px 40px",
                background: `linear-gradient(to bottom, ${withAlpha(
                  shell.foreground,
                  0.16,
                )}, ${withAlpha(shell.background, 0)} 34%, ${withAlpha(
                  shell.background,
                  0.34,
                )}), ${lid}`,
                ...(shadow === "" ? {} : { boxShadow: drop }),
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  translate: "-50% 0px",
                  width: 132,
                  height: 8,
                  borderRadius: "0 0 6px 6px",
                  backgroundColor: withAlpha(shell.background, 0.28),
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
