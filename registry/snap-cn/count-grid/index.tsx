"use client";

import { loadFont as loadSans } from "@remotion/google-fonts/Inter";
import {
  AbsoluteFill,
  getRemotionEnvironment,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Item } from "@/lib/snap-cn-ui";

/**
 * A grid of cards that rushes in, settles on a small count, then fills the
 * frame while the number jumps.
 *
 * Five cards and a label; the camera pulls back a fraction, every empty cell
 * around them fills in from the middle out, and the label goes from five to
 * five hundred. It is the "and it scales" shot — one thing, then all of them,
 * without a cut.
 *
 * Beat by beat, measured off the reference at 30fps:
 *
 * | beat | frames | what moves |
 * | --- | --- | --- |
 * | rush in | 0 – 7 | cell pitch 184 → 138, hard horizontal blur |
 * | settle | 7 – 19 | 138 → 121, blur gone by 12 |
 * | label | 11 – 18 | the whole line fades up at once |
 * | drift | 19 – 36 | 121 → 118, still moving, never held |
 * | fill | 37 – 46 | 118 → 96.5, every cell populates, 5 → 500 |
 *
 * The pull-back is a *scale*, not a camera z-move: the two centre columns hold
 * their midpoint at x 358.5 for all 47 frames while the pitch between them
 * walks 138.5 → 96.5, and the cards keep a constant fraction of the cell. And
 * the settle never actually settles — the pitch is still shedding a fifth of a
 * pixel per frame at frame 37, which is what stops the middle of the shot
 * looking like a freeze-frame.
 */

const { fontFamily: SANS } = loadSans();

/* ─────────────────────────────────────────────────────────────────────────
   Geometry, in the reference's own 712×398 pixels
   ───────────────────────────────────────────────────────────────────────── */

export const REF_W = 712;
export const REF_H = 398;

/**
 * What the pull-back scales about.
 *
 * Horizontally it is the midpoint the two centre columns hold all clip: 358.75.
 * Vertically it is *not* the middle row — the centre row's own middle sits at
 * 202.5 and moves to 203.5 as the grid shrinks, which puts the fixed point 5px
 * lower, at 207.6. Scaling about the row instead leaves the whole grid a
 * pixel high through the entire fill.
 */
export const ORIGIN = { x: 358.75, y: 207.6 };

/**
 * One cell at scale 1, and how much of it the card takes.
 *
 * The *cell* is measured — 120.5 × 147, the pitch the whole pull-back is fitted
 * to. The card inside it is a design choice and it is deliberately not the
 * reference's: measured, that card is 90.5 × 117 with a 30px gutter and a 6px
 * radius, which reads as a scatter of small rounded stickers. This one fills
 * 95% of its cell with a 3px corner, so the grid reads as a wall of frames.
 */
export const CELL = { w: 120.5, h: 147 };
export const CARD = { w: 114.5, h: 139.5, radius: 3 };

/**
 * How much closer the grid sits than the reference's camera.
 *
 * One, now. It was 1.75 for exactly as long as it took to find out that the
 * cards were being *drawn* at reference-pixel size inside cells laid out at
 * render-pixel size — 0.42 of their own cell rather than 0.95 — and that no
 * amount of zoom fixes a missing unit conversion, it only moves the error into
 * the cell spacing as well. Left in place because it is the honest knob if the
 * grid should ever sit closer than the reference's, and because a `1` with this
 * note attached is cheaper than someone rediscovering the bug.
 */
export const GRID_ZOOM = 1;

/** A column *boundary* sits on the centre; a row *centre* does. */
export const COL_EDGE = 359;
export const ROW_MID = 202.5;

/**
 * The five that are there before the grid fills.
 *
 * `[col, row]`, with column 0 immediately right of the centre boundary and row
 * 0 the middle row. Four make a square around the label and the fifth hangs
 * below on the right — an even 2×2 reads as a swatch, and the odd one out is
 * what makes it read as a handful of people.
 */
export const SEED: readonly (readonly [number, number])[] = [
  [-1, -1],
  [0, -1],
  [-1, 0],
  [0, 0],
  [0, 1],
];

/** The label, at scale 1. */
export const LABEL = {
  cy: ROW_MID,
  size: 30,
  padX: 15,
  height: 41,
  radius: 9,
  from: "#1F4470",
  to: "#2B84E0",
  border: "#DCE6EE",
};

/* ─────────────────────────────────────────────────────────────────────────
   Curves
   ───────────────────────────────────────────────────────────────────────── */

/** When the grid stops being five cards and becomes all of them. */
export const FILL_AT = 37;

/**
 * The cell pitch, in reference px — the one number the whole scene hangs on.
 *
 * Tracked as the distance between the two centre columns: 138.5 at frame 7,
 * 128 at 11, 121.5 at 19, 120 at 26, 118 from 32 to 36, then 113, 104, 99.5,
 * 96.5 across the fill. Before frame 7 the horizontal blur is wider than a card
 * and nothing can be measured, so that stretch is the same exponential run
 * backwards, which puts frame 0 at 174 — a card and a half outside the frame.
 *
 * Knots, not that exponential. Two of them fitted the settle and the fill to
 * within a pixel and a half each, which is a pixel and a half of grid, and they
 * met 3.7px apart at the switch going the *wrong way* — the pitch grew by 0.17
 * between 36 and 37, so the grid jolted outward on the exact frame it was
 * supposed to start collapsing. Every knot below is a measured frame and the
 * table is strictly decreasing, so it cannot do that.
 *
 * Every frame number here is zero-based, and every one of them was read off a
 * file called `f0NN.png` that is one-based: `f038.png` is frame 37. Taking the
 * filenames at face value put the whole clip a frame late and cost the switch
 * frame alone 17 mean.
 */
export function pitch(t: number, fps = 30): number {
  return interpolate(
    t * fps,
    [
      0, 7, 9, 11, 13, 15, 17, 19, 22, 26, 29, 31, 36, 37, 38, 39, 40, 41, 42,
      43, 45, 46,
    ],
    [
      174, 138.5, 132, 128, 125, 124, 122.5, 121.5, 120, 119.6, 119, 118.5, 118,
      117.9, 113, 106, 104, 102, 99.5, 97.5, 96.6, 96.5,
    ],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
}

/** The pitch as a multiple of the cell, which is what everything scales by. */
export function gridScale(t: number, fps = 30): number {
  return pitch(t, fps) / CELL.w;
}

/**
 * The horizontal blur, in reference px.
 *
 * Measured as the frame's own horizontal gradient, which is what a smear
 * actually costs: 0.28 at frame 3, 1.90 at 4, 2.75 at 5, and then flat for ten
 * frames while it creeps to 3.18. So the blur is spent inside five frames and
 * the long ease that follows it is sharp.
 *
 * The first cut derived this from the pull-back's own speed, on the theory that
 * a blur and its motion should not be able to disagree. They can: the motion is
 * still shedding two pixels of pitch a frame at frame 8 and the reference is
 * already sharp there, so the derivative kept a smear on screen for seven
 * frames the reference does not have, and cost those frames 3 mean each.
 */
export function entryBlur(t: number, fps = 30): number {
  return interpolate(t * fps, [0, 2, 3, 4, 5], [22, 14, 6, 2, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/**
 * The one card that arrives late, in reference px of extra smear.
 *
 * The scene's own blur is spent by frame 5, but the card behind the label is
 * still a horizontal streak at 7 and only lands around 9 — every other card is
 * sharp and at scale by 5. It is the detail that makes the entry read as five
 * separate things arriving rather than one picture being pushed in, and it is
 * the only per-card timing in the piece.
 */
export const LATE_CARD: readonly [number, number] = [-1, 0];

export function lateBlur(t: number, fps = 30): number {
  return interpolate(t * fps, [3, 5, 7, 9], [26, 17, 7, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/** The label fading up, all of it at once. */
export function labelIn(t: number, fps = 30): number {
  return interpolate(t * fps, [11, 13, 15, 17, 18], [0, 0.22, 0.55, 0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/**
 * How present a cell is.
 *
 * `ring` is the Chebyshev distance to the nearest seed cell, so the ring
 * touching the five arrives first and each one after it a frame later. That
 * ordering is measured: at frame 37 exactly two new columns exist, either side
 * of the original two, and by 38 there are eight.
 */
export function cellIn(ring: number, t: number, fps = 30): number {
  if (ring === 0) return 1;
  // Half a frame per ring and two frames each: the reference is 90% done in
  // three frames — 20.3, 19.0, 19.8 mean change and then a decay — and a
  // ring-per-frame stagger over three turned that into a five-frame ramp that
  // peaked two frames after the reference had finished.
  // The ramp *straddles* the switch frame rather than starting on it: at frame
  // 37 the reference's first new columns are already half there — 80px wide
  // against a settled 90 — so a ring that is still zero on 37 arrives a whole
  // frame late and the change profile peaks two frames after the reference's.
  //
  // A whole frame of stagger, not half. On frame 37 the reference has ring one
  // and nothing else; by 38 it has rings one and two, the second of them
  // narrower than the first. Half a frame put ring two on screen a frame early
  // and drew cards where the reference still had page.
  const at = FILL_AT - 1 + (ring - 1);
  return interpolate(t * fps, [at, at + 1.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/** Chebyshev distance from a cell to the nearest of the five. */
export function ringOf(col: number, row: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (const [c, r] of SEED) {
    best = Math.min(best, Math.max(Math.abs(col - c), Math.abs(row - r)));
  }
  return best;
}

/* ─────────────────────────────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────────────────────────────── */

export interface CountGridProps {
  /** What the label counts, before the grid fills and after. */
  from?: string;
  to?: string;
  /** The noun after the number. */
  noun?: string;
  /** Card images, cycled across the grid. Anything `<Img>` can load. */
  cards?: string[];
  background?: string;
  /** The label's ink, left end and right end of its gradient. */
  inkFrom?: string;
  inkTo?: string;
  /** 1 is the measured speed. */
  speed?: number;
}

/**
 * The card faces: frames out of snapcn's own showcase clips, and one still per
 * component in the registry — which is what the label is counting.
 *
 * Through `staticFile`, not as a bare path. A Remotion bundle copies the public
 * directory to `<bundle>/public/` and serves it from there, so a hard-coded
 * `/demos/posters/x.webp` is a 404 in every render while looking perfect in the
 * app — `staticFile` is what knows the difference. The stills are the
 * exception: they live on snapcn's media host now, not in `public/`, so they
 * are full URLs and need no rewriting.
 *
 * Both kinds on purpose. Eight frames alone tile visibly across forty cells;
 * the registry's stills alone are 16:9 scenes of dark text on white, and a 3:4
 * crop of one is a blank card. Interleaved they read the way a real library of
 * clips does — some motion, some interface — and land between the two on
 * weight, which is also where the reference's grid of portraits sits.
 */
const ART = [
  "showcase-assets/438b9e6b50654a44d404fbf358c26e9f.webp",
  "showcase-assets/5e5305b05bd405a0d89570725434099e.webp",
  "showcase-assets/767d99bb371a54d0d36751e8cecae43c.jpg",
  "showcase-assets/821d815affa6496c39cbdeeec7a84603.jpg",
  "showcase-assets/937438c560ada1c83317f2c11b3454b0.jpg",
  "showcase-assets/98f89cb9994f5c382ab964062c4039db.jpg",
  "showcase-assets/b25b82db2892efff9be3204e860d30ee.jpg",
  "showcase-assets/c9ebc6337aa2268ac4b357f9cb1ac547.jpg",
];
const STILLS = [
  "https://media.snapcn.dev/demos/posters/agent-steps.webp",
  "https://media.snapcn.dev/demos/posters/announce-title.webp",
  "https://media.snapcn.dev/demos/posters/answer-highlight.webp",
  "https://media.snapcn.dev/demos/posters/answer-stream.webp",
  "https://media.snapcn.dev/demos/posters/block-wordmark.webp",
  "https://media.snapcn.dev/demos/posters/cursor-track.webp",
  "https://media.snapcn.dev/demos/posters/follower-rush.webp",
  "https://media.snapcn.dev/demos/posters/hero-launch.webp",
  "https://media.snapcn.dev/demos/posters/karaoke-captions.webp",
  "https://media.snapcn.dev/demos/posters/laptop-frame.webp",
  "https://media.snapcn.dev/demos/posters/logo-assemble.webp",
  "https://media.snapcn.dev/demos/posters/logo-drift.webp",
  "https://media.snapcn.dev/demos/posters/logo-flicker.webp",
  "https://media.snapcn.dev/demos/posters/moodboard-reveal.webp",
  "https://media.snapcn.dev/demos/posters/orbit-gallery.webp",
  "https://media.snapcn.dev/demos/posters/phone-frame.webp",
  "https://media.snapcn.dev/demos/posters/prompt-send.webp",
  "https://media.snapcn.dev/demos/posters/prompt-zoom.webp",
  "https://media.snapcn.dev/demos/posters/punch-lines.webp",
  "https://media.snapcn.dev/demos/posters/screen-recording.webp",
  "https://media.snapcn.dev/demos/posters/search-typing.webp",
  "https://media.snapcn.dev/demos/posters/status-cycle.webp",
  "https://media.snapcn.dev/demos/posters/terminal-simulator.webp",
  "https://media.snapcn.dev/demos/posters/text-build.webp",
  "https://media.snapcn.dev/demos/posters/text-highlight.webp",
  "https://media.snapcn.dev/demos/posters/text-reveal.webp",
  "https://media.snapcn.dev/demos/posters/text-rewrite.webp",
  "https://media.snapcn.dev/demos/posters/text-select.webp",
  "https://media.snapcn.dev/demos/posters/text-swap.webp",
  "https://media.snapcn.dev/demos/posters/text-swell.webp",
  "https://media.snapcn.dev/demos/posters/type-morph.webp",
  "https://media.snapcn.dev/demos/posters/word-captions.webp",
  "https://media.snapcn.dev/demos/posters/word-flip.webp",
];
const OWN_CARDS = STILLS.flatMap((s, i) => [
  ART[i % ART.length] as string,
  s,
]).map((f) => (f.startsWith("https://") ? f : staticFile(f)));
// index 0, 2, 4 … are ART by construction, and the five seed cells only ever
// reach the first `SEED.length` of them.

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

export function CountGrid({
  from = "5",
  to = "500",
  noun = "clips",
  cards = OWN_CARDS,
  background = "#FDFDFD",
  inkFrom = LABEL.from,
  inkTo = LABEL.to,
  speed = 1,
}: CountGridProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const now = frame / fps / (speed || 1);

  const k = Math.min(width / REF_W, height / REF_H);
  const ox = (width - REF_W * k) / 2;
  const oy = (height - REF_H * k) / 2;

  const s = gridScale(now, fps);
  // The cards live one zoom step closer than everything else — see GRID_ZOOM.
  const g = s * GRID_ZOOM;
  const blur = entryBlur(now, fps) * k;
  const late = lateBlur(now, fps) * k;
  const label = labelIn(now, fps);

  // Everything is laid out at scale 1 and then scaled about ORIGIN, so a cell's
  // place in the grid never depends on the zoom — only its size does.
  const at = (v: number, origin: number, scale = s) =>
    (v - origin) * scale + origin;
  // `cellW`/`cellH` stay in reference px — they are only ever compared against
  // REF_W/REF_H to count how many cells reach the frame.
  const cellW = CELL.w * g;
  const cellH = CELL.h * g;
  // The card's size is drawn, so it needs `k` — the same reference→render scale
  // its own position already goes through. Without it the card was laid out in
  // reference px inside a cell laid out in render px: 0.42 of its cell on a
  // 1280-wide render instead of 0.95, which is every "the images are too small
  // and too far apart" note in one bug.
  const cardW = CARD.w * g * k;
  const cardH = CARD.h * g * k;

  // How many cells reach the frame at this scale, plus one so nothing pops in
  // at the edge.
  const cols = Math.ceil(REF_W / cellW / 2) + 2;
  const rows = Math.ceil(REF_H / cellH / 2) + 2;

  const cells: {
    col: number;
    row: number;
    x: number;
    y: number;
    o: number;
    i: number;
    src: string;
  }[] = [];
  for (let row = -rows; row <= rows; row++) {
    for (let col = -cols; col <= cols; col++) {
      const o = cellIn(ringOf(col, row), now, fps);
      if (o <= 0) continue;
      const cx = at(COL_EDGE + (col + 0.5) * CELL.w, ORIGIN.x, g) * k + ox;
      const cy = at(ROW_MID + row * CELL.h, ORIGIN.y, g) * k + oy;
      if (cx < -cardW || cx > width + cardW) continue;
      if (cy < -cardH || cy > height + cardH) continue;
      // A stable, well-mixed index: neighbours must not share a card or the
      // grid reads as wallpaper.
      //
      // `cards` alternates the two kinds, so its even slots are the ones with
      // pictures on them. The five that carry the whole first half of the shot
      // take only those; everything else takes the mix. Sharing one index put
      // three of the five on registry stills — 16:9 scenes of dark text on
      // white, cropped to 3:4 — and the hero moment was two blank cards and a
      // label.
      const mix = col * 7 + row * 13;
      // `col * 2 + row` is the one small combination that is injective over the
      // five seed cells modulo five — 7/13 sends (-1,-1) and (0,0) to the same
      // slot, and the two cards diagonally across the label came out identical.
      const seed = col * 2 + row;
      const i =
        ringOf(col, row) === 0
          ? (2 * (((seed % SEED.length) + SEED.length) % SEED.length)) %
            cards.length
          : ((mix % cards.length) + cards.length) % cards.length;
      cells.push({ col, row, x: cx, y: cy, o, i, src: cards[i] ?? "" });
    }
  }

  // The grid cycles `cards`, so one card is drawn many times. Studio outlines
  // the copy nearest the middle of the frame; the others are only pictures of
  // it.
  const nearest = new Map<number, (typeof cells)[number]>();
  const off = (c: (typeof cells)[number]) =>
    Math.hypot(c.x - width / 2, c.y - height / 2);
  for (const c of cells) {
    const held = nearest.get(c.i);
    if (!held || off(c) < off(held)) nearest.set(c.i, c);
  }

  const filled = now * fps >= FILL_AT;
  const pillH = LABEL.height * s * k;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: background,
        fontFamily: SANS,
        overflow: "hidden",
      }}
    >
      {/* A directional blur: the motion is horizontal, and CSS `blur()` is
          round, so it softens the card's top and bottom edges — which are not
          moving — as much as its sides. */}
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
        <title>Motion blur</title>
        <filter
          id="count-grid-smear"
          x="-40%"
          y="-10%"
          width="180%"
          height="120%"
        >
          <feGaussianBlur stdDeviation={`${blur} 0`} />
        </filter>
        <filter
          id="count-grid-late"
          x="-90%"
          y="-10%"
          width="280%"
          height="120%"
        >
          <feGaussianBlur stdDeviation={`${late} 0`} />
        </filter>
      </svg>

      <div
        style={{
          position: "absolute",
          inset: 0,
          filter: blur > 0.35 ? "url(#count-grid-smear)" : undefined,
          ...(getRemotionEnvironment().isRendering
            ? null
            : { willChange: "filter" as const }),
        }}
      >
        {cells.map((c) => (
          <Item
            key={`${c.col},${c.row}`}
            index={c.i}
            primary={nearest.get(c.i) === c}
          >
            <div
              style={{
                position: "absolute",
                left: c.x - cardW / 2,
                top: c.y - cardH / 2,
                width: cardW,
                height: cardH,
                borderRadius: CARD.radius * g * k,
                overflow: "hidden",
                background: "#FFFFFF",
                // A hairline, not a shadow: a drop shadow under forty white
                // tiles on a white page is forty grey smears.
                boxShadow: `inset 0 0 0 ${Math.max(0.5, 0.9 * g * k)}px #ECEFF2`,
                display: "flex",
                alignItems: "center",
                opacity: c.o,
                filter:
                  late > 0.35 &&
                  c.col === LATE_CARD[0] &&
                  c.row === LATE_CARD[1]
                    ? "url(#count-grid-late)"
                    : undefined,
              }}
            >
              {c.src ? (
                <Img
                  src={resolveSrc(c.src)}
                  style={{
                    width: cardW,
                    height: cardH,
                    // Preflight's `img { max-width: 100% }` against a box that
                    // sizes from its content is 100% of nothing — the card
                    // renders zero px wide on the site and perfectly in the mp4.
                    maxWidth: "none",
                    objectFit: "cover",
                  }}
                  alt=""
                />
              ) : null}
            </div>
          </Item>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: at(LABEL.cy, ORIGIN.y) * k + oy - pillH / 2,
          display: "flex",
          justifyContent: "center",
          opacity: label,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: pillH,
            padding: `0 ${LABEL.padX * s * k}px`,
            borderRadius: LABEL.radius * s * k,
            background: "#FFFFFF",
            border: `1px solid ${LABEL.border}`,
            // Not a drop shadow: on a white page under a white pill it reads as
            // a grey smear, and the reference has a hairline and nothing else.
            boxShadow: "none",
            fontSize: LABEL.size * s * k,
            fontWeight: 400,
            lineHeight: 1,
            whiteSpace: "nowrap",
            color: inkFrom,
            textRendering: "geometricPrecision",
          }}
        >
          <span
            style={{
              backgroundImage: `linear-gradient(90deg, ${inkFrom} 0%, ${inkTo} 100%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              paddingBottom: 0.14 * LABEL.size * s * k,
            }}
          >
            {filled ? to : from} {noun}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

export default CountGrid;
