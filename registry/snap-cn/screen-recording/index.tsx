"use client";

import type { CSSProperties } from "react";
import {
  AbsoluteFill,
  Easing,
  getRemotionEnvironment,
  Img,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { type SnapCnTheme, useSnapCnTheme } from "@/lib/snap-cn-ui";

export type ScreenRecordingFit = "cover" | "contain";
export type ScreenRecordingEntrance = "fade" | "none";

/**
 * Chrome to cut off the source, one fraction per edge — `{ top: 0.11 }` drops
 * the top 11% of the recording, which is about what a browser's tab strip and
 * address bar come to. Fractions of the source, never pixels: the component
 * then never has to know the file's intrinsic size, and the same numbers
 * survive a re-record at a different resolution. Measure once on a still and
 * divide — `chromePixels / recordingHeight`. All four default to 0.
 */
export interface ScreenCrop {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

/**
 * One camera keyframe.
 *
 * A move eases from wherever the camera actually is at `at` to the pose named
 * here, over `duration` frames, and then HOLDS that pose until the next move's
 * `at`. There is no `hold` field — the hold is the gap between two moves.
 *
 * "At frame 40, over 25 frames, push to 2.2x centred on (0.62, 0.31), hold
 * until frame 90, then pull back" is two lines:
 *
 * ```tsx
 * camera={[
 *   { at: 40, duration: 25, zoom: 2.2, x: 0.62, y: 0.31 },
 *   { at: 90, duration: 25, zoom: 1 },
 * ]}
 * ```
 */
export interface CameraMove {
  /**
   * Frame this move starts, absolute on the component's own clock — i.e.
   * compared against `useCurrentFrame() * speed`, not against the previous
   * move. Moves are sorted by `at`; ties break on array order and the last one
   * wins, the same rule `useStateTransition` uses for `Step`.
   */
  at: number;
  /**
   * Frames the move takes. Default 25 — a push worth about 0.8s at 30fps.
   * A move whose `at + duration` runs past the next move's `at` is TRUNCATED,
   * never blended: the next move takes over from the pose actually on screen at
   * that frame, so the camera stays continuous but never averages two targets.
   */
  duration?: number;
  /**
   * Zoom this move lands on, ABSOLUTE — `1` is the fitted shot and `2.2` is
   * 2.2x that. Never a multiplier on the previous move. Omit it and the move
   * carries the previous zoom, which is what makes a pure pan one line.
   */
  zoom?: number;
  /**
   * Focal point the zoom centres on, normalized: 0 -> 1 left to right across
   * the composition, origin top-left, measured on the shot as it sits at zoom
   * 1. Omit it to carry the previous move's `x`. Defaults to 0.5 before the
   * first move.
   */
  x?: number;
  /**
   * Focal point, normalized: 0 -> 1 top to bottom across the composition. Same
   * space as `x`. Omit it to carry the previous move's `y`.
   */
  y?: number;
}

export interface ScreenRecordingProps {
  /**
   * The recording. A video (.mp4/.webm/.mov/.m4v) plays through
   * `<OffthreadVideo>` and anything else renders as an `<Img>`, so a single
   * screenshot takes exactly the same camera track. A root-relative path
   * (`/recordings/checkout.mp4`) is served by Next in the Player and rewritten
   * through `staticFile()` in a render; http(s)/data/blob URLs pass through.
   */
  src: string;
  /** Browser and OS chrome to cut away, as a fraction of each edge of the source. */
  crop?: ScreenCrop;
  /**
   * The four edges of `crop`, flat. `crop` is the API you write by hand; these
   * exist because the customizer's controls become props verbatim and
   * `ControlType` has no object control, so a crop slider has to land on a
   * number prop. Set here, an edge overrides the same edge of `crop`.
   */
  cropTop?: number;
  cropRight?: number;
  cropBottom?: number;
  cropLeft?: number;
  /**
   * Width divided by height of the source file, if you know it (1920x1080 ->
   * 1.778). Give it and `crop` is exact on the raw file. Omit it and the source
   * is aspect-filled to the composition first, so `crop` is measured on the
   * shot as it appears rather than on the file — the same thing whenever the
   * two aspect ratios already match, which is the usual case.
   *
   * ponytail: it is compared against the COMPOSITION's aspect, not the box this
   * component is mounted in. Everything else here is box-relative, so a
   * recording inset in a device frame is correct — but its `crop` fractions
   * carry the frame's aspect error (a laptop screen is 1.68, a 16:9 comp is
   * 1.78, so ~6%). Omit `sourceAspect` there, or pass the container's aspect
   * ratio's worth of it. Measuring the real box would need a ref and a state
   * update, which is exactly the non-determinism this component cannot have.
   */
  sourceAspect?: number;
  /**
   * `cover` (default) fills the frame with the cropped region and centre-crops
   * whichever axis is long — nothing is letterboxed and nothing is stretched,
   * and the cropped region therefore *is* the frame, which is what lets camera
   * coordinates and overlay coordinates be one space. `contain` fits the whole
   * cropped region inside the frame and pads the rest with `backdropColor`;
   * reach for it only when losing an edge is worse than bars.
   */
  fit?: ScreenRecordingFit;
  /** Padding behind a `contain` fit. Defaults to the theme's `background`. */
  backdropColor?: string;
  /**
   * The camera track, in `at` order. `DEMO_CAMERA` by default — a push and a
   * pull-back, so the component shows what it is for with nothing passed. Pass
   * `[]` for a locked-off shot at zoom 1; a treated recording with no camera is
   * still the point of this component.
   *
   * A focal point is clamped to whatever the current zoom can actually hold
   * (`clampFocus`), so a pull-back to zoom 1 recentres itself rather than
   * dragging a band of `backdropColor` into frame. See `CameraMove` for how
   * moves hold and how overlaps resolve.
   */
  camera?: CameraMove[];
  /**
   * Corner radius on the treated shot, in px. 0 (default) is edge-to-edge.
   * A value here reads as a floating window, which only makes sense when the
   * recording is inset inside something else.
   */
  radius?: number;
  /**
   * Frames to skip into the source video before frame 0 of the scene — the
   * `trimBefore` of `<OffthreadVideo>`. Cut the dead air at the head of a take
   * here instead of re-exporting the file. Ignored for images.
   */
  trimBefore?: number;
  /** Play the recording's audio. Default false — a demo carries its own bed. */
  audio?: boolean;
  /**
   * How the shot arrives. `fade` (default) is the same 18-frame
   * fade-and-unblur `laptop-frame` and `phone-frame` run on screen media, so a
   * recording dropped into either does not double up on two arrivals. `none`
   * is up on frame 0.
   */
  entrance?: ScreenRecordingEntrance;
  /** Design-system token overrides. */
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
  /**
   * Time multiplier. Every `at` in `camera` is measured against
   * `useCurrentFrame() * speed`. Layers do not inherit it — pass the same
   * `speed` to the overlays wrapping this one.
   */
  speed?: number;
  className?: string;
}

// --- Constants -------------------------------------------------------------

/**
 * The camera-move easing. A *moderate* decelerate — not quint/expo-out, which
 * cover their travel in the first third and then spend frames moving < 0.5px,
 * i.e. freeze on a frame clock. Same constant, same value, as `laptop-frame`'s
 * dolly, so a recording and a device frame move alike. See the motion-quality
 * skill.
 */
export const CAMERA_EASE = Easing.bezier(0.2, 0.6, 0.35, 1);

/** Frames a camera move takes when `duration` is omitted. */
export const CAMERA_MOVE_FRAMES = 25;

/** Hold past the last settle, so the shot reads as finished rather than cut. */
export const TAIL_FRAMES = 18;

/** Fade-and-unblur window for `entrance: "fade"`. */
export const ENTRANCE_FRAMES = 18;

/** The entrance starts a few frames in, exactly as `laptop-frame`'s does. */
const ENTRANCE_START = 4;

/** Peak blur of the entrance, in px — `laptop-frame`'s `ScreenMedia` value. */
const ENTRANCE_BLUR = 8;

/**
 * A push and a pull-back over the default recording. This is the component's
 * `camera` default rather than a config control: `ControlType` in
 * lib/customizer-config.ts has no array control, so the demo has to live on the
 * prop — the same way `terminal-simulator` carries `DEFAULT_LINES`.
 */
export const DEMO_CAMERA: CameraMove[] = [
  { at: 34, duration: 25, zoom: 1.6, x: 0.36, y: 0.42 },
  { at: 96, duration: 25, zoom: 1 },
];

// --- Pure helpers (unit-tested) -------------------------------------------

export interface CameraPose {
  /** 1 is the fitted shot. */
  zoom: number;
  /** Focal point, normalized to the frame, origin top-left. */
  x: number;
  y: number;
}

/** The pose before any move has run. */
export const RESTING_POSE: CameraPose = { zoom: 1, x: 0.5, y: 0.5 };

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/**
 * Eased progress through one move. A zero or negative `duration` is a cut — it
 * cannot go through `interpolate`, whose input range must be increasing.
 */
function moveProgress(frame: number, at: number, duration: number): number {
  if (duration <= 0) return 1;
  return interpolate(frame, [at, at + duration], [0, 1], {
    easing: CAMERA_EASE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/**
 * The camera pose at `frame`, folding the track forward so a move that starts
 * mid-flight takes over from the pose actually on screen. Pure: same frame,
 * same answer, whatever order Remotion renders in.
 */
export function cameraPoseAt(frame: number, moves?: CameraMove[]): CameraPose {
  if (!moves || moves.length === 0) return RESTING_POSE;
  const sorted = moves
    .map((move, index) => ({ move, index }))
    .sort((a, b) => a.move.at - b.move.at || a.index - b.index)
    // Same-`at` ties: the later array entry wins and the earlier tied entries
    // never display, so they cannot act as a `from` pose either — the rule
    // `useStateTransition` already applies to `Step`.
    .filter(
      (e, i, arr) => i === arr.length - 1 || arr[i + 1].move.at !== e.move.at,
    )
    .map((e) => e.move);

  // `on` is the pose actually on screen; `target` is the last resolved target,
  // which is what an omitted field carries forward.
  let on = RESTING_POSE;
  let target = RESTING_POSE;
  let current: {
    from: CameraPose;
    to: CameraPose;
    at: number;
    dur: number;
  } | null = null;

  for (const move of sorted) {
    if (move.at > frame) break;
    if (current) {
      // Truncation, not blending: sample the move in flight at the moment the
      // next one takes over, and hand that pose on as the next move's `from`.
      const p = moveProgress(move.at, current.at, current.dur);
      on = {
        zoom: lerp(current.from.zoom, current.to.zoom, p),
        x: lerp(current.from.x, current.to.x, p),
        y: lerp(current.from.y, current.to.y, p),
      };
    }
    target = {
      zoom: move.zoom ?? target.zoom,
      x: move.x ?? target.x,
      y: move.y ?? target.y,
    };
    current = {
      from: on,
      to: target,
      at: move.at,
      dur: move.duration ?? CAMERA_MOVE_FRAMES,
    };
  }

  if (!current) return on;
  const p = moveProgress(frame, current.at, current.dur);
  return {
    zoom: lerp(current.from.zoom, current.to.zoom, p),
    x: lerp(current.from.x, current.to.x, p),
    y: lerp(current.from.y, current.to.y, p),
  };
}

/**
 * A focal point the current zoom can actually hold. At zoom `z` the camera sees
 * `1/z` of the shot, so its centre cannot get closer than `0.5/z` to an edge
 * without dragging `backdropColor` into frame — which is what `{ zoom: 1 }`
 * after an off-centre push would otherwise do to its own pull-back. At zoom 1
 * (or below) the only legal focal point is dead centre.
 */
export function clampFocus(value: number, zoom: number): number {
  const lo = 0.5 / zoom;
  const hi = 1 - lo;
  if (lo >= hi) return 0.5;
  return Math.min(Math.max(value, lo), hi);
}

/**
 * Natural length: the last move's `at + duration`, plus `TAIL_FRAMES`. A
 * locked-off shot (no moves) reports 0 and the composer uses the source's own
 * length instead.
 */
export function screenRecordingFrames(camera?: CameraMove[]): number {
  if (!camera || camera.length === 0) return 0;
  const end = Math.max(
    ...camera.map((m) => m.at + (m.duration ?? CAMERA_MOVE_FRAMES)),
  );
  return Math.round(end + TAIL_FRAMES);
}

export interface ShotLayout {
  /** Cropped region in frame px: where it sits and how big it is. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** The media element inside that region — its size, and its offset from it. */
  mediaWidth: number;
  mediaHeight: number;
  mediaLeft: number;
  mediaTop: number;
}

/**
 * Where the cropped region and the media element land, in composition px.
 *
 * The source is measured in "height = 1" units, so `sourceAspect` is the only
 * thing the component ever needs to know about the file — omitted, it is the
 * composition's own aspect, which is exactly the "crop measured on the fitted
 * shot" reading documented on the prop.
 */
export function shotLayout(
  width: number,
  height: number,
  crop: ScreenCrop | undefined,
  fit: ScreenRecordingFit,
  sourceAspect: number | undefined,
): ShotLayout {
  const left = crop?.left ?? 0;
  const top = crop?.top ?? 0;
  // A crop that eats the whole source would divide by zero and blank the frame;
  // leave a sliver rather than an Infinity.
  const keepX = Math.max(1 - left - (crop?.right ?? 0), 0.01);
  const keepY = Math.max(1 - top - (crop?.bottom ?? 0), 0.01);
  // A zero or negative `sourceAspect` divides by zero downstream and every
  // returned size comes back NaN, which CSS drops silently — the shot just
  // never appears. Fall back to the composition's aspect, i.e. to the
  // documented "omit it" behaviour.
  const aspect =
    sourceAspect && sourceAspect > 0 ? sourceAspect : width / height;

  // Cropped region in source units, then the scale that fits it to the frame.
  const regionW = aspect * keepX;
  const regionH = keepY;
  const k =
    fit === "contain"
      ? Math.min(width / regionW, height / regionH)
      : Math.max(width / regionW, height / regionH);

  const w = regionW * k;
  const h = regionH * k;
  return {
    left: (width - w) / 2,
    top: (height - h) / 2,
    width: w,
    height: h,
    mediaWidth: aspect * k,
    mediaHeight: k,
    // The region's top-left sits `crop.left`/`crop.top` into the scaled source.
    mediaLeft: -left * aspect * k,
    mediaTop: -top * k,
  };
}

// --- Media ----------------------------------------------------------------

const isVideo = (src: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(src);

/**
 * `shotLayout` works in composition px, but this component is an `AbsoluteFill`
 * and can be mounted in a box that is NOT the composition — a device frame's
 * screen (`laptop-frame`'s is 792x472), a split-screen `<Sequence>`. Laid out
 * in px there, the shot is sized for 1280x720 and clipped to the top-left
 * corner of the screen, and the camera centres the focal point on the
 * composition's centre rather than the box's.
 *
 * Dividing every offset by the composition size makes it a fraction of whatever
 * box the component actually lands in — identical when that box IS the frame,
 * correct when it is not, and with nothing to measure, so the layout stays a
 * pure function of the props.
 */
const pct = (value: number, of: number) => `${(value / of) * 100}%`;

/**
 * A root-relative asset (`/recordings/checkout.mp4`) is served at the origin
 * root by Next in the Player, but a server render serves `public/` through
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

// --- Component ------------------------------------------------------------

export function ScreenRecording({
  src,
  crop,
  cropTop,
  cropRight,
  cropBottom,
  cropLeft,
  sourceAspect,
  fit = "cover",
  backdropColor,
  camera = DEMO_CAMERA,
  radius = 0,
  trimBefore,
  audio = false,
  entrance = "fade",
  theme,
  mode,
  speed = 1,
  className,
}: ScreenRecordingProps) {
  const frame = useCurrentFrame() * speed;
  const t = useSnapCnTheme(theme, mode);
  const { width, height } = useVideoConfig();
  const isRendering = getRemotionEnvironment().isRendering;

  const shot = shotLayout(
    width,
    height,
    {
      top: cropTop ?? crop?.top,
      right: cropRight ?? crop?.right,
      bottom: cropBottom ?? crop?.bottom,
      left: cropLeft ?? crop?.left,
    },
    fit,
    sourceAspect,
  );
  const pose = cameraPoseAt(frame, camera);
  const focusX = clampFocus(pose.x, pose.zoom);
  const focusY = clampFocus(pose.y, pose.zoom);
  // Screen = (content - focal) * zoom + centre, so the focal point lands dead
  // centre at any zoom. With a `0 0` origin that is a plain translate + scale,
  // and as a PERCENTAGE of the camera box it is `0.5 - focal * zoom` — which is
  // the same number in a full-frame mount and correct in a smaller one.
  const tx = (0.5 - focusX * pose.zoom) * 100;
  const ty = (0.5 - focusY * pose.zoom) * 100;

  const arrival =
    entrance === "none"
      ? 1
      : interpolate(
          frame,
          [ENTRANCE_START, ENTRANCE_START + ENTRANCE_FRAMES],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

  const mediaStyle: CSSProperties = {
    position: "absolute",
    // Percentages of the region box, not px — see `pct` above.
    left: pct(shot.mediaLeft, shot.width),
    top: pct(shot.mediaTop, shot.height),
    width: pct(shot.mediaWidth, shot.width),
    height: pct(shot.mediaHeight, shot.height),
    // Tailwind's preflight sets `img { max-width: 100% }`, which can collapse a
    // media element we size ourselves to 0px wide. Opt out. (motion-quality skill.)
    maxWidth: "none",
    // A no-op when `sourceAspect` is given (the box already is the file's
    // aspect); when it is omitted this is what "aspect-filled first" means.
    objectFit: "cover",
    opacity: arrival,
    // Dropped once the entrance is over rather than left at `blur(0px)`: a
    // filter that is not `none` promotes the media to its own compositing
    // layer, and a promoted layer under the camera's `scale()` is resampled
    // from a stale raster instead of redrawn — across parallel tabs, in a
    // render. `blur(0px)` is on the motion-quality skill's cargo-cult list for
    // exactly that reason, and this shot is scaled on nearly every frame.
    ...(arrival < 1
      ? { filter: `blur(${(1 - arrival) * ENTRANCE_BLUR}px)` }
      : null),
  };
  const resolved = resolveSrc(src);

  return (
    <AbsoluteFill
      className={className}
      style={{
        backgroundColor: backdropColor ?? t.background,
        borderRadius: radius,
        overflow: "hidden",
      }}
    >
      {/* Camera. will-change helps the live Player but is wrong in a render —
          it rasterises the shot across parallel tabs. (motion-quality skill.) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "0 0",
          transform: `translate(${tx}%, ${ty}%) scale(${pose.zoom})`,
          ...(isRendering ? {} : { willChange: "transform" as const }),
        }}
      >
        {/* The cropped region. Clips the chrome off the source, and under
            `contain` keeps it off the backdrop as well. */}
        <div
          style={{
            position: "absolute",
            left: pct(shot.left, width),
            top: pct(shot.top, height),
            width: pct(shot.width, width),
            height: pct(shot.height, height),
            overflow: "hidden",
          }}
        >
          {isVideo(src) ? (
            <OffthreadVideo
              src={resolved}
              muted={!audio}
              trimBefore={trimBefore}
              style={mediaStyle}
            />
          ) : (
            <Img src={resolved} style={mediaStyle} />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// ponytail: no `chrome="browser"` preset. A fraction that guesses an unknown
// recording's tab strip is wrong more often than right; `crop` is one division.
// ponytail: no `children`. A slot here would be a second, zoom-locked overlay
// space, which contradicts overlays living in frame coordinates — wrap this
// component in cursor-track instead. Emphasis inside the shot is `camera`'s
// job: a push to a focal point rides the footage by construction, which is
// exactly what an overlay in frame coordinates cannot do.
// ponytail: no per-move easing override. Add one when a track needs two feels.
