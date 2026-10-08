"use client";

import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
} from "remotion";
import { type SnapCnTheme, useSnapCnTheme } from "@/lib/snap-cn-ui";

/**
 * A launch title that decodes and then can't decide what it's wearing.
 * Scrambled glyphs from the wrong typeface flicker into place, the line
 * lands in the accent, settles to ink and holds, then the second half
 * cycles through a run of typefaces while the whole line steps closer.
 *
 * ## Everything here was measured off a recording, frame by frame
 *
 * A 2.03s, 638 × 358 screen capture (68 frames, 60fps then 30fps) was
 * decoded in BT.709 and every state was fitted by rendering candidate type in
 * Chrome, box-downsampling from 4×, blurring by the capture's own σ 0.65px
 * (measured on the pixel face's square edges) and least-squaring against it:
 *
 *   - the capture is a sequence of HELD states, not tweens. Every change lands
 *     on a 30fps frame boundary, and between changes consecutive frames
 *     differ only by codec noise. `BEATS` below is that timeline.
 *   - the decode is the real line set in a Baskerville, with a per-character
 *     visibility mask and oversized foreign glyphs (`b`, `e`, `a` …) that
 *     persist from one beat to the next. Masks and extras were read glyph by
 *     glyph and re-fitted for position, size and weight.
 *   - the purple is one colour, `#9b8ed3`, measured on both purple beats.
 *   - the line is centred (x ≈ 317.5 on every beat, the capture is 1.5px off
 *     centre) and every font swap is also a zoom about the frame's middle:
 *     ×1.028, 1.086, 1.111, 1.152, 1.249 on the serif's own size.
 *
 * ## The type is the closest free match, not the original
 *
 * The recording's faces are not on Google Fonts. Each was fingerprinted
 * against every Google family in its category and the best free match taken:
 * Source Serif 4 (opsz 16) for the line, Libre Baskerville for the decode,
 * Fragment Mono, Hind, Coral Pixels and Mona Sans for the swaps. Geometry and
 * timing are the recording's; glyph shapes are as close as free type gets.
 * The six faces between the pixel and the grotesk are an extension, not
 * measured: Pacifico, Zilla Slab, Bebas Neue, Playfair Display italic,
 * UnifrakturMaguntia and Unbounded.
 */

/* ─────────────────────────────────────────────────────────────────────────
   The scene, in the reference's own 638 × 358 pixels and 30fps frames
   ───────────────────────────────────────────────────────────────────────── */

export const REF_W = 638;
export const REF_H = 358;

const CDN = "https://cdn.jsdelivr.net/npm";

/** Every face the scene draws in, loaded as one `FontFace` each. */
export const FACES = {
  serif: {
    family: "Font Shuffle Serif",
    src: `${CDN}/@fontsource-variable/source-serif-4@5.3.0/files/source-serif-4-latin-opsz-normal.woff2`,
    weight: "200 900",
    settings: "\"opsz\" 16",
  },
  glitch: {
    family: "Font Shuffle Glitch",
    src: `${CDN}/@fontsource-variable/libre-baskerville@5.3.0/files/libre-baskerville-latin-wght-normal.woff2`,
    weight: "400 700",
  },
  mono: {
    family: "Font Shuffle Mono",
    src: `${CDN}/@fontsource-variable/source-code-pro@5.3.0/files/source-code-pro-latin-wght-normal.woff2`,
    weight: "200 900",
  },
  light: {
    family: "Font Shuffle Light",
    src: `${CDN}/@fontsource-variable/inter@5.3.0/files/inter-latin-wght-normal.woff2`,
    weight: "100 900",
  },
  humanist: {
    family: "Font Shuffle Humanist",
    src: `${CDN}/@fontsource/hind@5.3.0/files/hind-latin-400-normal.woff2`,
    weight: "400",
  },
  pixel: {
    family: "Font Shuffle Pixel",
    src: `${CDN}/@fontsource/vt323@5.3.0/files/vt323-latin-400-normal.woff2`,
    weight: "400",
  },
  grotesk: {
    family: "Font Shuffle Grotesk",
    src: `${CDN}/@fontsource-variable/mona-sans@5.3.0/files/mona-sans-latin-wght-normal.woff2`,
    weight: "200 900",
  },
  // The run added after the recording's five: script, slab, condensed, italic,
  // blackletter and wide. Each one is as far from its neighbours as type gets.
  script: {
    family: "Font Shuffle Script",
    src: `${CDN}/@fontsource/pacifico@5.2.5/files/pacifico-latin-400-normal.woff2`,
    weight: "400",
  },
  slab: {
    family: "Font Shuffle Slab",
    src: `${CDN}/@fontsource/zilla-slab@5.2.5/files/zilla-slab-latin-600-normal.woff2`,
    weight: "600",
  },
  condensed: {
    family: "Font Shuffle Condensed",
    src: `${CDN}/@fontsource/bebas-neue@5.2.5/files/bebas-neue-latin-400-normal.woff2`,
    weight: "400",
  },
  italic: {
    family: "Font Shuffle Italic",
    src: `${CDN}/@fontsource-variable/playfair-display@5.2.5/files/playfair-display-latin-wght-italic.woff2`,
    weight: "400 900",
  },
  blackletter: {
    family: "Font Shuffle Blackletter",
    src: `${CDN}/@fontsource/unifrakturmaguntia@5.2.5/files/unifrakturmaguntia-latin-400-normal.woff2`,
    weight: "400",
  },
  wide: {
    family: "Font Shuffle Wide",
    src: `${CDN}/@fontsource-variable/unbounded@5.2.5/files/unbounded-latin-wght-normal.woff2`,
    weight: "200 900",
  },
} as const;

export type FaceKey = keyof typeof FACES;

/** One run of type: face, size and weight in reference px, tracking, word gap. */
export interface Run {
  face: FaceKey;
  size: number;
  weight: number;
  /** letter-spacing, px */
  track: number;
  /** word-spacing added to the face's own space, px */
  space?: number;
}

/** A foreign glyph laid over the decode, anchored to a character of the line. */
export interface Extra {
  ch: string;
  /** Index into the reference line it sits on. */
  at: number;
  /** Offset from that character's start, px. */
  dx: number;
  base: number;
  size: number;
  weight: number;
}

export type Beat =
  | {
      kind: "glitch";
      run: Run;
      /** Centre of the line's advance box. */
      cx: number;
      base: number;
      /** Indices of the reference line that are drawn. */
      show: number[];
      extras: Extra[];
    }
  | {
      kind: "pair";
      lead: Run;
      subject: Run;
      leadBase: number;
      subjectBase: number;
      /** Between the end of the lead's advance and the subject's start. */
      gap: number;
      cx: number;
      accent: boolean;
      /** Indices of `lead + " " + subject` that are held back (drawn clear). */
      hide?: number[];
    };

/** The reference line the masks and anchors were read on: 24 characters. */
const REF_LEN = 24;

/** The frame each beat starts on (30fps), and the beat. Read off the capture. */
export const BEATS: [number, Beat][] = [
  [
    0,
    {
      kind: "glitch",
      run: { face: "glitch", size: 28.25, weight: 416, track: -0.94 },
      cx: 317.597,
      base: 186.43,
      show: [2, 4, 7, 10, 14, 17, 19, 22],
      extras: [
        { ch: "i", at: 1, dx: -2.643, base: 189.25, size: 33.95, weight: 700 },
        { ch: "l", at: 1, dx: 7.527, base: 189.55, size: 35.55, weight: 691 },
        { ch: "e", at: 5, dx: 4.176, base: 189.59, size: 36.56, weight: 670 },
        { ch: "b", at: 11, dx: -1.19, base: 189.73, size: 36.46, weight: 400 },
        { ch: "a", at: 20, dx: -3.586, base: 190.12, size: 35.92, weight: 641 },
        { ch: "e", at: 23, dx: 22.728, base: 189.5, size: 36.53, weight: 673 },
      ],
    },
  ],
  [
    2,
    {
      kind: "glitch",
      run: { face: "glitch", size: 28.8, weight: 401, track: -0.12 },
      cx: 317.722,
      base: 186.78,
      show: [0, 1, 2, 4, 7, 9, 10, 13, 14, 15, 17, 19, 22, 23],
      extras: [
        { ch: "b", at: 11, dx: -1.886, base: 191.01, size: 40.27, weight: 523 },
        { ch: "e", at: 23, dx: 26.711, base: 190.38, size: 39.71, weight: 635 },
      ],
    },
  ],
  [
    4,
    {
      kind: "pair",
      lead: { face: "serif", size: 38.31, weight: 489, track: -1.144 },
      subject: { face: "serif", size: 38.31, weight: 489, track: -1.144 },
      leadBase: 188.26,
      subjectBase: 188.26,
      gap: 7.719,
      cx: 317.543,
      accent: true,
      hide: [3, 6, 16],
    },
  ],
  [
    6,
    {
      kind: "pair",
      lead: { face: "serif", size: 41.98, weight: 502, track: -1.325 },
      subject: { face: "serif", size: 41.98, weight: 502, track: -1.325 },
      leadBase: 189.35,
      subjectBase: 189.35,
      gap: 8.375,
      cx: 317.475,
      accent: true,
    },
  ],
  [
    7,
    {
      kind: "pair",
      lead: { face: "serif", size: 42, weight: 573, track: -1.4 },
      subject: { face: "serif", size: 42, weight: 573, track: -1.4, space: 1.263 },
      leadBase: 189.29,
      subjectBase: 189.29,
      gap: 9.951,
      cx: 317.943,
      accent: false,
    },
  ],
  [
    32,
    {
      kind: "pair",
      lead: { face: "serif", size: 43.48, weight: 511, track: -1.273 },
      subject: { face: "mono", size: 39.96, weight: 354, track: -2.741, space: 0.765 },
      leadBase: 189.603,
      subjectBase: 189.296,
      gap: 6.927,
      cx: 317.275,
      accent: false,
    },
  ],
  [
    35,
    {
      kind: "pair",
      lead: { face: "serif", size: 45.898, weight: 546, track: -1.673 },
      subject: { face: "light", size: 42.488, weight: 392, track: -0.819, space: 5.88 },
      leadBase: 190.225,
      subjectBase: 189.492,
      gap: 11.558,
      cx: 316.424,
      accent: false,
    },
  ],
  [
    39,
    {
      kind: "pair",
      lead: { face: "serif", size: 46.968, weight: 509, track: -1.21 },
      subject: { face: "humanist", size: 46.707, weight: 400, track: 0.936, space: -0.358 },
      leadBase: 190.563,
      subjectBase: 190.696,
      gap: 12.875,
      cx: 315.741,
      accent: false,
    },
  ],
  [
    43,
    {
      kind: "pair",
      lead: { face: "serif", size: 48.696, weight: 518, track: -1.197 },
      subject: { face: "pixel", size: 67.469, weight: 400, track: -2.468, space: -4.337 },
      leadBase: 190.919,
      subjectBase: 191.087,
      gap: 5.67,
      cx: 316.477,
      accent: false,
    },
  ],
  [
    47,
    {
      kind: "pair",
      lead: { face: "serif", size: 49.285, weight: 524, track: -1.26 },
      subject: { face: "script", size: 45.342, weight: 400, track: 0.0 },
      leadBase: 191.071,
      subjectBase: 191.071,
      gap: 11,
      cx: 316.4,
      accent: false,
    },
  ],
  [
    51,
    {
      kind: "pair",
      lead: { face: "serif", size: 49.875, weight: 530, track: -1.32 },
      subject: { face: "slab", size: 53.865, weight: 600, track: -0.8 },
      leadBase: 191.223,
      subjectBase: 191.223,
      gap: 11,
      cx: 316.4,
      accent: false,
    },
  ],
  [
    54,
    {
      kind: "pair",
      lead: { face: "serif", size: 50.464, weight: 536, track: -1.38 },
      subject: { face: "condensed", size: 60.557, weight: 400, track: 0.6 },
      leadBase: 191.375,
      subjectBase: 191.375,
      gap: 11,
      cx: 316.4,
      accent: false,
    },
  ],
  [
    58,
    {
      kind: "pair",
      lead: { face: "serif", size: 51.054, weight: 541, track: -1.44 },
      subject: { face: "italic", size: 53.096, weight: 560, track: -0.8 },
      leadBase: 191.528,
      subjectBase: 191.528,
      gap: 11,
      cx: 316.4,
      accent: false,
    },
  ],
  [
    61,
    {
      kind: "pair",
      lead: { face: "serif", size: 51.643, weight: 547, track: -1.5 },
      subject: { face: "blackletter", size: 59.389, weight: 400, track: 0.0 },
      leadBase: 191.68,
      subjectBase: 191.68,
      gap: 11,
      cx: 316.4,
      accent: false,
    },
  ],
  [
    65,
    {
      kind: "pair",
      lead: { face: "serif", size: 52.233, weight: 553, track: -1.56 },
      subject: { face: "wide", size: 41.786, weight: 520, track: -1.4 },
      leadBase: 191.832,
      subjectBase: 191.832,
      gap: 11,
      cx: 316.4,
      accent: false,
    },
  ],
  [
    69,
    {
      kind: "pair",
      lead: { face: "serif", size: 52.822, weight: 559, track: -1.594 },
      subject: { face: "grotesk", size: 51.994, weight: 575, track: -1.689, space: 0.327 },
      leadBase: 191.984,
      subjectBase: 192.782,
      gap: 11.638,
      cx: 316.37,
      accent: false,
    },
  ],
];

/**
 * Frames 0–43 are the recording's, with its 1.2s hold before the first swap
 * cut to 0.8s; 47–65 are six more faces at the same three-to-four-frame
 * cadence and the same zoom per step (lead size and baseline interpolated
 * between the pixel and grotesk beats). The grotesk is still the landing,
 * held 1.5s.
 */
export const SCENE_FRAMES = 115;

/**
 * A reference index for character `i` of an `n`-character line. The masks and
 * anchors were read on the 24-character original; a longer or shorter line
 * samples them proportionally, so the decode keeps its density and rhythm.
 */
function refIndex(i: number, n: number): number {
  return n <= 1 ? 0 : Math.round((i * (REF_LEN - 1)) / (n - 1));
}
function ownIndex(r: number, n: number): number {
  return n <= 1 ? 0 : Math.round((r * (n - 1)) / (REF_LEN - 1));
}

/* ─────────────────────────────────────────────────────────────────────────
   Fonts and measurement
   ───────────────────────────────────────────────────────────────────────── */

let facesLoad: Promise<unknown> | null = null;
function loadFaces(): Promise<unknown> {
  if (facesLoad) return facesLoad;
  if (typeof FontFace === "undefined") {
    facesLoad = Promise.resolve();
    return facesLoad;
  }
  facesLoad = Promise.all(
    Object.values(FACES)
      .filter((f) => f.src)
      .map((f) => {
        const face = new FontFace(f.family, `url(${f.src}) format("woff2")`, {
          weight: f.weight,
        });
        document.fonts.add(face);
        // A face that fails to load falls back to the next in the stack —
        // the scene still plays, in the wrong clothes.
        return face.load().catch(() => undefined);
      }),
  );
  return facesLoad;
}

function runStyle(run: Run): CSSProperties {
  const face = FACES[run.face];
  return {
    fontFamily: `"${face.family}", serif`,
    fontSize: run.size,
    fontWeight: run.weight,
    letterSpacing: run.track,
    wordSpacing: run.space ?? 0,
    fontVariationSettings: "settings" in face ? face.settings : undefined,
    whiteSpace: "pre",
    // Unhinted outlines: a held state that re-snaps its stems at another
    // render size is a different picture.
    textRendering: "geometricPrecision",
  };
}

interface Measured {
  /** Per beat: [lead width, subject width] or [line width, char starts…]. */
  widths: number[][];
}

/**
 * Every width the layout needs, read once off hidden SVG text in the scene's
 * own units. Canvas cannot pin `opsz`, so it would measure a different cut.
 */
function useMeasure(
  lead: string,
  subject: string,
): [Measured | null, RefObject<SVGGElement | null>] {
  const probe = useRef<SVGGElement>(null);
  const [m, setM] = useState<Measured | null>(null);
  const [handle] = useState(() => delayRender("font-shuffle: measure"));
  useLayoutEffect(() => {
    let live = true;
    loadFaces()
      .then(() => document.fonts.ready)
      .then(() => {
        if (!live || !probe.current) return;
        const groups = probe.current.querySelectorAll<SVGGElement>("g[data-beat]");
        const widths = Array.from(groups, (g) => {
          const texts = g.querySelectorAll("text");
          if (g.dataset.beat === "glitch") {
            const t = texts[0]!;
            const n = t.getNumberOfChars();
            const starts: number[] = [];
            for (let i = 0; i < n; i++) starts.push(t.getStartPositionOfChar(i).x);
            return [t.getComputedTextLength(), ...starts];
          }
          return Array.from(texts, (t) => t.getComputedTextLength());
        });
        setM({ widths });
        continueRender(handle);
      });
    return () => {
      live = false;
    };
  }, [lead, subject, handle]);
  return [m, probe];
}

/* ─────────────────────────────────────────────────────────────────────────
   The component
   ───────────────────────────────────────────────────────────────────────── */

export interface FontShuffleProps {
  /** The fixed half of the line, set in the serif throughout. */
  lead?: string;
  /** The half that tries on typefaces. */
  subject?: string;
  /** The colour the line lands in before it settles to ink. */
  accent?: string;
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
}

export function FontShuffle({
  lead = "Introducing",
  subject = "snapcn Pro",
  accent = "#9b8ed3",
  theme,
  mode = "light",
}: FontShuffleProps) {
  const frame = useCurrentFrame();
  const t = useSnapCnTheme(theme, mode);
  const line = `${lead} ${subject}`;
  const n = line.length;
  const [m, probe] = useMeasure(lead, subject);

  const index = BEATS.findLastIndex(([at]) => frame >= at);
  const beat = BEATS[Math.max(0, index)]![1];
  const w = m?.widths[Math.max(0, index)];

  let content: ReactNode = null;
  if (w && beat.kind === "glitch") {
    const [width, ...starts] = w;
    const x0 = beat.cx - width! / 2;
    const shown = new Set(beat.show);
    content = (
      <g fill={t.foreground}>
        <text x={x0} y={beat.base} style={runStyle(beat.run)}>
          {[...line].map((ch, i) => (
            <tspan key={i} fillOpacity={shown.has(refIndex(i, n)) ? 1 : 0}>
              {ch}
            </tspan>
          ))}
        </text>
        {beat.extras.map((e, k) => {
          const at = Math.min(n - 1, ownIndex(e.at, n));
          return (
            <text
              key={k}
              x={x0 + (starts[at] ?? 0) + e.dx}
              y={e.base}
              style={runStyle({ ...beat.run, size: e.size, weight: e.weight, track: 0 })}
            >
              {e.ch}
            </text>
          );
        })}
      </g>
    );
  } else if (w && beat.kind === "pair") {
    const [wl = 0, ws = 0] = w;
    const x0 = beat.cx - (wl + beat.gap + ws) / 2;
    const hidden = new Set(beat.hide ?? []);
    const chars = (text: string, offset: number) =>
      [...text].map((ch, i) => (
        <tspan
          key={i}
          fillOpacity={hidden.has(refIndex(offset + i, n)) ? 0 : 1}
        >
          {ch}
        </tspan>
      ));
    content = (
      <g fill={beat.accent ? accent : t.foreground}>
        <text x={x0} y={beat.leadBase} style={runStyle(beat.lead)}>
          {chars(lead, 0)}
        </text>
        <text
          x={x0 + wl + beat.gap}
          y={beat.subjectBase}
          style={runStyle(beat.subject)}
        >
          {chars(subject, lead.length + 1)}
        </text>
      </g>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: t.background }}>
      <svg
        viewBox={`0 0 ${REF_W} ${REF_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
        aria-label={line}
        role="img"
      >
        {content}
        <g ref={probe} opacity={0} aria-hidden>
          {BEATS.map(([at, b]) =>
            b.kind === "glitch" ? (
              <g key={at} data-beat="glitch">
                <text style={runStyle(b.run)}>{line}</text>
              </g>
            ) : (
              <g key={at} data-beat="pair">
                <text style={runStyle(b.lead)}>{lead}</text>
                <text style={runStyle(b.subject)}>{subject}</text>
              </g>
            ),
          )}
        </g>
      </svg>
    </AbsoluteFill>
  );
}
