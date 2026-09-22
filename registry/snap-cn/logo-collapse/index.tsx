"use client";

import { loadFont as loadSans } from "@remotion/google-fonts/InterTight";
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
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";

/**
 * A stack of shots flicked through, collapsing into the mark, and the wordmark
 * landing beside it.
 *
 * One square card holds the middle of the frame and cuts to the next shot, each
 * one smaller and each held for less time than the last, so the sequence winds
 * itself up rather than running at a constant clip. At the end of the run the
 * card does not shrink away — it *collapses*, overshooting past its resting size
 * in a frame and settling back. Then the mark steps aside and the wordmark takes
 * the space it made.
 *
 * ## The cuts are cuts
 *
 * Nothing cross-fades and nothing tweens between shots. The reference holds each
 * card at a fixed size for its whole beat — measured, the box is constant to the
 * pixel across every frame of a hold, and then a different size on the next one.
 * A card that eased between sizes would read as a zoom; a card that cuts reads as
 * a stack of prints being dealt, which is the whole idea.
 *
 * That is also why `sizes` and `holds` are parallel lists of literals rather than
 * a ratio and a duration. The reference's own run is 0.512, 0.476, 0.458, 0.414,
 * 0.339 of the frame height on beats of 1, 6, 5, 4, 2 and 4 frames — neither
 * series is geometric, and a formula that fitted one would miss the other.
 *
 * ## The collapse overshoots
 *
 * 30px, then 24, then 22, on three consecutive frames. Two frames of overshoot is
 * the difference between a mark that lands and a mark that is simply smaller than
 * the card was — and it is the only place in the scene where anything moves
 * between frames rather than cutting.
 *
 * ## The mark steps aside in two
 *
 * Centred alone at 294.5; then 282.0 for four frames; then 248.5 as the wordmark
 * appears whole. Two steps, held, not an ease — the same grammar as the cards.
 */

const { fontFamily: SANS } = loadSans("normal", {
  weights: ["600", "700"],
  subsets: ["latin"],
});

/* ─────────────────────────────────────────────────────────────────────────
   The stage, in the recording's own 592 × 336 pixels
   ───────────────────────────────────────────────────────────────────────── */

export const REF_W = 592;
export const REF_H = 336;

/** Where the card, and then the mark, sits. */
export const STAGE_X = 294;
export const STAGE_Y = 167.5;

/**
 * The mark's box, frame by frame, from the moment the stack runs out.
 *
 * It lands oversized and settles in three steps rather than easing: 32, 25, 24,
 * then 23 for the rest of the scene. Measured on the mark's orange core, which
 * is the only part of it a threshold can find honestly — the glow around it
 * reads as ink to anything looser and makes the landing look 40% bigger than it
 * is.
 */
export const MARK = 22;
export const LAND: readonly number[] = [32, 25, 24, 24];

/**
 * The tile the stack collapses onto, before the mark is left alone.
 *
 * This is the beat that is easy to miss and impossible to unsee: the photo card
 * does not shrink into the mark, it *cuts* to a plain light tile of 60px with
 * the mark sitting on it, holds for two frames, and only then does the tile go.
 * It is very faint — luma 233 against the page's 247, which is why nothing
 * thresholded at 200 finds it — and it is what makes the collapse read as a
 * stack of prints resolving into a logo rather than as a card that shrank.
 */
export const TILE = 60;
export const TILE_FRAMES = 2;

/** Left edge of the finished lockup, and where the word starts inside it. */
export const LOCK_X = 237;
export const WORD_X = 264;

/** Cap height of the wordmark, measured on its own ink. */
export const WORD_CAP = 19.37;
/** Top of the wordmark's box. Measured, not derived from a line-height ratio. */
export const WORD_TOP = 155.74;
/**
 * Cap height → font-size, and the tracking a logotype is set at.
 *
 * A wordmark is lettering, not type: the reference's is 4.149 cap-widths for six
 * glyphs, and the nearest face on the shelf sets the same six at 4.634 — twelve
 * per cent loose. That gap is tracking, not the wrong face. Inter Tight at
 * −0.073em closes it; every other candidate measured wider still (Archivo 4.786,
 * Plus Jakarta 4.877, Space Grotesk 4.975, Manrope 5.011, Poppins 5.715).
 */
export const WORD_EM = 1.326;
export const WORD_TRACK = -0.073;

/** The mark's waypoint: where it waits before the wordmark arrives. */
export const STEP_X = 281.5;

/** Frames, on the scene's own 30fps clock. */
export const STEP_AT = 28;
export const WORD_AT = 30;
export const DOT_AT: readonly number[] = [37, 42];

/**
 * The two marks that bracket the lockup, and the ping each one arrives on.
 *
 * They do not simply appear: each lands at 7px in full accent and settles to 4px
 * and about a third of its ink over five frames. Measured on both — the upper
 * one is already pale and small by the frame the lower one lands, which is the
 * only reason you can tell they are two beats and not one.
 */
export const DOTS: readonly (readonly [number, number])[] = [
  [229, 147],
  [229, 191],
];
export const DOT_IN = 7;
export const DOT_OUT = 4;
export const DOT_SETTLE = 5;
export const DOT_FADE = 0.34;

export interface LogoCollapseProps {
  /**
   * The shots, split by `|`. The card cuts through them in order.
   *
   * Not by comma: a `data:` URL has one of its own right after the encoding, and
   * splitting on it hands the browser half a URL and a card that renders as a
   * broken-image glyph.
   */
  images?: string;
  /**
   * Each shot's card, as a share of the frame height.
   *
   * `0.48` is a square; `0.515x0.5625` is a portrait one. Real photo sets are
   * not all one shape, and the reference's second shot is measurably taller
   * than it is wide — forcing it square crops fifteen pixels off a print that
   * was never square.
   */
  sizes?: string;
  /** Frames each shot is held for. */
  holds?: string;
  /** The mark the stack collapses into. */
  mark?: string;
  /** The word that lands beside it. */
  wordmark?: string;
  /** Optional plate behind everything — a paper, a gradient, a still. */
  background?: string;
  /** The brand colour the two bracket marks ping in. Blank uses the accent. */
  accent?: string;
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
  fontFamily?: string;
}

export function LogoCollapse({
  images = "/demos/posters/count-grid.webp|/demos/posters/moodboard-reveal.webp|/demos/posters/orbit-gallery.webp|/demos/posters/hero-launch.webp|/demos/posters/phone-frame.webp|/demos/posters/terminal-simulator.webp",
  sizes = "0.82x0.461,0.72x0.405,0.63x0.354,0.55x0.309,0.46x0.259,0.36x0.203",
  holds = "1,5,5,4,2,5",
  mark = "/logo/snapcn.png",
  wordmark = "snapcn",
  background = "",
  accent = "",
  theme,
  mode = "light",
  fontFamily = "Default",
}: LogoCollapseProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily) ?? SANS;

  const u = height / REF_H;
  const ox = (width - REF_W * u) / 2;

  const shots = images
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const size = sizes.split(",").map((s) => {
    const [w, h] = s.trim().split("x");
    const sw = Number(w);
    return [sw, h === undefined ? sw : Number(h)] as const;
  });
  const hold = holds.split(",").map((s) => Number(s.trim()));

  // Which shot is up, and the frame the stack runs out on.
  let at = 0;
  let shot = -1;
  for (let i = 0; i < shots.length; i++) {
    const end = at + (hold[i] ?? 0);
    if (frame < end) {
      shot = i;
      break;
    }
    at = end;
  }
  const collapseAt = hold
    .slice(0, shots.length)
    .reduce((a, b) => a + (b || 0), 0);

  const ink = t.foreground;

  return (
    <AbsoluteFill style={{ backgroundColor: t.background }}>
      {background && (
        <Plate
          src={background}
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
        }}
      >
        {shot >= 0 ? (
          <Plate
            key={shot}
            src={shots[shot] ?? ""}
            style={box(
              (size[shot]?.[0] ?? 0.4) * REF_H,
              (size[shot]?.[1] ?? 0.4) * REF_H,
              STAGE_X,
              STAGE_Y,
              u,
            )}
          />
        ) : (
          <Lockup
            frame={frame}
            since={frame - collapseAt}
            mark={mark}
            word={wordmark}
            ink={ink}
            accent={accent || t.primary}
            tile={t.muted}
            u={u}
          />
        )}
      </div>
    </AbsoluteFill>
  );
}

/** A box of `w × h` reference pixels centred on `(cx, cy)`, in real pixels. */
function box(
  w: number,
  h: number,
  cx: number,
  cy: number,
  u: number,
): CSSProperties {
  return {
    position: "absolute",
    left: (cx - w / 2) * u,
    top: (cy - h / 2) * u,
    width: w * u,
    height: h * u,
    objectFit: "cover",
  };
}

/** The tile, the mark landing, stepping aside, and the word arriving. */
function Lockup({
  frame,
  since,
  mark,
  word,
  ink,
  accent,
  tile,
  u,
}: {
  /** The scene's own frame, which the beats below are written in. */
  frame: number;
  /** Frames since the stack ran out, which the landing is written in. */
  since: number;
  mark: string;
  word: string;
  ink: string;
  accent: string;
  tile: string;
  u: number;
}) {
  const size = LAND[since] ?? MARK;
  const worded = frame >= WORD_AT;
  const cx = worded ? LOCK_X + MARK / 2 : frame >= STEP_AT ? STEP_X : STAGE_X;
  return (
    <>
      {since < TILE_FRAMES && (
        <div
          style={{
            ...box(TILE, TILE, STAGE_X, STAGE_Y, u),
            background: tile,
          }}
        />
      )}
      <Plate src={mark} style={box(size, size, cx, STAGE_Y, u)} />
      {worded && (
        <div
          style={{
            position: "absolute",
            left: WORD_X * u,
            top: WORD_TOP * u,
            fontSize: WORD_CAP * WORD_EM * u,
            lineHeight: 1,
            fontWeight: 700,
            letterSpacing: `${WORD_TRACK}em`,
            color: ink,
            whiteSpace: "nowrap",
          }}
        >
          {word}
        </div>
      )}
      {DOTS.map(([dx, dy], i) => {
        const since = frame - (DOT_AT[i] ?? Number.POSITIVE_INFINITY);
        if (since < 0) return null;
        const k = Math.min(1, since / DOT_SETTLE);
        const d = DOT_IN + (DOT_OUT - DOT_IN) * k;
        return (
          <div
            key={`${dx}-${dy}`}
            style={{
              position: "absolute",
              left: (dx - d / 2) * u,
              top: (dy - d / 2) * u,
              width: d * u,
              height: d * u,
              background: accent,
              opacity: 1 + (DOT_FADE - 1) * k,
            }}
          />
        );
      })}
    </>
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
 * An image that holds the render until it has actually loaded.
 *
 * Without it a frame can be captured before the picture arrives and the card
 * comes out empty — invisible in the Player, where an image simply appears, and
 * silent in an mp4 until somebody watches it. Remotion's own `Img` is avoided for
 * the reason `hero-launch` documents: it awaits `decode()`, which the headless
 * compositor rejects for some progressive JPEGs and hangs the export.
 */
function Plate({ src, style }: { src: string; style: CSSProperties }) {
  const [handle] = useState(() => delayRender(`logo-collapse: ${src}`));
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
