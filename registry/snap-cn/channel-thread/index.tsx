"use client";

import { loadFont as loadSans } from "@remotion/google-fonts/Barlow";
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
  Item,
  mixOklch,
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
  withAlpha,
} from "@/lib/snap-cn-ui";

/**
 * A work chat filling itself in, the way the channel actually reads.
 *
 * Not bubbles: a transcript. An avatar, a name in bold, a quiet timestamp, and
 * the messages under them as plain lines — the shape every team tool has
 * settled on. Messages land one at a time; a second message from the same
 * person joins the group without repeating the name; and when somebody new
 * starts typing, three dots hold their line until the words arrive. The
 * transcript never creeps: it sits perfectly still between arrivals and then
 * scrolls, once, by exactly the room the new line needs.
 *
 * ## The layout came off a recording and it closes to the pixel
 *
 * Four numbers describe every vertical position in the scene, measured on a
 * 638 × 354 capture by thresholding the ink of eighty frames:
 *
 *     name → its first message      37.59
 *     message → message             46.01
 *     last message → next name      69.00
 *     first message, before any scroll, at   158.90
 *
 * That is not a model fitted to the frames, it is *checked* against them. Take
 * the first message's start, add the two arrivals' scroll (46.01 + 2 × 46.01),
 * and the oldest line lands at 20.87; the recording's last frame has it at 21.
 * Carry the same arithmetic down to the newest name and it predicts 138.9 where
 * the recording measures 139.00. Nine tenths of a pixel over a whole scene.
 *
 * ## The scroll is an event, not a drift
 *
 * Between arrivals the transcript is *byte-identical* frame to frame — the
 * measured movement is 0.00px for twenty-nine frames at the head of the clip and
 * for another eight in the middle. Everything that looks like life comes from
 * the arrivals themselves. `SCROLL` is one of those moves, measured: it
 * accelerates for four frames, peaks at 5.1px, and then spends three quarters of
 * a second arriving.
 *
 * A caveat, because it is measured and it is not reproduced: the recording's
 * two-row scroll runs about 1.6× faster in normalised time than its one-row
 * scroll — a longer move that takes *less* time, which is a browser's native
 * smooth-scroll heuristic and not something a scene should imitate. One curve
 * ships, taken from the one-row move, and a two-row move simply travels twice
 * as far along it.
 */

const { fontFamily: SANS } = loadSans("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

/* ─────────────────────────────────────────────────────────────────────────
   The transcript, in the recording's own 638 × 354 pixels
   ───────────────────────────────────────────────────────────────────────── */

export const REF_W = 638;
export const REF_H = 354;

/** Baseline of a group's first message, below the name. */
export const NAME_GAP = 37.59;
/** Baseline to baseline, within a group. */
export const MSG_GAP = 46.01;
/** Last message of a group to the next group's name. */
export const GROUP_GAP = 69;
/** Where the oldest message sits before anything has arrived. */
export const START_Y = 158.9;
/**
 * The line the newest message rests on, and the whole reason the transcript is
 * still between arrivals.
 *
 * It does not scroll on every message — the recording's second message lands
 * with the stack measurably motionless, 0.00px for twenty-nine frames. It
 * scrolls only by however far the newest baseline would fall *past* this line,
 * which is zero until the thread is tall enough to reach it. One constant
 * replaces a per-message "does this one scroll" flag, and it is what makes the
 * arithmetic close: 158.90 + 46.01 is above it and moves nothing; the next two
 * rows put the newest baseline at 311.50 and the scroll settles at exactly
 * 92.02, which is what the recording measures.
 */
export const ANCHOR = 219.48;

/** The avatar is square, and its top sits this far above the name's baseline. */
export const AVATAR = 70;
export const AVATAR_X = 119.5;
export const AVATAR_RISE = 28;
/** Left of the text column's box. Ink starts at 201.1 (name) and 202.4 (body). */
export const TEXT_X = 202;

/** Body type. Cap height measured at 22.40px. */
export const SIZE = 31.2;
/** The timestamp, measured on its digits: cap 18.09. */
export const TIME_SIZE = 24.9;
/** Box top → baseline at `lineHeight: 1`. A face metric, measured, not guessed. */
export const ASC = 28.95;

/** Typing dots: on the line the message will take, a little above its baseline. */
export const DOT = 5;
export const DOT_GAP = 8.4;
export const DOT_RISE = 5.7;
/** A dot every this many seconds, then the ellipsis starts over. */
export const DOT_BEAT = 0.1;
/**
 * Frames between a group's row opening and the group appearing in it.
 *
 * The room is made first and the person arrives into it: the recording starts
 * scrolling on frame 37 and does not paint the avatar, the name or the first
 * dot until frame 40. Three frames is nothing to watch and everything to match,
 * and it is also what the dots are timed from — anchor their cycle to the scroll
 * instead and the ellipsis is a step out of phase for its whole life.
 */
export const LEAD = 3;

/**
 * One arrival's scroll, as (seconds since it started, share of the travel).
 *
 * Recovered by correlating each frame's vertical ink profile against the last —
 * which reads the move off every visible row at once rather than tracking one
 * word — and checked against the absolute baseline of the bold name row, which
 * agrees to a third of a pixel.
 */
export const SCROLL: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.0167, 0.004],
  [0.05, 0.016],
  [0.0833, 0.044],
  [0.1167, 0.093],
  [0.15, 0.178],
  [0.1833, 0.289],
  [0.2167, 0.398],
  [0.25, 0.486],
  [0.2833, 0.557],
  [0.3167, 0.616],
  [0.35, 0.663],
  [0.3833, 0.702],
  [0.4167, 0.737],
  [0.45, 0.767],
  [0.4833, 0.791],
  [0.5167, 0.814],
  [0.55, 0.834],
  [0.5833, 0.852],
  [0.6167, 0.867],
  [0.65, 0.881],
  [0.6917, 0.893],
  [0.7167, 0.903],
  [0.75, 0.912],
  [0.7833, 0.919],
  [1.1, 1],
];

/**
 * How far a line is faded, by its height in the frame.
 *
 * Read as an envelope over the whole clip: the brightest any pixel of a line
 * ever got at each height. Taking the maximum across every frame is what makes
 * it a property of the *position* — one sample would have read a line with no
 * ascenders as a dip in the gradient.
 *
 * It stops at a tenth rather than at nothing: the oldest line is cut off by the
 * frame, not erased by the fade.
 */
export const FADE: readonly (readonly [number, number])[] = [
  [10, 0.098],
  [25, 0.125],
  [40, 0.149],
  [55, 0.216],
  [70, 0.357],
  [85, 0.518],
  [100, 0.651],
  [115, 0.843],
  [140, 0.98],
  [175, 1],
];

type Table = readonly (readonly [number, number])[];

/** Linear read of a rising table, clamped at both ends. */
export function read(table: Table, x: number): number {
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

interface Line {
  /** Baseline in transcript space, before any scroll. */
  y: number;
  /** Baseline of this group's name row, when this line heads a group. */
  nameY: number;
  group: number;
  /** First line of a group, i.e. the one the name and avatar belong to. */
  head: boolean;
  text: string;
  /** Frame the words land on. The row itself opens at `opens`. */
  at: number;
  opens: number;
}

/**
 * Lay the transcript out once, in transcript space.
 *
 * Positions are absolute and never re-flow: the scroll is a single translate
 * over the top of them. That is what lets every arrival be a number rather than
 * a layout pass, and it is why the stack can be perfectly still between them.
 */
export function layout(
  groups: { person: string; time: string; lines: string[] }[],
): Line[] {
  const out: Line[] = [];
  let last = START_Y - NAME_GAP;
  let first = true;
  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    if (!group) continue;
    for (let m = 0; m < group.lines.length; m++) {
      const head = m === 0;
      const nameY = head ? (first ? last : last + GROUP_GAP) : 0;
      const y = head ? nameY + NAME_GAP : last + MSG_GAP;
      out.push({
        y,
        nameY,
        group: g,
        head,
        text: group.lines[m] ?? "",
        at: 0,
        opens: 0,
      });
      last = y;
      first = false;
    }
  }
  return out;
}

/**
 * One message. A message with the same author, time and avatar as the one
 * above it joins that group, under one name, the way the channel reads.
 */
export interface ThreadMessage {
  text: string;
  author?: string;
  time?: string;
  avatar?: string;
  /** Frame the words land on. Default: the measured 0, 12, 60, 84, then every 24. */
  at?: number;
  /**
   * Frame the row opens on, before the words land — typing dots, if it starts
   * a group. Default: the measured 0, 12, 37, 72, then every 24.
   */
  opens?: number;
}

export const DEFAULT_MESSAGES: readonly ThreadMessage[] = [
  ["rhea", "9:41 AM", "07", "Launch video by Thursday?"],
  ["rhea", "9:41 AM", "07", "We have nothing shot."],
  ["sam", "9:42 AM", "13", "Already done."],
  ["sam", "9:42 AM", "13", "Built it out of snapcn."],
].map(([author, time, face, text]) => ({
  author,
  time,
  avatar: `/avatars/${face}.jpg`,
  text: text ?? "",
}));

/** The recording's four arrivals; after them, a message every 24 frames. */
const BEATS = [0, 12, 60, 84];
const OPENS = [0, 12, 37, 72];

/**
 * The string form of `messages`, for the customizer and for quick edits:
 * messages split by `|`, each `avatar > name time > text`. The name runs to
 * the first space. A message that is only text continues the one above it.
 *
 *   "/avatars/07.jpg > rhea 9:41 AM > Launch video? | Nothing shot."
 */
export function toMessages(
  input: readonly ThreadMessage[] | string,
): readonly ThreadMessage[] {
  if (typeof input !== "string") return input;
  let head = { author: "", time: "", avatar: "" };
  return input
    .split("|")
    .filter((m) => m.trim())
    .map((m) => {
      const parts = m.split(">").map((v) => v.trim());
      const text = parts.pop() ?? "";
      const who = parts.pop();
      if (who !== undefined) {
        const cut = who.indexOf(" ");
        head = {
          author: cut < 0 ? who : who.slice(0, cut),
          time: cut < 0 ? "" : who.slice(cut + 1),
          avatar: parts.pop() ?? "",
        };
      }
      return { ...head, text };
    });
}

export interface ChannelThreadProps {
  /** The conversation, in order. Also takes the string form: see `toMessages`. */
  messages?: readonly ThreadMessage[] | string;
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
  fontFamily?: string;
}

export function ChannelThread({
  messages = DEFAULT_MESSAGES,
  theme,
  mode = "dark",
  fontFamily = "Default",
}: ChannelThreadProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily) ?? SANS;

  const u = height / REF_H;
  const ox = (width - REF_W * u) / 2;
  const now = frame / fps;

  const said = toMessages(messages).filter((m) => m.text.trim());
  const groups: {
    person: string;
    time: string;
    avatar: string;
    lines: string[];
  }[] = [];
  for (const m of said) {
    const [person = "", time = "", avatar = ""] = [m.author, m.time, m.avatar];
    const g = groups[groups.length - 1];
    if (g && g.person === person && g.time === time && g.avatar === avatar) {
      g.lines.push(m.text.trim());
    } else {
      groups.push({ person, time, avatar, lines: [m.text.trim()] });
    }
  }

  const lines = layout(groups);
  lines.forEach((l, i) => {
    const m = said[i];
    l.at = m?.at ?? BEATS[i] ?? 84 + 24 * (i - 3);
    l.opens =
      i === 0
        ? Number.NEGATIVE_INFINITY
        : (m?.opens ?? OPENS[i] ?? 72 + 24 * (i - 3));
  });

  // Each opened row moves the target to however far its baseline falls past the
  // anchor. A row that does not reach the anchor moves nothing, which is the
  // stillness in the reference rather than an exception carved out for it.
  let scroll = 0;
  let target = 0;
  for (const l of lines) {
    const want = Math.max(0, l.y - ANCHOR);
    const step = want - target;
    target = want;
    if (step <= 0) continue;
    // A longer move takes *less* time, not more — measured, twice: the two-row
    // scroll runs 1.60× faster in normalised time than the one-row scroll, which
    // is what a browser's native smooth scroll does with distance and what the
    // recording therefore does. One curve, read faster the further it has to go.
    const rate = (step / MSG_GAP) ** 0.68;
    scroll += step * read(SCROLL, (now - l.opens / fps) * rate);
  }

  const ink = t.foreground;
  const dim = t.mutedForeground;

  return (
    <AbsoluteFill style={{ backgroundColor: t.background }}>
      <div
        style={{
          position: "absolute",
          left: ox,
          top: 0,
          width: REF_W * u,
          height: REF_H * u,
          fontFamily: face,
          // Hinting re-snaps every stem as a line slides past, and the
          // letterforms boil. This renders the outline as it actually is.
          textRendering: "geometricPrecision",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {lines.map((l, i) => {
          const y = l.y - scroll;
          if (y < -MSG_GAP || y > REF_H + MSG_GAP) return null;
          const shown = frame >= l.at;
          if (frame < l.opens) return null;
          const arrived = frame >= l.opens + LEAD;
          const g = groups[l.group];
          const nameA = read(FADE, y - NAME_GAP);
          const bodyA = read(FADE, y);
          return (
            <div key={`${l.group}-${i}`}>
              {l.head && g && arrived && (
                <>
                  <Avatar
                    src={g.avatar}
                    name={g.person}
                    y={(y - NAME_GAP - AVATAR_RISE) * u}
                    u={u}
                    t={t}
                    alpha={read(FADE, y - NAME_GAP - AVATAR_RISE + AVATAR / 2)}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: TEXT_X * u,
                      top: (y - NAME_GAP - ASC) * u,
                      fontSize: SIZE * u,
                      lineHeight: 1,
                      fontWeight: 700,
                      color: ink,
                      // Per row, not per group. The name sits 37.59px above its
                      // first message and the gradient moves measurably over
                      // that distance — sharing one opacity between them reads
                      // as a name that refuses to leave.
                      opacity: nameA,
                    }}
                  >
                    {g.person}
                    <span
                      style={{
                        fontSize: TIME_SIZE * u,
                        fontWeight: 500,
                        color: dim,
                        // The timestamp rides the name's baseline, so it is one
                        // inline run and not a second absolutely-placed box to
                        // keep in step when the name's width changes.
                        marginLeft: 13.4 * u,
                      }}
                    >
                      {g.time}
                    </span>
                  </div>
                </>
              )}
              {shown ? (
                // The message is the object Studio selects: its body line, by
                // its index across the whole conversation.
                <Item index={i}>
                  <div
                    style={{
                      position: "absolute",
                      left: TEXT_X * u,
                      top: (y - ASC) * u,
                      fontSize: SIZE * u,
                      lineHeight: 1,
                      color: ink,
                      opacity: bodyA,
                    }}
                  >
                    {l.text}
                  </div>
                </Item>
              ) : (
                l.head &&
                arrived && (
                  <Dots
                    y={(y - DOT_RISE) * u}
                    u={u}
                    colour={mixOklch(dim, ink, 0.3)}
                    since={now - (l.opens + LEAD) / fps}
                    alpha={bodyA}
                  />
                )
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

/** Three dots that arrive one at a time, then start over. */
function Dots({
  y,
  u,
  colour,
  since,
  alpha,
}: {
  y: number;
  u: number;
  colour: string;
  since: number;
  alpha: number;
}) {
  const step = Math.floor((since % (DOT_BEAT * 4)) / DOT_BEAT);
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: (TEXT_X + 3.3 + i * DOT_GAP) * u,
            top: y - (DOT / 2) * u,
            width: DOT * u,
            height: DOT * u,
            borderRadius: "50%",
            background: colour,
            opacity: i < step ? alpha : 0,
          }}
        />
      ))}
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
 * An avatar that holds the render until it has actually loaded.
 *
 * Without this a frame can be captured before the picture arrives and the
 * square comes out empty — invisible in the Player, where an image simply
 * appears, and silent in an mp4 until somebody watches it. Remotion's own `Img`
 * is avoided for the reason `hero-launch` documents: it awaits `decode()`, which
 * the headless compositor rejects for some progressive JPEGs and hangs the
 * export. `onError` releases too, so a bad source degrades to a missing picture
 * rather than a stuck render.
 */
function Face({ src, style }: { src: string; style: CSSProperties }) {
  const [handle] = useState(() => delayRender(`channel avatar: ${src}`));
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

/** The person's picture, or their initial on a tinted square when there is none. */
function Avatar({
  src,
  name,
  y,
  u,
  t,
  alpha,
}: {
  src: string;
  name: string;
  y: number;
  u: number;
  t: SnapCnTheme;
  alpha: number;
}) {
  const box = {
    position: "absolute" as const,
    left: AVATAR_X * u,
    top: y,
    width: AVATAR * u,
    height: AVATAR * u,
    borderRadius: 8 * u,
    overflow: "hidden" as const,
    opacity: alpha,
  };
  if (src) return <Face src={src} style={{ ...box, objectFit: "cover" }} />;
  return (
    <div
      style={{
        ...box,
        // A tinted tile with the accent's own letter on it: legible on either
        // theme, and it moves with a user's palette instead of inventing a grey.
        // An alpha tint rather than a mix — the page is a near-neutral, its hue
        // in oklch is undefined, and interpolating toward the accent through it
        // comes out somewhere else entirely. Measured: a blue accent over the
        // warm off-white page mixed to a pale *green*.
        background: withAlpha(t.primary, 0.16),
        color: t.primary,
        fontSize: AVATAR * 0.45 * u,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
