"use client";

import { loadFont as loadUltra } from "@remotion/google-fonts/Ultra";
import { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Easing,
  getRemotionEnvironment,
  interpolate,
  spring,
  useCurrentFrame,
  useCurrentScale,
  useVideoConfig,
} from "remotion";
import {
  mixOklch,
  resolveFont,
  type SnapCnTheme,
  useSnapCnTheme,
} from "@/lib/snap-cn-ui";

// Loaded through @remotion/google-fonts, never a CSS variable — a Remotion
// bundle has none of the app's CSS, so `var(--font-…)` gets you the right face
// in the Player and a fallback in the mp4 (design-system rule 4). It also has to
// be resident *before* the measurement below, or every block is sized off a
// fallback metric.
//
// Ultra ships a **single** weight (400). That is not a detail to work around: ask
// for a weight Google does not serve and the browser synthesises it, which on a
// slab this heavy smears the serifs and thickens the stems unevenly — and the
// canvas measurement below would then be taken off that fake face and size every
// block wrong. So the weight prop, its customizer control and this call all say
// 400, and none of them offer anything else.
const { fontFamily: ULTRA, waitUntilDone: ultraReady } = loadUltra("normal", {
  weights: ["400"],
  subsets: ["latin"],
});

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ─── Motion ────────────────────────────────────────────────────────────────────

/**
 * The deck's full turn. This is an aggressive S-curve — it whips through the
 * middle third and creeps at both ends — and the repo's motion-quality rule says
 * *moderate decelerates only*. That rule is about **type**: an aggressive ease on
 * a glyph spends frames moving under half a pixel, the rasteriser rounds them to
 * nothing, and the word visibly freezes. Nothing here is a glyph. These are
 * solid-colour rounded rectangles with no hinting and no baseline to snap, and
 * the whip is the entire read of the beat — the deck has to look *shuffled*, not
 * eased. Softening this to `bezier(0.2, 0.6, 0.35, 1)` was measured against the
 * reference and destroys it: the fan opens lazily and never snaps shut.
 *
 * Fitted frame by frame against the reference, this curve lands within 2° of the
 * measured angle over the whole 360°.
 */
const SPIN_EASE = Easing.bezier(0.76, 0, 0.24, 1);

/** The scale-in, and every settle that follows it: `1 - (1 - x)³`. */
const OUT_EASE = Easing.out(Easing.cubic);

/** The deck dropping back onto the baseline — accelerating, a fall not a drift. */
const IN_EASE = Easing.in(Easing.cubic);

// ─── Measurement ───────────────────────────────────────────────────────────────

/** An ascender's tab, measured off the glyph. All values in probe px. */
interface Tab {
  /** How far the glyph's ink rises above the x-height. */
  height: number;
  /** Left edge of that ink, as a fraction of the glyph's ink width. */
  x: number;
  /** Width of that ink, as a fraction of the glyph's ink width. */
  width: number;
}

interface Glyph {
  ch: string;
  /** True when the glyph paints no ink (a space) — it gets no block. */
  blank: boolean;
  /** Advance width in layout px at the probe's `fontSize`. */
  advance: number;
  /** `null` when the glyph does not rise above the x-height. */
  tab: Tab | null;
}

interface Metrics {
  glyphs: Glyph[];
  /**
   * The x-height, which is the block's side.
   *
   * Not the cap height, which is what the reference *looks* like it uses. Its
   * word is lowercase and its blocks are 69–70px against letters that stand 71–73
   * tall — those letters are "a", "s" and "e", so 72 is that face's **x-height**,
   * and the 27.6px tab on the first block is exactly its ascender minus its
   * x-height. Reading it as cap height happens to work for a face whose caps and
   * ascenders coincide, and then quietly produces no tab at all in Inter, whose
   * ascenders are the same height as its caps. x-height is the reading that
   * survives a change of font.
   */
  xHeight: number;
  /** Distance from a letter box's top edge down to its text baseline. */
  baselineOffset: number;
}

/**
 * Ink metrics come off a canvas, not off the DOM, because the DOM does not
 * expose them: `getBoundingClientRect()` measures a span's *layout* box, which
 * is the same height for "b" and for "a". `TextMetrics.actualBoundingBoxAscent`
 * is the real ink top, which is the only thing that can tell an ascender from an
 * x-height glyph without a hardcoded `bdfhklt` list — and a hardcoded list is
 * wrong the moment the text is Greek, Cyrillic, a capital, or an emoji.
 */
function measureInk(
  glyphs: string[],
  fontFamily: string,
  fontWeight: number | string,
  fontSize: number,
): { xHeight: number; tabs: Map<string, Tab> } | null {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(fontSize * 3);
  canvas.height = Math.ceil(fontSize * 3);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "alphabetic";

  const xHeight = ctx.measureText("x").actualBoundingBoxAscent;
  const capHeight = ctx.measureText("H").actualBoundingBoxAscent;
  if (!(xHeight > 0) || !(capHeight > xHeight)) return null;

  // Round letters overshoot the x-height by a pixel or so at every size — "o"
  // and "e" are drawn slightly taller than "x" so they don't *look* shorter. A
  // fraction of the x-height-to-cap gap is the right scale for "meaningfully
  // above", because that gap is the size of the feature we are looking for.
  const cut = (capHeight - xHeight) * 0.15;

  const origin = fontSize * 0.5;
  const baseline = Math.round(fontSize * 2);
  const tabs = new Map<string, Tab>();

  for (const ch of glyphs) {
    const m = ctx.measureText(ch);
    const height = m.actualBoundingBoxAscent - xHeight;
    if (!(height > cut)) continue;

    // How wide the tab is, and which side it sits on, cannot be read off any
    // metric — "b" and "d" have identical bounding boxes, and "B" has the same
    // box as "b" while being solid across its whole width. So rasterise the
    // glyph once and look at where the ink actually is above the x-height.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    ctx.fillText(ch, origin, baseline);
    // Read the top 60% of the tab, not all the way down to the x-height line.
    // The last rows before that line are where a "b"'s bowl and an "f"'s crossbar
    // start, and sampling them reports the whole letter as the stem — measured,
    // that inflated Inter's "b" tab from 28% of the block to 67%.
    const top = Math.max(0, Math.floor(baseline - m.actualBoundingBoxAscent));
    const bottom = Math.min(canvas.height, top + Math.max(1, height * 0.6));
    const data = ctx.getImageData(
      0,
      top,
      canvas.width,
      Math.ceil(bottom - top),
    ).data;
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] <= 8) continue;
      const x = (i >> 2) % canvas.width;
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
    if (lo === Number.POSITIVE_INFINITY) continue;
    const inkLeft = origin - m.actualBoundingBoxLeft;
    const inkWidth = m.actualBoundingBoxRight + m.actualBoundingBoxLeft;
    if (!(inkWidth > 0)) continue;
    tabs.set(ch, {
      height,
      x: Math.max(0, (lo - inkLeft) / inkWidth),
      width: Math.min(1, (hi - lo + 1) / inkWidth),
    });
  }

  return { xHeight, tabs };
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface BlockWordmarkProps {
  /** The word to build. Any text: spaces get no block, emoji get their own. */
  text?: string;
  /** Size the finished wordmark is set at, in px. */
  fontSize?: number;
  /** Defaults to Ultra, loaded through `@remotion/google-fonts`. Ultra has one
   *  weight (400) — see the loader note above before offering another. */
  fontFamily?: string;
  fontWeight?: number | string;
  /** The wordmark's ink. Overrides the design system's `foreground`. */
  color?: string;
  /**
   * The deck's cards and the flash colours, in order. Accepts an array or a
   * comma-separated string (which is what the customizer's text control passes).
   * The lead card is always `color`; these are the ones behind it.
   */
  colors?: string[] | string;
  /** Stage behind the build. Overrides the design system's `background`. */
  background?: string;

  /** Gap between blocks, as a fraction of the block's side. */
  blockGap?: number;
  /** Corner radius of a block, as a fraction of its side. */
  cornerRadius?: number;
  /**
   * How tall an ascender's tab grows, as a fraction of the block's height.
   * Omitted, it is **measured** per glyph — how far that letter's ink actually
   * rises above the x-height — which is the only value that stays right when the
   * font changes. The reference's own face gives 0.40; Inter gives 0.33.
   */
  ascenderRatio?: number;
  /**
   * Width of that tab, as a fraction of the block's width. Omitted, it is
   * measured too: the stem of a "b", the whole width of a "B". The reference
   * widens its own stem by about 60% into a chunky flag — `0.415` reproduces it.
   */
  ascenderStemRatio?: number;
  /**
   * `"square"` (measured) makes every block a square of side = cap height, so
   * the row is an even rhythm and each block visibly *changes* into its letter.
   * `"glyph"` sizes each block to the advance width of the letter it becomes,
   * which makes the resolve nearly in-place.
   */
  blockSizing?: "square" | "glyph";
  /** Fraction of the frame width the row may occupy before it is scaled to fit. */
  maxWidth?: number;

  /** Cards in the deck, including the lead one. */
  cards?: number;
  /** Frames between one card's turn starting and the next card's. */
  cardStagger?: number;
  /** Full turns the deck makes while it fans and winds back in. */
  spinTurns?: number;
  /** How far the deck lifts off the baseline as it fans, as a fraction of side. */
  liftRatio?: number;

  /** Frames the first square takes to scale in. */
  growDuration?: number;
  /** Frames the deck's turn lasts. */
  spinDuration?: number;
  /** Frames a block takes to travel from the square to its slot. */
  splitDuration?: number;
  /** Frames the inner blocks lag the outer ones by. The split runs outside-in. */
  splitStagger?: number;
  /** Frames an ascender's tab takes to grow. */
  ascenderDuration?: number;
  /** Frames the finished block row holds before the letters resolve. */
  holdDuration?: number;
  /** Frames between one letter's flash and the next. The first step is half. */
  flashStagger?: number;
  /** Frames a block stays lit in its flash colour. */
  flashDuration?: number;
  /** Frames from a block lighting up to it being replaced by its letter. */
  flashToSwap?: number;

  speed?: number;
  className?: string;
  /** Design-system token overrides. */
  theme?: Partial<SnapCnTheme>;
  mode?: "light" | "dark";
}

/**
 * The accent palette, ours: **one hue, five shades**.
 *
 * Every card is `primary` walked toward pure white or pure black in OKLCH, so
 * the deck is a tonal ramp of the installer's own accent rather than five
 * unrelated hues — override `theme.primary` and the whole deck moves with it,
 * which a hardcoded set could never do.
 *
 * **Pure `#fff`/`#000`, deliberately, not `t.background`/`t.foreground`.** Those
 * are warm neutrals, and OKLCH interpolation carries their hue: mixing this blue
 * 28% toward the warm off-white background measures out at `rgb(0,172,196)` —
 * cyan — and 52% lands on `rgb(124,203,178)`, a green. Pure endpoints have no
 * hue to contribute, so all five stay on h≈260 and only lightness moves, which
 * is what "shades of one blue" has to mean.
 *
 * Alternating darker/lighter rather than a straight ramp: the cards fan out
 * overlapping, so neighbours need contrast against *each other*, not just
 * against the stage.
 *
 * The reference's own six colours are its **brand** (design-system rule 5), so
 * they are not the default — they are one prop away:
 * `colors="#ABF25B,#FA361A,#FCCA28,#337DFE,#F99BCA" color="#0000FF"`.
 */
function defaultColors(t: SnapCnTheme): string[] {
  return [
    t.primary,
    mixOklch(t.primary, "#000000", 0.3),
    mixOklch(t.primary, "#ffffff", 0.28),
    mixOklch(t.primary, "#000000", 0.55),
    mixOklch(t.primary, "#ffffff", 0.52),
  ];
}

/**
 * A wordmark that builds itself out of blocks.
 *
 * 1. A rounded square scales up off the baseline.
 * 2. Coloured squares fan out from behind it like a deck being shuffled and wind
 *    back in — one full turn each, staggered, about a **shared** pivot on the
 *    baseline. The fan is the stagger sampling one S-curve at different times;
 *    it opens and closes exactly once.
 * 3. The deck lands, dips once, and the square splits into one block per letter,
 *    outermost blocks leading. The first ascender grows a tab: the "b".
 * 4. The row holds, then each block flashes a colour, returns to ink, and is
 *    **hard-cut** to its real letterform. The first letter resolves last.
 *
 * Nothing crossfades and nothing morphs: measured against the reference, at each
 * swap frame the ink is already within a handful of pixels of the settled
 * wordmark and one frame earlier it is 2,000 off. The cut *is* the effect — a
 * spring or a crossfade "to improve it" is the one change that breaks it.
 */
export function BlockWordmark({
  text = "base",
  fontSize = 160,
  fontFamily,
  fontWeight = 400,
  color,
  colors,
  background,
  blockGap = 0.093,
  cornerRadius = 0.18,
  ascenderRatio,
  ascenderStemRatio,
  blockSizing = "square",
  maxWidth = 0.92,
  cards = 6,
  cardStagger = 2,
  spinTurns = 1,
  liftRatio = 0.665,
  growDuration = 9,
  spinDuration = 33,
  splitDuration = 5,
  splitStagger = 1,
  ascenderDuration = 12,
  holdDuration = 54,
  flashStagger = 4,
  flashDuration = 3,
  flashToSwap = 5,
  speed = 1,
  className,
  theme,
  mode,
}: BlockWordmarkProps) {
  const frame = useCurrentFrame() * speed;
  const { width, height, fps } = useVideoConfig();
  const t = useSnapCnTheme(theme, mode);
  const face = resolveFont(fontFamily ?? t.fontFamily) ?? ULTRA;
  const ink = color ?? t.foreground;
  const stage = background ?? t.background;
  const palette =
    (typeof colors === "string"
      ? colors
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      : colors) ?? defaultColors(t);
  const deck = palette.length > 0 ? palette : defaultColors(t);

  // `Array.from` splits by code point, so an emoji stays one glyph instead of
  // becoming two broken surrogate halves.
  const chars = Array.from(text);

  // Advance widths and the baseline come from the DOM, because they have to
  // agree with the DOM that actually paints the letters. Ink metrics come from a
  // canvas (see `measureInk`). Both are constant across every frame, so measure
  // once behind `delayRender` and only release the render after the measurement
  // has re-rendered — otherwise frame 0 is captured with the wrong geometry.
  const probeRef = useRef<HTMLDivElement>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const rulerRef = useRef<HTMLSpanElement>(null);
  const [handle] = useState(() =>
    delayRender("block-wordmark: measure glyphs"),
  );
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  // A `<Player>` paints the whole composition through one `transform: scale()`,
  // so `getBoundingClientRect()` below comes back in *device* px while the canvas
  // metrics in `measureInk` are composition px. Mixing the two lays the letters
  // out on a track ~40% too short and drops them ~50px below the block row — and
  // only on the site, because `renderMedia` runs at scale 1.
  const scale = useCurrentScale({ dontThrowIfOutsideOfRemotion: true });

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      const box = probeRef.current;
      const ruler = rulerRef.current;
      if (!box || !ruler) {
        continueRender(handle);
        return;
      }
      const glyphChars = Array.from(text);
      // Every rect read is divided back into composition px — see `scale`.
      const s = scale || 1;
      const boxTop = box.getBoundingClientRect().top / s;
      const advances = glyphChars.map(
        (_, i) => (charRefs.current[i]?.getBoundingClientRect().width ?? 0) / s,
      );
      // A zero-sized inline-block aligns its bottom edge to the text baseline, so
      // its own top *is* the baseline. `getBoundingClientRect` rather than
      // `offsetTop`, which is rounded to a whole pixel.
      const baselineOffset = ruler.getBoundingClientRect().top / s - boxTop;
      const unique = Array.from(
        new Set(glyphChars.filter((c) => c.trim() !== "")),
      );
      const measured = measureInk(unique, face, fontWeight, fontSize);
      setMetrics({
        xHeight: measured?.xHeight ?? fontSize * 0.52,
        baselineOffset: baselineOffset || fontSize * 0.86,
        glyphs: glyphChars.map((ch, i) => ({
          ch,
          blank: ch.trim() === "",
          advance: advances[i],
          tab: measured?.tabs.get(ch) ?? null,
        })),
      });
    };
    // Measuring against a fallback face and then swapping in the real one is the
    // classic way to get a wordmark whose blocks are all the wrong width.
    // `document.fonts.ready` on its own is not that gate: it resolves straight
    // away whenever no load happens to be pending when this effect runs, so wait
    // on the loader's own promise too.
    Promise.all([
      ultraReady(),
      typeof document !== "undefined" && document.fonts
        ? document.fonts.ready
        : null,
    ]).then(run, run);
    return () => {
      cancelled = true;
    };
    // The deps are the raw inputs, never the derived `chars` array: `Array.from`
    // hands back a new array every render, which would re-run the measurement
    // (and its `delayRender`) forever. `scale` only ever cancels itself back out,
    // so a re-run on resize produces the identical metrics.
  }, [handle, text, face, fontWeight, fontSize, scale]);

  useEffect(() => {
    if (metrics) continueRender(handle);
  }, [metrics, handle]);

  // ─── Layout ─────────────────────────────────────────────────────────────────

  const glyphs =
    metrics?.glyphs ??
    chars.map((ch) => ({
      ch,
      blank: ch.trim() === "",
      advance: fontSize * 0.55,
      tab: null as Tab | null,
    }));
  const xHeight = metrics?.xHeight ?? fontSize * 0.52;
  const baselineOffset = metrics?.baselineOffset ?? fontSize * 0.86;

  // Two independent static layouts, exactly as measured: a row of blocks whose
  // side is the x-height, and a row of letters at their natural advance widths. They are *not* the same row — the blocks are an even rhythm and the
  // letters are not — which is why the resolve has to move and resize each slot
  // rather than just repaint it.
  const letterEnds: number[] = [];
  let letterRun = 0;
  for (const g of glyphs) {
    letterEnds.push(letterRun);
    letterRun += g.advance;
  }
  const letterTotal = letterRun;

  const gapPx = blockGap * xHeight;
  /** Glyph index of each block — a space produces no block. */
  const blockGlyph: number[] = [];
  const blockStarts: number[] = [];
  const blockWidths: number[] = [];
  const blockOf: number[] = [];
  let blockRun = 0;
  let prevWasBlock = false;
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];
    if (g.blank) {
      // A space already separates the blocks either side of it, so it does not
      // also get a `blockGap`; its own advance width is the word space.
      blockRun += g.advance;
      prevWasBlock = false;
      blockOf.push(-1);
      continue;
    }
    if (prevWasBlock) blockRun += gapPx;
    blockOf.push(blockGlyph.length);
    blockGlyph.push(i);
    blockStarts.push(blockRun);
    blockWidths.push(blockSizing === "glyph" ? g.advance : xHeight);
    blockRun += blockWidths[blockWidths.length - 1];
    prevWasBlock = true;
  }
  const blockTotal = blockRun;

  // A long word must not run off the frame. This is a *constant* scale, folded
  // into the measured px and into `font-size` rather than applied as a transform
  // — a static size re-rasterises once, where an animated one boils.
  const fit = Math.min(
    1,
    (width * maxWidth) / Math.max(1, letterTotal, blockTotal),
  );
  const side = xHeight * fit;
  const radius = cornerRadius * side;
  const cx = width / 2;
  /** Height of a block's tab in fitted px — measured, unless overridden. */
  const tabHeightOf = (g: Glyph) =>
    g.tab === null
      ? 0
      : ascenderRatio === undefined
        ? g.tab.height * fit
        : ascenderRatio * side;
  const rowTop =
    side + Math.max(0, ...blockGlyph.map((i) => tabHeightOf(glyphs[i])));
  // The one invariant across the whole build: the baseline. Everything is pinned
  // to it — the deck's pivot, the blocks' bottom edge, the letters. The row is
  // centred on its *ink* box, tab included, not on the square.
  const baselineY = height / 2 + rowTop / 2;
  const letterLeft = (width - letterTotal * fit) / 2;
  const blockLeft = (width - blockTotal * fit) / 2;

  // ─── Beats ──────────────────────────────────────────────────────────────────

  const nCards = Math.max(1, Math.round(cards));
  // The deck is visually done half the stagger's spread after the lead card's
  // turn ends. Rounded, because the anticipation dip below peaks on a single
  // frame: at an odd `cardStagger * (nCards - 1)` a fractional `collapseAt` puts
  // that peak between two samples and the beat silently does not happen.
  const collapseAt = Math.round(
    spinDuration + (cardStagger * (nCards - 1)) / 2,
  );
  const splitStart = collapseAt + 2;
  const ascenderStart = splitStart + 2;
  const resolveStart = splitStart + holdDuration;

  const grow = interpolate(frame, [0, Math.max(1, growDuration)], [0, 1], {
    ...CLAMP,
    easing: OUT_EASE,
  });

  /**
   * One rigid rotation about an offset origin — spin angle *is* orbit angle.
   *
   * A trailing card's turn is compressed so that it *ends* by `collapseAt`. The
   * stagger is on the starts, so the fan still opens exactly as measured; but a
   * card whose turn ran past the collapse would still be 6° short — a 10px
   * corner sticking out from behind the lead square — on the frame the deck is
   * meant to be gone, and would then either pop out of existence or show through
   * the gaps as the square splits. The lead card (`card === 0`) is never
   * compressed: `collapseAt >= spinDuration` by construction.
   */
  const turn = (card: number) => {
    const start = card * cardStagger;
    const span = Math.max(1, Math.min(spinDuration, collapseAt - start));
    return interpolate(frame - start, [0, span], [0, 360 * spinTurns], {
      ...CLAMP,
      easing: SPIN_EASE,
    });
  };

  // The lift is one translate shared by every card — a version where each card's
  // lift lags with its own stagger measures much worse against the reference.
  // Out on an overdamped spring, back down on an accelerating fall.
  const lift =
    liftRatio *
    side *
    (spring({
      frame: Math.max(0, frame - 2),
      fps,
      config: { damping: 60, stiffness: 330, mass: 1 },
    }) -
      interpolate(frame, [collapseAt - 9, collapseAt], [0, 1], {
        ...CLAMP,
        easing: IN_EASE,
      }));

  // One frame of anticipation before the split: the square lifts 3% of its side
  // and squashes about 1%. It is a single frame at 30fps and it is what sells
  // the split.
  const dip = interpolate(
    frame,
    [collapseAt, collapseAt + 1, collapseAt + 3],
    [0, 1, 0],
    CLAMP,
  );

  /** Blocks travel outside-in: the outermost pair leads, each step in lags. */
  const splitRank = (b: number) => {
    const mid = (blockWidths.length - 1) / 2;
    return Math.round(mid - Math.abs(b - mid));
  };
  const splitProgress = (b: number) =>
    interpolate(
      frame - splitStart - splitRank(b) * splitStagger,
      [0, Math.max(1, splitDuration)],
      [0, 1],
      { ...CLAMP, easing: OUT_EASE },
    );

  const tabGrow = interpolate(
    frame,
    [ascenderStart, ascenderStart + Math.max(1, ascenderDuration)],
    [0, 1],
    { ...CLAMP, easing: OUT_EASE },
  );

  // The letters resolve left to right *from the second one*, wrapping to the
  // first letter last, and the first gap is half a step — a deliberately
  // irregular rhythm that a uniform stagger visibly mistimes.
  const order: number[] = [];
  for (let b = 1; b < blockWidths.length; b++) order.push(b);
  if (blockWidths.length > 0) order.push(0);
  const cue = new Map<number, number>();
  order.forEach((b, k) => {
    cue.set(b, k === 0 ? 0 : flashStagger * k - flashStagger / 2);
  });
  const flashOf = new Map<number, string>();
  order.forEach((b, k) => {
    flashOf.set(b, deck[k % deck.length]);
  });

  const ready = metrics !== null;
  const isRendering = getRemotionEnvironment().isRendering;
  const accel = isRendering ? null : { willChange: "transform" as const };
  const squareLeft = cx - side / 2;

  return (
    <AbsoluteFill
      className={className}
      style={{
        backgroundColor: stage,
        overflow: "hidden",
        fontFamily: face,
        fontWeight,
        // Hinting re-snaps every stem as a glyph changes size, so the letterforms
        // literally change shape frame to frame. Off, they hold still.
        textRendering: "geometricPrecision",
      }}
    >
      {/* Hidden probe. Laid out with the same face, weight and size as the real
          letters, so its advance widths are the widths that will be painted. */}
      <div
        ref={probeRef}
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          visibility: "hidden",
          pointerEvents: "none",
          whiteSpace: "pre",
          lineHeight: 1,
          fontSize,
        }}
      >
        {chars.map((ch, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: glyphs are positional and never reorder
            key={i}
            ref={(el) => {
              charRefs.current[i] = el;
            }}
            style={{ display: "inline-block", whiteSpace: "pre" }}
          >
            {ch}
          </span>
        ))}
        <span
          ref={rulerRef}
          style={{ display: "inline-block", width: 0, height: 0 }}
        />
      </div>

      <AbsoluteFill
        style={{
          opacity: ready ? 1 : 0,
          // The lift moves the deck's shared pivot; the dip squashes it onto the
          // baseline. Both pivot on the baseline, so the bottom edge never moves.
          transformOrigin: `50% ${baselineY}px`,
          transform: `translateY(${-lift - dip * side * 0.03}px) scaleY(${1 - dip * 0.013})`,
        }}
      >
        {/* The deck, back to front. The lead card is the block row below, which
            paints over all of them — it is never occluded. */}
        {frame < collapseAt + 1 &&
          Array.from({ length: nCards - 1 }, (_, i) => nCards - 1 - i).map(
            (k) => (
              <div
                key={`card-${k}`}
                style={{
                  position: "absolute",
                  left: squareLeft,
                  top: baselineY - side,
                  width: side,
                  height: side,
                  borderRadius: radius,
                  backgroundColor: deck[(k - 1) % deck.length],
                  // Bottom centre, not the middle. The orbit radius is exactly
                  // half the side because the pivot is on the square's own edge:
                  // get this wrong and the deck spins in place instead of
                  // sweeping.
                  transformOrigin: "50% 100%",
                  transform: `rotate(${turn(k)}deg) scale(${grow})`,
                  ...accel,
                }}
              />
            ),
          )}

        {/* The block row. Every block starts life *as* the lead card — same box,
            same transform — so beats 1–3 draw one square, and the split simply
            lets them walk apart. */}
        {blockWidths.map((w, b) => {
          const p = splitProgress(b);
          const g = glyphs[blockGlyph[b]];
          const swapAt = resolveStart + (cue.get(b) ?? 0) + flashToSwap;
          if (frame >= swapAt) return null;
          const flashOn = resolveStart + (cue.get(b) ?? 0);
          const lit = frame >= flashOn && frame < flashOn + flashDuration;
          const fill = lit ? (flashOf.get(b) ?? ink) : ink;
          const left =
            squareLeft + (blockLeft + blockStarts[b] * fit - squareLeft) * p;
          const bw = side + (w * fit - side) * p;
          const tab = g?.tab ?? null;
          const tabH = tab ? tabGrow * tabHeightOf(g) : 0;
          // Measured off the glyph: a "b" gives a narrow stem at its left edge,
          // a "B" gives the block's whole width, an emoji gives most of it.
          const tabW = tab ? bw * (ascenderStemRatio ?? tab.width) : 0;
          const tabX = tab
            ? Math.min(Math.max(0, tab.x * bw), Math.max(0, bw - tabW))
            : 0;
          const notched = tabH > radius;
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: blocks are a fixed positional row — the index IS a block's identity
              key={`block-${b}`}
              style={{
                position: "absolute",
                left,
                top: baselineY - side,
                width: bw,
                height: side,
                borderRadius: radius,
                // Only kill the corner the tab actually lands on, or the flag
                // grows a notch where the two shapes meet.
                borderTopLeftRadius: notched && tabX < 1 ? 0 : radius,
                borderTopRightRadius:
                  notched && tabX + tabW > bw - 1 ? 0 : radius,
                backgroundColor: fill,
                transformOrigin: "50% 100%",
                transform: `rotate(${turn(0)}deg) scale(${grow})`,
                ...accel,
              }}
            >
              {/* The tab grows in **height only** — it is full width from the
                  first frame it exists. Scaling the whole silhouette up out of
                  the block would widen the stem too, and that is a different,
                  wrong shape. */}
              {tabH > 0 && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "100%",
                    left: tabX,
                    width: tabW,
                    height: tabH,
                    backgroundColor: fill,
                    borderTopLeftRadius: radius,
                    borderTopRightRadius: radius,
                  }}
                />
              )}
            </div>
          );
        })}

        {/* The letters. Each one is cut in at its final position, final size and
            final ink — the flash colour never touches the letterform. */}
        {glyphs.map((g, i) => {
          const b = blockOf[i];
          if (b < 0) return null;
          const swapAt = resolveStart + (cue.get(b) ?? 0) + flashToSwap;
          if (frame < swapAt) return null;
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: glyphs are positional and never reorder
              key={`letter-${i}`}
              style={{
                position: "absolute",
                left: letterLeft + letterEnds[i] * fit,
                top: baselineY - baselineOffset * fit,
                fontSize: fontSize * fit,
                lineHeight: 1,
                whiteSpace: "pre",
                color: ink,
              }}
            >
              {g.ch}
            </span>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
