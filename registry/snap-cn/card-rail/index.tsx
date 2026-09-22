"use client";

import { loadFont as loadSans } from "@remotion/google-fonts/Figtree";
import type { CSSProperties } from "react";
import { useCallback, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  getRemotionEnvironment,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  mixOklch,
  parseColor,
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";

/**
 * A rail of cards flicked sideways across a tilted plane.
 *
 * The cards do not crawl past on a loop. They are *flicked* — the rail leaves at
 * speed, decelerates for well over a second, and comes to rest one card further
 * along, the way a carousel behaves under a thumb rather than under a timer. A
 * title holds the top of the frame and does not move with them.
 *
 * ## The plane is tilted, and that is the whole look
 *
 * The rail is not flat to the camera. Measured on the card edges of a recording,
 * the horizontal scale grows **0.000825 per pixel of height** about the frame's
 * own centre line — the bottom of a card is 22% wider than its top — while
 * horizontals stay horizontal and the type stays upright. That is a plane
 * rotated about a horizontal axis under perspective, and it is why a row of
 * plain rectangles reads as a surface receding into the frame.
 *
 * The three numbers that describe it are `DEPTH`, `TILT` and `HORIZON`, and they
 * are deliberately separate from the card metrics: change the card size and the
 * plane does not move.
 *
 * ## The flick is measured, not eased
 *
 * `FLICK` is the curve off the recording — it peaks at 29px a frame three frames
 * in and is still moving at 2px a frame a second later. No standard ease has that
 * tail; a cubic-out arrives four times too early and a spring overshoots
 * something that never overshoots.
 */

const { fontFamily: SANS } = loadSans("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

/* ─────────────────────────────────────────────────────────────────────────
   The stage, in the recording's own 714 × 396 pixels
   ───────────────────────────────────────────────────────────────────────── */

export const REF_W = 714;
export const REF_H = 396;

/** Title: cap height and baseline, measured on its own ink. */
export const HEAD_CAP = 20.81;
export const HEAD_BASE = 64.45;

/** The card, in layout pixels — before the plane tilts it. */
export const CARD_W = 259.2;
export const CARD_TOP = 79.8;
export const GAP = 54.2;
export const RADIUS = 10;
/**
 * The card runs to the foot of the frame — the rail is a surface passing
 * through the shot, not a row of objects sitting in it.
 *
 * Its own number rather than `REF_H - CARD_TOP`, because `CARD_TOP` is a
 * *layout* height on a tilted plane and the two are not the same measurement:
 * the plane pushes the card 54px down the frame on its way to the camera.
 */
export const CARD_H = 323.3;
/** The picture's share of the card's width, as an aspect. */
export const SHOT_ASPECT = 16 / 9;

/**
 * The plane.
 *
 * `HORIZON` is the height at which the plane is exactly life-size — above it the
 * rail is smaller and further away, below it nearer and larger. It is measured,
 * not chosen: solving the card's width at two heights puts it at 300.6, which is
 * most of the way down the visible card rather than at the frame's middle.
 */
export const DEPTH = 740;
export const TILT = 30;
export const HORIZON = 300;

/**
 * The backdrop's axis, in degrees.
 *
 * Fitted, not guessed: a plane's corners have to satisfy TL + BR = TR + BL for a
 * linear gradient, and the recording's do to within five parts in 235 — so it is
 * linear, and the angle that puts its measured corners on one line is 138°.
 */
export const ANGLE = 138;

/**
 * How far the rail travels, and the curve it travels on.
 *
 * One card pitch, so the rail comes to rest showing the next card where the last
 * one stood. The table is seconds → share of that distance, straight off the
 * recording: 29px on frame three, 2px a second later, and no analytic curve in
 * between that fits both ends.
 */
/**
 * Not `CARD_W + GAP`, and the difference is the point.
 *
 * A rail that advanced by exactly one pitch would be an assumption; measured, the
 * recording's travels 333 where its pitch is 325. A flick is a flick — it ends
 * where the momentum ran out, not on a snap — and eight pixels of overshoot is
 * the whole difference between a carousel and a surface someone pushed.
 */
export const TRAVEL = 323;
export const FLICK: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.0333, 0.009],
  [0.0667, 0.0338],
  [0.1, 0.07508],
  [0.1333, 0.13213],
  [0.1667, 0.21021],
  [0.2, 0.2973],
  [0.225, 0.38138],
  [0.2583, 0.45345],
  [0.2917, 0.51351],
  [0.325, 0.56757],
  [0.3583, 0.60961],
  [0.3917, 0.65165],
  [0.4333, 0.68468],
  [0.4583, 0.71171],
  [0.4917, 0.73874],
  [0.525, 0.76276],
  [0.5583, 0.78378],
  [0.5917, 0.8018],
  [0.625, 0.81982],
  [0.6583, 0.83483],
  [0.6917, 0.84985],
  [0.73, 0.86186],
  [0.7633, 0.87387],
  [0.7967, 0.88288],
  [0.8383, 0.89189],
  [0.8717, 0.9009],
  [0.905, 0.90991],
  [0.9383, 0.91592],
  [0.9717, 0.92492],
  [0.9967, 0.93093],
  [1.03, 0.93694],
  [2.2, 1],
];

/** Linear read of a rising table, clamped at both ends. */
export function read(
  table: readonly (readonly [number, number])[],
  x: number,
): number {
  const first = table[0];
  const last = table[table.length - 1];
  if (!first || !last) return 0;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const hi = table[i];
    const lo = table[i - 1];
    if (hi && lo && x <= hi[0]) {
      return lo[1] + ((hi[1] - lo[1]) * (x - lo[0])) / (hi[0] - lo[0]);
    }
  }
  return last[1];
}

export interface CardRailProps {
  /** The pictures, split by `|`. The rail repeats them if it runs out. */
  images?: string;
  /** One title per card, split by `|`. Blank leaves the picture alone. */
  titles?: string;
  /** One line of small print per card, split by `|`. */
  notes?: string;
  /** One tag per card, split by `|`. */
  tags?: string;
  /** The line that holds the top of the frame. */
  heading?: string;
  /** Frame the first flick starts on. Negative starts the scene already moving. */
  from?: number;
  /** How many flicks. Each one carries the rail about another card along. */
  flicks?: number;
  /** Frames between one flick leaving and the next. */
  every?: number;
  /** Where the rail sits before it moves, in layout pixels. */
  offset?: number;
  /**
   * The backdrop: two colour stops split by `|`, or one picture.
   *
   * A picture because a brand backdrop is often not a gradient at all — the
   * recording this was measured from has corners that satisfy a linear fit and a
   * middle that is 40 levels darker than one, which is a mesh or a painted plate
   * and not something two stops can be talked into.
   */
  backdrop?: string;
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
  fontFamily?: string;
}

export function CardRail({
  images = "/demos/posters/orbit-gallery.webp|/demos/posters/moodboard-reveal.webp|/demos/posters/hero-launch.webp|/demos/posters/phone-frame.webp|/demos/posters/count-grid.webp|/demos/posters/terminal-simulator.webp|/demos/posters/logo-flicker.webp|/demos/posters/laptop-frame.webp|/demos/posters/announce-title.webp",
  titles = "Orbit Gallery|Moodboard Reveal|Hero Launch|Phone Frame|Count Grid|Terminal Simulator|Logo Flicker|Laptop Frame|Announce Title",
  notes = "Scene · 300 frames|Scene · 150 frames|Scene · 170 frames|Scene · 240 frames|Scene · 47 frames|Scene · 200 frames|Scene · 100 frames|Scene · 240 frames|Scene · 170 frames",
  tags = "@snapcn/orbit-gallery|@snapcn/moodboard-reveal|@snapcn/hero-launch|@snapcn/phone-frame|@snapcn/count-grid|@snapcn/terminal-simulator|@snapcn/logo-flicker|@snapcn/laptop-frame|@snapcn/announce-title",
  heading = "Browse scenes",
  from = 0,
  flicks = 3,
  every = 30,
  offset = 0,
  backdrop = "",
  theme,
  mode = "light",
  fontFamily = "Default",
}: CardRailProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily) ?? SANS;

  const u = height / REF_H;
  const ox = (width - REF_W * u) / 2;

  const shots = split(images);
  const title = split(titles);
  const note = split(notes);
  const tag = split(tags);
  const stops = split(backdrop);
  const only = stops.length === 1 ? (stops[0] ?? "") : "";
  const plate = only.startsWith("data:") || only.startsWith("/") ? only : "";

  /**
   * Flicks add up.
   *
   * Each one is the same measured curve started `every` frames after the last,
   * and the rail's position is their sum — so a flick begun while the one before
   * it is still creeping carries that creep with it, which is what repeated
   * swipes actually do. `read` clamps at both ends, so a flick that has not
   * started contributes nothing and one that has finished contributes all of it.
   */
  let travelled = 0;
  for (let k = 0; k < Math.max(1, Math.round(flicks)); k++) {
    travelled += TRAVEL * read(FLICK, (frame - from - k * every) / fps);
  }
  const pitch = CARD_W + GAP;

  // Enough cards to cover the frame at its widest, plus one leaving and one
  // arriving. The rail repeats the list rather than running out.
  const span = Math.ceil(REF_W / pitch) + 3;
  // The rail has a beginning. Cards repeat to the right for as long as the flick
  // needs them, but nothing is drawn before the first one — a loop that wraps
  // round puts a card in the empty half of the frame the scene opens on.
  const first = Math.max(0, Math.floor((travelled - offset) / pitch));

  // Both stops are mixed toward *blues*, never toward the page. The page is a
  // near-neutral, its hue in oklch is undefined, and interpolating the accent
  // through it comes out somewhere else entirely — measured once already, a blue
  // accent over a warm off-white mixed to a pale green.
  const from0 = stops[0] ?? mixOklch(t.primary, "#0b1f3d", 0.55);
  const to0 = stops[1] ?? mixOklch(t.primary, "#dceaff", 0.78);
  // A theme with a transparent page asks for no page: no backdrop, so the rail
  // sits on whatever is under it, and a heading in ink rather than mixed off it.
  const bare = parseColor(t.background).alpha === 0;

  return (
    <AbsoluteFill
      style={
        bare
          ? undefined
          : plate
            ? { backgroundColor: t.background }
            : { background: `linear-gradient(${ANGLE}deg, ${from0}, ${to0})` }
      }
    >
      {plate && !bare && (
        <Plate
          src={plate}
          style={{ position: "absolute", inset: 0, objectFit: "cover" }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: ox,
          top: 0,
          width: REF_W * u,
          height: REF_H * u,
          fontFamily: face,
          textRendering: "geometricPrecision",
          overflow: "hidden",
        }}
      >
        {heading && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: (HEAD_BASE - HEAD_CAP * 1.32) * u,
              textAlign: "center",
              fontSize: HEAD_CAP * 1.38 * u,
              lineHeight: 1,
              fontWeight: 500,
              color: bare ? t.foreground : mixOklch(to0, t.background, 0.62),
            }}
          >
            {heading}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            // The plane. `HORIZON` is where it is life-size, so the tilt pivots
            // about a line inside the visible band rather than about the top of
            // a box nobody can see.
            perspective: DEPTH * u,
            perspectiveOrigin: `50% ${HORIZON * u}px`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `rotateX(${TILT}deg)`,
              transformOrigin: `50% ${HORIZON * u}px`,
              transformStyle: "preserve-3d",
            }}
          >
            {Array.from({ length: span }, (_, n) => {
              const i = first + n;
              const x = i * pitch - travelled + offset;
              const k = ((i % shots.length) + shots.length) % shots.length;
              return (
                <Card
                  key={i}
                  x={x * u}
                  src={shots[k] ?? ""}
                  title={title[k] ?? ""}
                  note={note[k] ?? ""}
                  tag={tag[k] ?? ""}
                  t={t}
                  u={u}
                />
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

const split = (s: string) =>
  s
    .split("|")
    .map((v) => v.trim())
    .filter(Boolean);

/** One card: a picture, and under it a title and a line of small print. */
function Card({
  x,
  src,
  title,
  note,
  tag,
  t,
  u,
}: {
  x: number;
  src: string;
  title: string;
  note: string;
  tag: string;
  t: SnapCnTheme;
  u: number;
}) {
  const bodied = Boolean(title || note || tag);
  const shot = CARD_W / SHOT_ASPECT;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: CARD_TOP * u,
        width: CARD_W * u,
        height: CARD_H * u,
        borderRadius: RADIUS * u,
        overflow: "hidden",
        background: t.card,
      }}
    >
      <Plate
        src={src}
        style={{
          display: "block",
          width: CARD_W * u,
          // With no body the picture *is* the card. That is not a special case
          // for its own sake — it is what lets a whole card be handed in as one
          // image when the layout below is somebody else's.
          height: (bodied ? shot : CARD_H) * u,
          objectFit: "cover",
        }}
      />
      {bodied && (
        <div style={{ padding: `${13 * u}px ${15 * u}px` }}>
          <div
            style={{
              fontSize: 15 * u,
              lineHeight: 1.25,
              fontWeight: 700,
              color: t.foreground,
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 5 * u,
              fontSize: 12.5 * u,
              lineHeight: 1.3,
              color: t.mutedForeground,
            }}
          >
            {note}
          </div>
          {tag && (
            <div
              style={{
                marginTop: 14 * u,
                display: "inline-block",
                padding: `${5 * u}px ${10 * u}px`,
                borderRadius: 999,
                fontSize: 11.5 * u,
                lineHeight: 1.2,
                fontWeight: 500,
                color: t.mutedForeground,
                border: `1px solid ${t.border}`,
              }}
            >
              {tag}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A root-relative asset is a `public/` file. Only the site's own Player serves
 * it at that path; Remotion Studio and a render know its URL through
 * `staticFile()` alone — so every environment but the Player rewrites it.
 */
function resolveSrc(src: string): string {
  const isLocal = src.startsWith("/") && !src.startsWith("//");
  if (!isLocal || getRemotionEnvironment().isPlayer) return src;
  // A value that already came out of staticFile() carries the static base
  // (`/static-<hash>/…`); running it through again would prefix it twice.
  const base = staticFile("_").slice(0, -2);
  if (base && src.startsWith(`${base}/`)) return src;
  try {
    return staticFile(src.replace(/^\/+/, ""));
  } catch {
    return src;
  }
}

/**
 * A picture that holds the render until it has actually loaded.
 *
 * Without it a frame can be captured before the image arrives and the card comes
 * out empty — invisible in the Player, where an image simply appears, and silent
 * in an mp4 until somebody watches it. Remotion's own `Img` is avoided for the
 * reason `hero-launch` documents: it awaits `decode()`, which the headless
 * compositor rejects for some progressive JPEGs and hangs the export.
 */
function Plate({ src, style }: { src: string; style: CSSProperties }) {
  const [handle] = useState(() => delayRender(`card-rail: ${src}`));
  const release = useCallback(() => continueRender(handle), [handle]);
  return (
    // biome-ignore lint/performance/noImgElement: Remotion frame, not a Next route.
    <img // eslint-disable-line @remotion/warn-native-media-tag -- onLoad releases the frame; <Img> hangs on some JPEGs
      src={resolveSrc(src)}
      alt=""
      // Tailwind's preflight sets `img { max-width: 100% }`, which collapses an
      // image inside a shrink-to-fit box to zero pixels wide on the site while
      // rendering perfectly in an mp4. Size it here and say so.
      style={{ ...style, maxWidth: "none" }}
      onLoad={release}
      onError={release}
    />
  );
}
