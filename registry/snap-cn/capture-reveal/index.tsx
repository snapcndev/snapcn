"use client";

import { loadFont as loadDmSans } from "@remotion/google-fonts/DMSans";
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  getRemotionEnvironment,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  mixOklch,
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";

/**
 * A screenshot being taken: "Capturing selection… 79%" counts up in a toast
 * over a browser window, the window drops away and shrinks, the toast pops to
 * "Copied to clipboard." and a two-line headline rises out from behind the
 * window while the cursor glides up to the toast.
 *
 * ## Everything here was measured off a recording, frame by frame
 *
 * The numbers below are not taste. They were recovered from a 1.21 second,
 * 714 × 394, 24fps screen capture (29 frames) by fitting renders of each
 * element to it in BT.709 Y′CbCr, through the capture's own blur (σ 0.62px):
 *
 *   - the window is ONE transform about a fixed origin: a 107.9px drop and a
 *     15.8% shrink on the same curve, `cubic-bezier(0.549, 0.228, 0.136,
 *     0.938)` over 19.16 frames (0.06px RMS), and then a slow exponential
 *     shrink (τ 1.2s) that starts the frame the drop lands (0.03% RMS).
 *   - the cursor glides on its own in-out curve over 19.5 frames and then
 *     keeps drifting up — a hand that has not quite stopped (0.07px RMS).
 *   - the "Copied" toast pops from 0.905 to 1 on `cubic-bezier(0.301, 1.056,
 *     0.803, 1)` over 22.8 frames. The "Capturing" toast is the same curve run
 *     the other way: it presses in to 0.881 while the counter runs, which is
 *     why the swap reads as a release.
 *   - the headline does not scale and does not blur. It rises 22.6px on
 *     `cubic-bezier(0.114, 1, 0.665, 1)` over 24 frames and fades in on a
 *     faster curve of its own, from behind the window.
 *   - the counter is linear: +3% a frame, 1% → 100%.
 *
 * The recording starts mid-count, so the 1.33s before its first frame — the
 * toast arriving and pressing in — is built from the same curves, not
 * measured. Everything after is the recording.
 *
 * ## The type is DM Sans, at the optical sizes the recording used
 *
 * Fingerprinted against thirty faces: DM Sans at opsz 40 is the closest free
 * match for the headline, and DM Sans at opsz 9 for the toast. The opsz axis is
 * pinned per element rather than left to `font-optical-sizing`, so a render at
 * any resolution draws the letterforms the recording has — a 1080p render
 * would otherwise give the toast its display cut.
 */

const { fontFamily: DM_SANS } = loadDmSans("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

/** DM Sans with its `opsz` axis, which the Google CSS API does not serve. */
const FACE = "Capture Reveal DM Sans";
const FACE_URL =
  "https://cdn.jsdelivr.net/npm/@fontsource-variable/dm-sans@5.3.0/files/dm-sans-latin-opsz-normal.woff2";
let faceLoad: Promise<unknown> | null = null;
function loadFace(): Promise<unknown> {
  if (faceLoad) return faceLoad;
  if (typeof FontFace === "undefined") {
    faceLoad = Promise.resolve();
    return faceLoad;
  }
  const face = new FontFace(FACE, `url(${FACE_URL}) format("woff2")`, {
    weight: "100 1000",
  });
  document.fonts.add(face);
  // A face that fails to load leaves Google's DM Sans to paint — close, not exact.
  faceLoad = face.load().catch(() => undefined);
  return faceLoad;
}

/* ─────────────────────────────────────────────────────────────────────────
   The scene, in the reference's own 714 × 394 pixels and 24fps frames
   ───────────────────────────────────────────────────────────────────────── */

export const REF_W = 714;
export const REF_H = 394;
/** The recording's frame rate. Every time below is in its frames, "beats". */
export const BEATS = 24;
/** Where the recording's first frame sits on this scene's clock, in beats. */
export const REF_AT = 32;
/** The scene's length in beats: the recording's 29, a held tail, and the lead-in. */
export const SCENE_BEATS = 104;

/** The page: a 45px grid, fainter across than down — measured per line. */
export const GRID = {
  x0: 12.85,
  dx: 45.379,
  y0: 16.44,
  dy: 45.245,
  /** Ink of one line, as a mix toward `foreground` at 1px. */
  across: 0.0275,
  down: 0.0149,
};

/** The window at rest: its box, top corners, and the shadow it casts. */
export const WIN = { x: 152.34, y: 106.57, w: 400.76, r: 9 };
export const WIN_SHADOW = { dy: 5.9, blur: 10.07, spread: -1.21, alpha: 0.207 };
/** The point the window scales about — its centre, on the measured 508.5 box. */
export const WIN_ORIGIN = [352.85, 361.33] as const;
/** The drop: how far, and the shrink that rides the same curve. */
export const DROP = 107.905;
export const SHRINK = 0.1581;
export const DROP_AT = 0.154;
export const DROP_FOR = 19.16;
export const DROP_EASE = Easing.bezier(0.5492, 0.2279, 0.1361, 0.9381);
/** The slow shrink after the drop lands. */
export const SETTLE = 0.0267;
export const SETTLE_AT = 18.62;
export const SETTLE_TAU = 28.94;

/** The cursor's tip, where it glides, and the drift after. */
export const CURSOR_FROM = [573.334, 189.634] as const;
export const CURSOR_BY = [-83.28, -111.49] as const;
export const CURSOR_AT = -0.03;
export const CURSOR_FOR = 19.5;
export const CURSOR_EASE = Easing.bezier(0.54, 0.1, 0.41, 0.97);
export const DRIFT = [-0.16, -0.43] as const;
export const DRIFT_AT = 19;
/** The arrowhead, from its tip: right point, notch, heel. Fitted outline. */
export const ARROW: readonly (readonly [number, number])[] = [
  [0, 0],
  [14.779, 15.455],
  [5.855, 15.72],
  [0.051, 21.146],
];
export const ARROW_OUTLINE = 1.194;
export const ARROW_SHADOW = {
  dx: -1.571,
  dy: 1.45,
  sigma: 0.716,
  alpha: 0.247,
};

/** The headline: centre, the middle of its block, and the type. */
export const HEAD = {
  x: 353.64,
  mid: 188.619,
  pitch: 45.304,
  size: 45.93,
  weight: 367,
  track: 0.952,
  opsz: 40,
  /** Its ink, as a mix from `foreground` toward `mutedForeground`: #2b2b2b. */
  ink: 0.29,
};
export const RISE = 22.585;
export const RISE_AT = 7.342;
export const RISE_FOR = 23.972;
export const RISE_EASE = Easing.bezier(0.114, 1, 0.665, 1);
export const FADE_AT = 8;
export const FADE_FOR = 8.322;
export const FADE_EASE = Easing.bezier(0, 0.235, 0.166, 1);

/** Both toasts share a surface and a type style. */
export const TOAST = {
  h: 49.357,
  r: 8.879,
  shadow: { dy: 0.012, blur: 14.549, spread: -2.397, alpha: 0.2512 },
  size: 12.46,
  weight: 347,
  track: -0.192,
  opsz: 9,
};
/** "Copied": centre, and its row laid out from the box's left edge. */
export const COPIED = {
  at: [357.7, 62.904] as const,
  check: { x: 21.371, dy: 0.005, r: 7.143, stroke: 1.124 },
  /** The tick, from the circle's centre. */
  tick: [
    [-3.232, 0.238],
    [-0.916, 2.835],
    [3.193, -2.28],
  ] as const,
  text: { x: 38.469, base: 3.445 },
  right: 18.464,
};
/**
 * "Capturing": centre and scale at rest, and its row from the box's left edge.
 * The counter gets the width of "100%" whatever it reads, so the box does not
 * twitch as the digits change — with the same 10px either side of it.
 */
export const CAPTURING = {
  at: [353.221, 63.002] as const,
  scale: 0.8855,
  icon: { x: 20.957, dy: -1.09 },
  text: { x: 39.039, base: 3.665 },
  gap: 10.067,
  right: 10.067,
  percent: { base: 4.731 },
};
/** The selection mark: a back sheet, a front sheet, and the hole in it. */
export const MARK = {
  back: { x: -3.632, y: -5.94, w: 12.544, h: 8.869, r: 0 },
  front: { x: -5.511, y: -4.839, w: 8.548, h: 13.549, r: 0.903 },
  hole: { x: -3.325, y: -3.619, w: 6.185, h: 6.381, r: 0 },
};
/**
 * The toast's greys, as mixes of the theme's own: on the default light theme
 * they land on the recording's #474747 / #4f4f4f / #d0d0d0 / #c9c9c9.
 */
export const INK = {
  copied: 0.615,
  capturing: 0.705,
  percent: 0.6975,
  mark: 0.6525,
};
/** The swap, and the pop both toasts ride. */
export const SWAP_AT = 7.5;
export const POP_FROM = 0.9053;
export const POP_FOR = 22.84;
export const POP_EASE = Easing.bezier(0.3012, 1.056, 0.8028, 1.0);
/** The lead-in nobody recorded: the toast arrives, then presses in. */
export const TOAST_IN = -26;
export const PRESS_AT = -24;
/** The counter: 1% at `TOAST_IN`, three a frame. */
export const COUNT_RATE = 3;

const unit = (v: number) => Math.min(1, Math.max(0, v));
const ease = (f: (t: number) => number, at: number, dur: number, n: number) =>
  f(unit((n - at) / dur));

/** The window's drop and scale at beat `n`. */
export function windowAt(n: number): { drop: number; scale: number } {
  const p = ease(DROP_EASE, DROP_AT, DROP_FOR, n);
  const settle =
    n > SETTLE_AT ? SETTLE * (1 - Math.exp(-(n - SETTLE_AT) / SETTLE_TAU)) : 0;
  return { drop: DROP * p, scale: 1 - SHRINK * p - settle };
}

/** The cursor tip at beat `n`. */
export function cursorAt(n: number): [number, number] {
  const p = ease(CURSOR_EASE, CURSOR_AT, CURSOR_FOR, n);
  const d = Math.max(0, n - DRIFT_AT);
  return [
    CURSOR_FROM[0] + CURSOR_BY[0] * p + DRIFT[0] * d,
    CURSOR_FROM[1] + CURSOR_BY[1] * p + DRIFT[1] * d,
  ];
}

/** The headline's rise (px still to climb) and opacity at beat `n`. */
/**
 * The outro — not in the recording, built from its curves: once everything has
 * settled, the window slides out of the bottom of the frame on the drop's own
 * curve, the toast and cursor fade out on the headline's fade run backwards,
 * and the headline pushes forward to the middle of the frame.
 */
export const OUTRO_AT = 40;
/** How far the window falls on its way out, past the frame's bottom edge. */
export const OUTRO_DROP = 240;
/** The headline's push: scale, and the frame-middle it settles on. */
export const OUTRO_SCALE = 1.3;
export const OUTRO_MID = REF_H / 2;

/** Outro progress at beat `n`: the drop (window, headline) and the fade. */
export function outroAt(n: number): { p: number; fade: number } {
  return {
    p: ease(DROP_EASE, OUTRO_AT, DROP_FOR, n),
    fade: n < OUTRO_AT ? 1 : 1 - ease(FADE_EASE, OUTRO_AT, FADE_FOR, n),
  };
}

export function headlineAt(n: number): { rise: number; opacity: number } {
  return {
    rise: RISE * (1 - ease(RISE_EASE, RISE_AT, RISE_FOR, n)),
    opacity: n < FADE_AT ? 0 : ease(FADE_EASE, FADE_AT, FADE_FOR, n),
  };
}

/** The counter's reading at beat `n`. */
export function percentAt(n: number): number {
  // The epsilon is for the clock, not the count: 32/24·24 is 31.999…
  return Math.min(100, Math.floor(1 + COUNT_RATE * (n - TOAST_IN) + 1e-6));
}

/** Which toast is up, and its scale and opacity at beat `n`. */
export function toastAt(n: number): {
  copied: boolean;
  scale: number;
  opacity: number;
} {
  if (n >= SWAP_AT) {
    const p = ease(POP_EASE, SWAP_AT, POP_FOR, n);
    return { copied: true, scale: POP_FROM + (1 - POP_FROM) * p, opacity: 1 };
  }
  const p = ease(POP_EASE, PRESS_AT, POP_FOR, n);
  return {
    copied: false,
    scale: 1 - (1 - CAPTURING.scale) * p,
    opacity: n < TOAST_IN ? 0 : ease(FADE_EASE, TOAST_IN, FADE_FOR, n),
  };
}

/**
 * A line of type that can sit — and move — a fraction of a pixel.
 *
 * Chrome rounds a glyph run's baseline to a whole device pixel, in HTML and
 * SVG alike. The headline's rise ends in a long, slow crawl — a tenth of a
 * pixel a frame — that would otherwise hold still and then jump. So the line
 * is painted twice, one device pixel apart, both on whole pixels, cross-faded
 * by the fraction in between; `plus-lighter` adds the two copies' coverage,
 * so the blend is exactly linear. (Same trick as check-cycle.)
 */
function Line({
  x,
  y,
  dev,
  style,
  children,
}: {
  x: number;
  y: number;
  /** A baseline at y, in this group's units, lands on device row a·y + b. */
  dev: { a: number; b: number };
  style: CSSProperties;
  children: ReactNode;
}) {
  // The Player scales the scene with CSS, so its pixel grid is not the one
  // `dev` describes — there a single copy is the honest choice.
  if (getRemotionEnvironment().isPlayer)
    return (
      <text x={x} y={y} style={style}>
        {children}
      </text>
    );
  const d = dev.a * y + dev.b;
  const lo = Math.floor(d);
  const f = d - lo;
  const at = (row: number) => (row + 1e-3 - dev.b) / dev.a;
  return (
    <g style={{ isolation: "isolate" }}>
      {[
        [lo, 1 - f],
        [lo + 1, f],
      ].map(([row, w]) =>
        (w ?? 0) < 1e-3 ? null : (
          <text
            key={row}
            x={x}
            y={at(row ?? 0)}
            style={{ ...style, opacity: w, mixBlendMode: "plus-lighter" }}
          >
            {children}
          </text>
        ),
      )}
    </g>
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
  const base = staticFile("_").slice(0, -2);
  if (base && src.startsWith(`${base}/`)) return src;
  try {
    return staticFile(src.replace(/^\/+/, ""));
  } catch {
    return src;
  }
}

/** The screenshot's natural aspect, held behind the render until it is known. */
function useAspect(src: string): number | null {
  const [aspect, setAspect] = useState<number | null>(null);
  const [handle] = useState(() => delayRender(`capture-reveal: ${src}`));
  useEffect(() => {
    if (!src) {
      continueRender(handle);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setAspect(img.naturalHeight / Math.max(1, img.naturalWidth));
      continueRender(handle);
    };
    img.onerror = () => continueRender(handle);
    img.src = src;
  }, [src, handle]);
  return aspect;
}

/** Advance widths of the toast copy, measured in the real face once it loads. */
function useWidths(
  texts: string[],
  font: string,
): [number[] | null, RefObject<SVGGElement | null>] {
  const probe = useRef<SVGGElement>(null);
  const [widths, setWidths] = useState<number[] | null>(null);
  const [handle] = useState(() => delayRender("capture-reveal: measure"));
  const key = texts.join("\u0000");
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is `texts`
  useLayoutEffect(() => {
    let live = true;
    loadFace()
      .then(() => document.fonts.ready)
      .then(() => {
        if (!live) return;
        const nodes = probe.current?.querySelectorAll("text") ?? [];
        setWidths(Array.from(nodes, (t) => t.getComputedTextLength()));
        continueRender(handle);
      });
    return () => {
      live = false;
    };
  }, [key, font, handle]);
  return [widths, probe];
}

export interface CaptureRevealProps {
  /** The headline; `|` breaks it into lines. */
  headline?: string;
  /** The toast while the counter runs. */
  capturing?: string;
  /** The toast once it lands. */
  copied?: string;
  /** The screenshot in the window: an image, laid in at full width, top first. */
  src?: string;
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
  fontFamily?: string;
}

export function CaptureReveal({
  headline = "no more | keyframes",
  capturing = "Capturing selection...",
  copied = "Copied to clipboard.",
  src = "https://media.snapcn.dev/stills/capture-reveal-window.webp",
  theme,
  mode = "light",
  fontFamily = "Default",
}: CaptureRevealProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily) ?? `"${FACE}", ${DM_SANS}`;
  const id = useId().replace(/:/g, "");
  const image = src ? resolveSrc(src) : "";
  const aspect = useAspect(image);
  const [widths, probe] = useWidths([capturing, copied, "100%"], face);

  const n = (frame / fps) * BEATS - REF_AT;
  const u = Math.min(width / REF_W, height / REF_H);
  const left = (width - REF_W * u) / 2;
  const top = (height - REF_H * u) / 2;
  // A Remotion render's `scale` is the page's devicePixelRatio.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;

  /* — the page — */
  const lineX = mixOklch(t.background, t.foreground, GRID.down);
  const lineY = mixOklch(t.background, t.foreground, GRID.across);
  const view = { x: -left / u, y: -top / u, w: width / u, h: height / u };
  const cols: number[] = [];
  for (
    let x = GRID.x0 + Math.floor((view.x - GRID.x0) / GRID.dx) * GRID.dx;
    x < view.x + view.w;
    x += GRID.dx
  )
    cols.push(x);
  const rows: number[] = [];
  for (
    let y = GRID.y0 + Math.floor((view.y - GRID.y0) / GRID.dy) * GRID.dy;
    y < view.y + view.h;
    y += GRID.dy
  )
    rows.push(y);

  /* — the window — */
  const win = windowAt(n);
  const [ox, oy] = WIN_ORIGIN;
  const winH = WIN.w * (aspect ?? 1.25);
  const out = outroAt(n);
  const winT = `translate(${ox} ${oy + win.drop + OUTRO_DROP * out.p}) scale(${win.scale}) translate(${-ox} ${-oy})`;

  /* — the headline — */
  const lines = headline
    .split("|")
    .map((l) => l.trim())
    .filter(Boolean);
  const head = headlineAt(n);
  const headType: CSSProperties = {
    fontFamily: face,
    fontSize: HEAD.size,
    fontWeight: HEAD.weight,
    fontVariationSettings: `"opsz" ${HEAD.opsz}`,
    letterSpacing: HEAD.track,
    fill: mixOklch(t.foreground, t.mutedForeground, HEAD.ink),
    textAnchor: "middle",
    // Unhinted outlines, so the sub-pixel `Line` blend moves the shape it drew.
    textRendering: "geometricPrecision",
  };

  /* — the toast — */
  const toast = toastAt(n);
  const [wCapturing, wCopied, wFull] = widths ?? [0, 0, 0];
  const capText = CAPTURING.text.x + (wCapturing ?? 0) + CAPTURING.gap;
  const boxW = toast.copied
    ? COPIED.text.x + (wCopied ?? 0) + COPIED.right
    : capText + (wFull ?? 0) + CAPTURING.right;
  const [cx, cy] = toast.copied ? COPIED.at : CAPTURING.at;
  const boxL = cx - boxW / 2;
  const s = toast.scale;
  const toastType: CSSProperties = {
    fontFamily: face,
    fontSize: TOAST.size,
    fontWeight: TOAST.weight,
    fontVariationSettings: `"opsz" ${TOAST.opsz}`,
    letterSpacing: TOAST.track,
    textRendering: "geometricPrecision",
  };
  // Toast group: y_stage = cy + s·(y − cy) → device row = a·y + b.
  const toastDev = { a: dpr * u * s, b: dpr * (top + u * cy * (1 - s)) };
  // The push scales the block about its middle and carries that middle to the
  // frame's: y_stage = m + k·(y − mid), so the rows map as a·y + b.
  const k = 1 + (OUTRO_SCALE - 1) * out.p;
  const m = HEAD.mid + (OUTRO_MID - HEAD.mid) * out.p;
  const headT = `translate(${HEAD.x} ${m}) scale(${k}) translate(${-HEAD.x} ${-HEAD.mid})`;
  const headDev = { a: dpr * u * k, b: dpr * (top + u * (m - k * HEAD.mid)) };
  const ts = TOAST.shadow;

  /* — the cursor — */
  const [tx, ty] = cursorAt(n);

  const muted = t.mutedForeground;
  const inkCopied = mixOklch(t.foreground, muted, INK.copied);
  const inkCapturing = mixOklch(t.foreground, muted, INK.capturing);
  const inkPercent = mixOklch(muted, t.card, INK.percent);
  const inkMark = mixOklch(muted, t.card, INK.mark);
  const check = { x: boxL + COPIED.check.x, y: cy + COPIED.check.dy };

  return (
    <AbsoluteFill style={{ backgroundColor: t.background }}>
      <svg
        width={width}
        height={height}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <filter id={`${id}-win`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={WIN_SHADOW.blur / 2} />
          </filter>
          <filter
            id={`${id}-toast`}
            x="-50%"
            y="-100%"
            width="200%"
            height="300%"
          >
            <feGaussianBlur stdDeviation={ts.blur / 2} />
          </filter>
          <filter
            id={`${id}-arrow`}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feDropShadow
              dx={ARROW_SHADOW.dx}
              dy={ARROW_SHADOW.dy}
              stdDeviation={ARROW_SHADOW.sigma}
              floodColor="#000"
              floodOpacity={ARROW_SHADOW.alpha}
            />
          </filter>
          <clipPath id={`${id}-clip`}>
            <rect x={WIN.x} y={WIN.y} width={WIN.w} height={winH} rx={WIN.r} />
          </clipPath>
        </defs>

        {/* The page's grid: hairlines, one reference pixel wide. */}
        <g>
          {cols.map((x) => (
            <rect
              key={`c${x}`}
              x={x - 0.5}
              y={view.y}
              width={1}
              height={view.h}
              fill={lineX}
            />
          ))}
          {rows.map((y) => (
            <rect
              key={`r${y}`}
              x={view.x}
              y={y - 0.5}
              width={view.w}
              height={1}
              fill={lineY}
            />
          ))}
        </g>

        {/* The headline sits behind the window and rises out from under it. */}
        {head.opacity > 0 && (
          <g opacity={head.opacity} transform={headT}>
            {lines.map((line, i) => (
              <Line
                key={`${i}-${line}`}
                x={HEAD.x}
                y={
                  HEAD.mid +
                  (i - (lines.length - 1) / 2) * HEAD.pitch +
                  head.rise
                }
                dev={headDev}
                style={headType}
              >
                {line}
              </Line>
            ))}
          </g>
        )}

        {/* The window. */}
        <g transform={winT}>
          <rect
            x={WIN.x - WIN_SHADOW.spread}
            y={WIN.y + WIN_SHADOW.dy - WIN_SHADOW.spread}
            width={WIN.w + 2 * WIN_SHADOW.spread}
            height={winH + 2 * WIN_SHADOW.spread}
            rx={Math.max(0, WIN.r + WIN_SHADOW.spread)}
            fill="#000"
            opacity={WIN_SHADOW.alpha}
            filter={`url(#${id}-win)`}
          />
          <g clipPath={`url(#${id}-clip)`}>
            <rect
              x={WIN.x}
              y={WIN.y}
              width={WIN.w}
              height={winH}
              fill={t.card}
            />
            {image && (
              <image
                href={image}
                x={WIN.x}
                y={WIN.y}
                width={WIN.w}
                height={winH}
                preserveAspectRatio="xMidYMin slice"
              />
            )}
          </g>
        </g>

        {/* The toast. */}
        {toast.opacity * out.fade > 0 && (
          <g
            opacity={toast.opacity * out.fade}
            transform={`translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`}
          >
            <rect
              x={cx - boxW / 2 - ts.spread}
              y={cy - TOAST.h / 2 + ts.dy - ts.spread}
              width={boxW + 2 * ts.spread}
              height={TOAST.h + 2 * ts.spread}
              rx={Math.max(0, TOAST.r + ts.spread)}
              fill="#000"
              opacity={ts.alpha}
              filter={`url(#${id}-toast)`}
            />
            <rect
              x={cx - boxW / 2}
              y={cy - TOAST.h / 2}
              width={boxW}
              height={TOAST.h}
              rx={TOAST.r}
              fill={t.card}
            />
            {toast.copied ? (
              <>
                <circle
                  cx={check.x}
                  cy={check.y}
                  r={COPIED.check.r}
                  fill={t.primary}
                />
                <polyline
                  points={COPIED.tick
                    .map(([a, b]) => `${check.x + a},${check.y + b}`)
                    .join(" ")}
                  fill="none"
                  stroke={t.primaryForeground}
                  strokeWidth={COPIED.check.stroke}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Line
                  x={boxL + COPIED.text.x}
                  y={cy + COPIED.text.base}
                  dev={toastDev}
                  style={{ ...toastType, fill: inkCopied }}
                >
                  {copied}
                </Line>
              </>
            ) : (
              <>
                <Mark
                  x={boxL + CAPTURING.icon.x}
                  y={cy + CAPTURING.icon.dy}
                  ink={inkMark}
                  card={t.card}
                />
                <Line
                  x={boxL + CAPTURING.text.x}
                  y={cy + CAPTURING.text.base}
                  dev={toastDev}
                  style={{ ...toastType, fill: inkCapturing }}
                >
                  {capturing}
                </Line>
                <Line
                  x={boxL + capText}
                  y={cy + CAPTURING.percent.base}
                  dev={toastDev}
                  style={{ ...toastType, fill: inkPercent }}
                >
                  {`${percentAt(n)}%`}
                </Line>
              </>
            )}
          </g>
        )}

        {/* The cursor is the system's, not the app's: black on a white
            outline in either mode, the way a real pointer is. */}
        <polygon
          opacity={out.fade}
          points={ARROW.map(([a, b]) => `${tx + a},${ty + b}`).join(" ")}
          fill="#000000"
          stroke="#ffffff"
          strokeWidth={2 * ARROW_OUTLINE}
          strokeLinejoin="round"
          paintOrder="stroke"
          filter={`url(#${id}-arrow)`}
        />

        {/* Width probes for the toast copy, in the real face, never painted. */}
        <g ref={probe} visibility="hidden" aria-hidden>
          <Probe style={toastType} texts={[capturing, copied, "100%"]} />
        </g>
      </svg>
    </AbsoluteFill>
  );
}

function Probe({ style, texts }: { style: CSSProperties; texts: string[] }) {
  return (
    <>
      {texts.map((s, i) => (
        <text key={`${i}-${s}`} x={0} y={-1000} style={style}>
          {s}
        </text>
      ))}
    </>
  );
}

/** The selection mark: a back sheet, and a front sheet with a hole in it. */
function Mark({
  x,
  y,
  ink,
  card,
}: {
  x: number;
  y: number;
  ink: string;
  card: string;
}) {
  const box = (b: (typeof MARK)["back"], fill: string) => (
    <rect
      x={x + b.x}
      y={y + b.y}
      width={b.w}
      height={b.h}
      rx={b.r}
      fill={fill}
    />
  );
  return (
    <g>
      {box(MARK.back, ink)}
      {box(MARK.front, ink)}
      {box(MARK.hole, card)}
    </g>
  );
}
