import type { Gray } from "./png";

/**
 * Every check, pure. `Gray`/`Frame` in, `Measurement` out — no child process,
 * no browser, no filesystem, so the whole library is exercised by
 * `__tests__/measure.test.ts` on rasters built in code. A measurement library
 * nobody has stress-tested is worse than none.
 *
 * Rule 0 of the `motion-quality` skill: you cannot see a sub-pixel bug, so
 * render the frames and measure them. These are the instruments.
 */

/** Half-open: x0/y0 inclusive, x1/y1 exclusive. Width is `x1 - x0`. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type Edge = "left" | "right" | "top" | "bottom";

/** One decoded frame. `hash` is sha1 of the PNG bytes it arrived as — the
 *  byte-identity check reads that, never `gray`. */
export interface Frame {
  index: number;
  gray: Gray;
  hash: string;
}

/** A number, the threshold it is judged against, the verdict, and a sentence.
 *  `pass === null` = reported, not judged (no threshold, or this component
 *  cannot fail this check — e.g. a background that never settles). */
export interface Measurement {
  check: string;
  value: number | null;
  unit: "frames" | "px" | "fraction" | "count";
  threshold: number | null;
  pass: boolean | null;
  detail: string;
  frame?: number;
  series?: number[];
}

const unjudged = (
  check: string,
  unit: Measurement["unit"],
  detail: string,
): Measurement => ({
  check,
  value: null,
  unit,
  threshold: null,
  pass: null,
  detail,
});

/** Inclusive both ends, sorted — `range` is a frame-index range, not a slice. */
function inRange(frames: Frame[], range: [number, number]): Frame[] {
  return frames
    .filter((f) => f.index >= range[0] && f.index <= range[1])
    .sort((a, b) => a.index - b.index);
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ---------------------------------------------------------------------------
// Frame-to-frame motion, and the number the product was missing.
// ---------------------------------------------------------------------------

export interface FrameDiff {
  /** Fraction of pixels whose luma moved by more than `noise`. 0..1 */
  moved: number;
  /** Mean absolute luma difference over the frame, 0..255. */
  meanAbs: number;
}

/** `noise` default 2 — absorbs renderer dither, catches a single fading word. */
export function frameDiff(a: Gray, b: Gray, noise = 2): FrameDiff {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `frameDiff: ${a.width}x${a.height} vs ${b.width}x${b.height}.`,
    );
  }
  const n = a.width * a.height;
  if (!n) return { moved: 0, meanAbs: 0 };
  let moved = 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(a.data[i] - b.data[i]);
    sum += d;
    if (d > noise) moved++;
  }
  return { moved: moved / n, meanAbs: sum / n };
}

export interface SettleOptions {
  /** Fraction of pixels that must move for a frame to count as still animating.
   *  Default 5e-4 (≈460px at 1280×720) — a fraction of one line's edge pixels. */
  moved?: number;
  /** Luma delta a pixel must exceed to count as moved. Default 2. */
  noise?: number;
  /** Quiet frames that must FOLLOW a candidate before it is the settle frame.
   *  Default 6 (0.2s at 30fps) — a deliberate hold is not the end. */
  quiet?: number;
}

export interface Settle {
  /** Last frame at which anything changed. null when it never goes quiet. */
  frame: number | null;
  /** No qualifying quiet run anywhere: a looping background, a pulsing border.
   *  A fact, not a failure. */
  neverSettles: boolean;
  /** The last frame that moved at all, quiet run or not. Null on a still.
   *  This is what the detail sentence names when `neverSettles` — otherwise the
   *  one number a human wants ("it was STILL going at 74") is nowhere. */
  lastMoved: number | null;
  /** moved-fraction per frame; motion[i] = frameDiff(frames[i-1], frames[i]).moved,
   *  motion[0] = 0. */
  motion: number[];
  /** Frames above `moved`, as a fraction of the composition. */
  busy: number;
}

/**
 * THE missing number: when does this component stop animating?
 *
 * A fraction-of-pixels signal is scale-free and ignores single dithered pixels,
 * which a mean-absolute-difference does not.
 *
 * ponytail: `neverSettles` does not distinguish "loops forever" (correct) from
 * "still animating at the last frame" (a real bug) — both report and get billed
 * at full length, which is safe but excuses one failure mode. Add a periodicity
 * test only if a full-registry run shows it hiding something.
 */
export function settleFrame(frames: Frame[], opts: SettleOptions = {}): Settle {
  const movedFloor = opts.moved ?? 5e-4;
  const noise = opts.noise ?? 2;
  const quiet = opts.quiet ?? 6;
  const fs = [...frames].sort((a, b) => a.index - b.index);
  if (!fs.length) {
    return {
      frame: null,
      neverSettles: true,
      lastMoved: null,
      motion: [],
      busy: 0,
    };
  }
  // TWO signals, because each is blind where the other sees.
  //
  // Frame-to-frame catches a loop (a pulse returns to where it started, so its
  // distance from the last frame is periodically zero). Distance-to-rest catches
  // a slow fade: a component drifting 1 luma per frame never trips a per-frame
  // floor, yet is plainly still moving — it was invisible to the old signal and
  // is exactly the "settled" lie that puts two beats on screen at once.
  const rest = fs[fs.length - 1].gray;
  const motion = fs.map((f, i) =>
    i === 0 ? 0 : frameDiff(fs[i - 1].gray, f.gray, noise).moved,
  );
  const toRest = fs.map((f) => frameDiff(f.gray, rest, noise).moved);
  const moving = (i: number) =>
    i >= 0 &&
    i < fs.length &&
    (motion[i] > movedFloor || toRest[i] > movedFloor);
  const busy = motion.filter((m) => m > movedFloor).length / motion.length;

  // A caret blinking at the end of a terminal beat is motion, but the beat
  // settled long before it — and billing every such beat at full length is how a
  // check gets muted. The old code separated the two with a run of still frames
  // AFTER a candidate, which produced two lies: an early pause outranked later
  // motion, and motion inside the final `quiet` frames was skipped outright, so
  // a component still animating at the end fell back to that same early pause.
  // Both err in the one direction this number must never err in — too early.
  //
  // Neither amplitude nor sparsity of `motion` can tell them apart. Measured on
  // the caret fixture, the blink moves MORE pixels than the animation does
  // (0.0117 vs 0.0098) and it alternates on/off so every frame in the tail
  // "moves". What separates them is `toRest`: a caret RETURNS to the final frame
  // between blinks, so its distance from rest is above the floor only in
  // isolated single frames, while an animation that has not finished is away
  // from rest CONTIGUOUSLY. So the run in `toRest` is the signal, and the settle
  // frame is the frame the last such run ARRIVES on — the run ends on the last
  // frame still away from rest, and the movement lands on the one after it.
  const away = (i: number) => i >= 0 && i < fs.length && toRest[i] > movedFloor;
  const sustainedAway = (i: number) => away(i) && (away(i - 1) || away(i + 1));

  let lastMoved: number | null = null;
  for (let i = fs.length - 1; i >= 0; i--) {
    if (sustainedAway(i)) {
      lastMoved = fs[Math.min(i + 1, fs.length - 1)].index;
      break;
    }
  }
  // Isolated flicker still belongs in the report, so a human can see why a
  // number looks early. It is not what sets the settle frame.
  let lastFlicker: number | null = null;
  for (let i = fs.length - 1; i >= 0; i--) {
    if (moving(i)) {
      lastFlicker = fs[i].index;
      break;
    }
  }

  // Nothing ever moved: the composition is a still. It settled on frame 0.
  if (lastMoved === null) {
    return { frame: fs[0].index, neverSettles: false, lastMoved, motion, busy };
  }

  // The settle frame is simply the LAST frame that moved. The previous version
  // looked for the last frame followed by `quiet` still frames, which was clever
  // and wrong twice: an early pause won over later motion (a component that
  // paused mid-animation was published as settled there), and motion inside the
  // final `quiet` frames was skipped outright, so a component still animating at
  // the end fell back to that same early pause. Both lies point the same way —
  // they say "settled" too early, which is the one direction this number must
  // never err in.
  //
  // `quiet` now does one honest job: if the last motion is closer than that to
  // the end of the window, we did not WATCH it stop, so we do not claim it did.
  // A blinking caret reports neverSettles and gets billed at full length — the
  // safe answer, and true.
  const observedStop = lastMoved <= fs[fs.length - 1].index - quiet;
  return {
    frame: observedStop ? lastMoved : null,
    neverSettles: !observedStop,
    lastMoved: lastFlicker,
    motion,
    busy,
  };
}

/** THE check the product is missing. `transitionFrames` is @remotion/transitions'
 *  overlap — 18. A beat whose settle frame lands inside the overlap is still
 *  animating while the next one fades in over it. */
export function settlesBeforeTransition(
  settle: Settle,
  durationInFrames: number,
  transitionFrames: number,
): Measurement {
  const threshold = durationInFrames - transitionFrames - 1;
  if (settle.neverSettles || settle.frame === null) {
    return {
      ...unjudged(
        "settlesBeforeTransition",
        "frames",
        `still moving on frame ${settle.lastMoved} and never goes quiet; the ${transitionFrames}-frame transition opens at ${threshold + 1}. Reported, not failed — a loop and an unfinished beat are indistinguishable without a periodicity test. Bill it at full length.`,
      ),
      frame: settle.lastMoved ?? undefined,
      series: settle.motion,
    };
  }
  const pass = settle.frame <= threshold;
  return {
    check: "settlesBeforeTransition",
    value: settle.frame,
    unit: "frames",
    threshold,
    pass,
    frame: settle.frame,
    series: settle.motion,
    detail: pass
      ? `settles on frame ${settle.frame}, ${threshold - settle.frame} frames before the ${transitionFrames}-frame transition opens.`
      : `still animating on frame ${settle.frame}; the ${transitionFrames}-frame transition starts at ${threshold + 1}, so the next beat fades in over ${settle.frame - threshold} frames of unfinished animation.`,
  };
}

// ---------------------------------------------------------------------------
// Ink: the thresholded geometry every gross check reads.
// ---------------------------------------------------------------------------

export interface InkOptions {
  /** Luma distance from the background level at which a pixel counts as ink.
   *  Default 12 — under the darkest antialiased edge of #101828 on #FAFAFA. */
  tolerance?: number;
  /** Override the modal-level background estimate. */
  background?: number;
}

export interface Ink {
  /** The luma taken as background — the frame's modal level (histogram mode). */
  background: number;
  /** Non-background pixels / total. */
  coverage: number;
  /** Tightest box containing every ink pixel; null on an empty frame. */
  bbox: Box | null;
  /** Ink pixels per column / per row — the projections other checks read. */
  columns: Float32Array;
  rows: Float32Array;
}

export function modalLevel(g: Gray): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < g.data.length; i++) hist[g.data[i]]++;
  let best = 0;
  for (let v = 1; v < 256; v++) if (hist[v] > hist[best]) best = v;
  return best;
}

export function ink(g: Gray, opts: InkOptions = {}): Ink {
  const tol = opts.tolerance ?? 12;
  const background = opts.background ?? modalLevel(g);
  const { width, height, data } = g;
  const columns = new Float32Array(width);
  const rows = new Float32Array(height);
  let count = 0;
  let x0 = width;
  let y0 = height;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < height; y++) {
    const r = y * width;
    for (let x = 0; x < width; x++) {
      if (Math.abs(data[r + x] - background) <= tol) continue;
      count++;
      columns[x]++;
      rows[y]++;
      if (x < x0) x0 = x;
      if (x >= x1) x1 = x + 1;
      if (y < y0) y0 = y;
      if (y >= y1) y1 = y + 1;
    }
  }
  const total = width * height;
  return {
    background,
    coverage: total ? count / total : 0,
    bbox: count ? { x0, y0, x1, y1 } : null,
    columns,
    rows,
  };
}

/**
 * The ink's own level: the percentile of ink luma FURTHEST from the background.
 * Feeds the alpha recovery, which needs a real `fg`, not the config's nominal
 * colour (blur and opacity ramps move it). Dark-on-light takes the 1st
 * percentile, light-on-dark the 99th — a percentile rather than the extremum so
 * one stray pixel cannot set the scale.
 */
export function foregroundLevel(
  g: Gray,
  background: number,
  opts: InkOptions = {},
): number {
  const tol = opts.tolerance ?? 12;
  const hist = new Uint32Array(256);
  let count = 0;
  let sum = 0;
  for (let i = 0; i < g.data.length; i++) {
    const v = g.data[i];
    if (Math.abs(v - background) <= tol) continue;
    hist[v]++;
    count++;
    sum += v;
  }
  if (!count) return background;
  const dark = sum / count < background;
  const want = Math.max(1, Math.round(count * 0.01));
  let seen = 0;
  if (dark) {
    for (let v = 0; v < 256; v++) {
      seen += hist[v];
      if (seen >= want) return v;
    }
    return 0;
  }
  for (let v = 255; v >= 0; v--) {
    seen += hist[v];
    if (seen >= want) return v;
  }
  return 255;
}

/**
 * Sub-pixel geometry recovered from the antialiasing, per the skill:
 * `alpha = clamp((background - pixel) / (background - foreground), 0, 1)`,
 * then an intensity-weighted centroid. Accurate to ~0.01px.
 *
 * Used ONLY by centroidMonotonic and noFrozenFrames — a sub-pixel centroid over
 * a multi-element scene is a precise number about nothing. Where the question is
 * gross geometry, a threshold is the honest instrument and 40× cheaper.
 */
export function inkCentroid(
  g: Gray,
  opts: { background: number; foreground: number; box?: Box },
): { x: number; y: number; mass: number } {
  const denom = opts.background - opts.foreground;
  if (!denom) return { x: 0, y: 0, mass: 0 };
  const b = opts.box ?? { x0: 0, y0: 0, x1: g.width, y1: g.height };
  const x0 = Math.max(0, Math.floor(b.x0));
  const y0 = Math.max(0, Math.floor(b.y0));
  const x1 = Math.min(g.width, Math.ceil(b.x1));
  const y1 = Math.min(g.height, Math.ceil(b.y1));
  let mass = 0;
  let sx = 0;
  let sy = 0;
  for (let y = y0; y < y1; y++) {
    const r = y * g.width;
    for (let x = x0; x < x1; x++) {
      let a = (opts.background - g.data[r + x]) / denom;
      if (a <= 0) continue;
      if (a > 1) a = 1;
      mass += a;
      // Pixel centres, so a rect covering [10, 30) has centroid exactly 20.
      sx += a * (x + 0.5);
      sy += a * (y + 0.5);
    }
  }
  return mass ? { x: sx / mass, y: sy / mass, mass } : { x: 0, y: 0, mass: 0 };
}

// ---------------------------------------------------------------------------
// The four checks from the skill's Rule 0 table.
// ---------------------------------------------------------------------------

/** Skill check 1 — frames where nothing is animating must be byte-identical.
 *  This is what caught `will-change` producing 4 rasterisations of one style. */
export function holdIsStill(
  frames: Frame[],
  hold: [number, number],
): Measurement {
  const fs = inRange(frames, hold);
  if (fs.length < 2) {
    return unjudged(
      "holdIsStill",
      "count",
      `only ${fs.length} frame(s) in the hold ${hold[0]}–${hold[1]} — nothing to compare.`,
    );
  }
  const distinct = new Set(fs.map((f) => f.hash));
  return {
    check: "holdIsStill",
    value: distinct.size,
    unit: "count",
    threshold: 1,
    pass: distinct.size <= 1,
    detail:
      distinct.size <= 1
        ? `${fs.length} frames of hold, all byte-identical.`
        : `${distinct.size} distinct rasterisations across ${fs.length} frames where nothing is animating — the renderer is redrawing a static style (see will-change).`,
  };
}

/** Skill check 2 — under a monotone scale the ink's vertical centroid must move
 *  monotonically; it is a pure affine map. Measured: 29 reversals at a 50%
 *  pivot, 0 on the baseline. */
export function centroidMonotonic(
  frames: Frame[],
  opts: {
    background: number;
    foreground: number;
    range: [number, number];
    axis?: "x" | "y";
    box?: Box;
    /** Motion below this establishes no direction — it is the instrument's own
     *  accuracy. Default 0.01px. */
    eps?: number;
  },
): Measurement {
  const axis = opts.axis ?? "y";
  const eps = opts.eps ?? 0.01;
  const fs = inRange(frames, opts.range);
  if (fs.length < 3) {
    return unjudged(
      "centroidMonotonic",
      "count",
      `only ${fs.length} frame(s) in ${opts.range[0]}–${opts.range[1]} — a direction needs three.`,
    );
  }
  const c = fs.map((f) => inkCentroid(f.gray, opts)[axis]);
  let sign = 0;
  let reversals = 0;
  let worst = fs[0].index;
  for (let i = 1; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    if (Math.abs(d) < eps) continue;
    const s = Math.sign(d);
    if (sign && s !== sign) {
      reversals++;
      worst = fs[i].index;
    }
    sign = s;
  }
  return {
    check: "centroidMonotonic",
    value: reversals,
    unit: "count",
    threshold: 0,
    pass: reversals === 0,
    frame: reversals ? worst : undefined,
    series: c,
    detail: reversals
      ? `the ink's ${axis} centroid changes direction ${reversals} times under a monotone transform — the type is snapping to the pixel grid. Pivot the scale on the baseline.`
      : `${axis} centroid monotone across ${c.length} frames.`,
  };
}

/** Skill check 3 — `ink area / bboxWidth²` is invariant under a pure scale.
 *  Drift means the glyph OUTLINES are changing shape (hinting).
 *  Measured: 3.41% hinted, 0.22% with `text-rendering: geometricPrecision`. */
export function shapeInvariant(
  frames: Frame[],
  opts: { background: number; range: [number, number]; tolerance?: number },
): Measurement {
  const fs = inRange(frames, opts.range);
  const ratios: number[] = [];
  for (const f of fs) {
    const k = ink(f.gray, {
      background: opts.background,
      tolerance: opts.tolerance,
    });
    if (!k.bbox) continue;
    const w = k.bbox.x1 - k.bbox.x0;
    if (w <= 0) continue;
    let area = 0;
    for (const c of k.columns) area += c;
    ratios.push(area / (w * w));
  }
  if (ratios.length < 2) {
    return unjudged(
      "shapeInvariant",
      "fraction",
      `only ${ratios.length} inked frame(s) in ${opts.range[0]}–${opts.range[1]}.`,
    );
  }
  const lo = Math.min(...ratios);
  const hi = Math.max(...ratios);
  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const drift = mean ? (hi - lo) / mean : 0;
  return {
    check: "shapeInvariant",
    value: drift,
    unit: "fraction",
    threshold: 0.01,
    pass: drift <= 0.01,
    series: ratios,
    detail:
      drift <= 0.01
        ? `ink area / width² holds to ${(drift * 100).toFixed(2)}% across ${ratios.length} frames.`
        : `ink area / width² drifts ${(drift * 100).toFixed(2)}% under a scale — hinting is re-snapping the stems and the letterforms are boiling. Set text-rendering: geometricPrecision.`,
  };
}

/** Skill check 4 — no frame may move less than `minStep` px while it is supposed
 *  to be animating; sub-pixel motion rasterises to an identical frame.
 *  A settle worth one frame is a settle, a settle worth five is a freeze.
 *  Measured: 5 of 14 frames under cubic-bezier(0.22, 1, 0.36, 1). */
export function noFrozenFrames(
  frames: Frame[],
  opts: {
    background: number;
    foreground: number;
    range: [number, number];
    minStep?: number;
    axis?: "x" | "y";
    box?: Box;
  },
): Measurement {
  const minStep = opts.minStep ?? 0.5;
  const axis = opts.axis ?? "y";
  const fs = inRange(frames, opts.range);
  if (fs.length < 2) {
    return unjudged(
      "noFrozenFrames",
      "count",
      `only ${fs.length} frame(s) in ${opts.range[0]}–${opts.range[1]}.`,
    );
  }
  const c = fs.map((f) => inkCentroid(f.gray, opts)[axis]);
  const steps: number[] = [];
  let run = 0;
  let longest = 0;
  let worst = fs[0].index;
  for (let i = 1; i < c.length; i++) {
    const step = Math.abs(c[i] - c[i - 1]);
    steps.push(step);
    if (step < minStep) {
      run++;
      if (run > longest) {
        longest = run;
        worst = fs[i].index;
      }
    } else run = 0;
  }
  return {
    check: "noFrozenFrames",
    value: longest,
    unit: "count",
    threshold: 1,
    pass: longest <= 1,
    frame: longest > 1 ? worst : undefined,
    series: steps,
    detail:
      longest <= 1
        ? `longest run of sub-${minStep}px frames is ${longest} — a settle, not a freeze.`
        : `${longest} consecutive frames move less than ${minStep}px while animating (ends at frame ${worst}) — they rasterise identically and the motion visibly stops dead. Use a moderate decelerate, not quint/expo.`,
  };
}

// ---------------------------------------------------------------------------
// Edge bleed — content the copy pushed off the frame.
// ---------------------------------------------------------------------------

export interface EdgeBleedOptions {
  /** Band depth in px. Default 8 at 720p. */
  band?: number;
  /** An edge inked along at least this fraction of its length is a full-bleed
   *  fill (a background, a device at the crop), not clipped content.
   *  Default 0.98. Only used by the single-render report. */
  fullBleed?: number;
  tolerance?: number;
}

export interface EdgeBleed {
  /** Per edge, per frame: the fraction of that edge's LENGTH along which the
   *  band holds ink (rows for left/right, columns for top/bottom). */
  series: Record<Edge, number[]>;
  /** Peak per edge over the whole clip. */
  peak: Record<Edge, number>;
  /** Edges whose peak sits in (0, fullBleed) — partial contact, i.e. cut off. */
  partial: Edge[];
  /** Edges inked along ≥ fullBleed of their length — composition, not a bug. */
  filled: Edge[];
  worstFrame: number | null;
}

const EDGES: Edge[] = ["left", "right", "top", "bottom"];

function bandFraction(
  g: Gray,
  edge: Edge,
  band: number,
  background: number,
  tol: number,
): number {
  const { width, height, data } = g;
  const inked = (x: number, y: number) =>
    Math.abs(data[y * width + x] - background) > tol;
  if (edge === "left" || edge === "right") {
    const x0 = edge === "left" ? 0 : Math.max(0, width - band);
    const x1 = edge === "left" ? Math.min(width, band) : width;
    if (!height) return 0;
    let hit = 0;
    for (let y = 0; y < height; y++) {
      for (let x = x0; x < x1; x++) {
        if (inked(x, y)) {
          hit++;
          break;
        }
      }
    }
    return hit / height;
  }
  const y0 = edge === "top" ? 0 : Math.max(0, height - band);
  const y1 = edge === "top" ? Math.min(height, band) : height;
  if (!width) return 0;
  let hit = 0;
  for (let x = 0; x < width; x++) {
    for (let y = y0; y < y1; y++) {
      if (inked(x, y)) {
        hit++;
        break;
      }
    }
  }
  return hit / width;
}

export function edgeBleed(
  frames: Frame[],
  opts: EdgeBleedOptions = {},
): EdgeBleed {
  const band = opts.band ?? 8;
  const full = opts.fullBleed ?? 0.98;
  const tol = opts.tolerance ?? 12;
  const fs = [...frames].sort((a, b) => a.index - b.index);
  const series: Record<Edge, number[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  };
  let worstFrame: number | null = null;
  let worstSum = -1;
  for (const f of fs) {
    const bg = modalLevel(f.gray);
    let sum = 0;
    for (const e of EDGES) {
      const v = bandFraction(f.gray, e, band, bg, tol);
      series[e].push(v);
      sum += v;
    }
    if (sum > worstSum) {
      worstSum = sum;
      worstFrame = f.index;
    }
  }
  const peak = {} as Record<Edge, number>;
  for (const e of EDGES)
    peak[e] = series[e].length ? Math.max(...series[e]) : 0;
  return {
    series,
    peak,
    partial: EDGES.filter((e) => peak[e] > 0 && peak[e] < full),
    filled: EDGES.filter((e) => peak[e] >= full),
    worstFrame: fs.length ? worstFrame : null,
  };
}

/**
 * THE judged check. The component is its own control: edges the stress copy inks
 * that the component's own DEFAULT render does not. A full-frame background, a
 * device frame at the crop and a bleeding gradient all bleed identically in both,
 * so they score 0 and exclude themselves — no opt-out list, no per-component flag.
 *
 * Deliberately not "transient bleed absent at the settle frame": 45 chars at
 * fontSize 72 is ~1800px against a 1280px frame, so `text-reveal` is clipped at
 * rest too, not only mid-flight. The delta test catches both.
 */
export function edgeBleedDelta(
  stress: EdgeBleed,
  baseline: EdgeBleed,
  opts: { margin?: number } = {},
): Measurement {
  const margin = opts.margin ?? 0.02;
  const gained = EDGES.filter(
    (e) => stress.peak[e] - baseline.peak[e] > margin,
  );
  return {
    check: "edgeBleedDelta",
    value: gained.length,
    unit: "count",
    threshold: 0,
    pass: gained.length === 0,
    frame: gained.length ? (stress.worstFrame ?? undefined) : undefined,
    series: EDGES.map((e) => stress.peak[e] - baseline.peak[e]),
    detail: gained.length
      ? `the stress copy runs off ${gained.length} edge(s) the default render never touches (${gained
          .map(
            (e) =>
              `${e} ${(baseline.peak[e] * 100).toFixed(0)}%→${(stress.peak[e] * 100).toFixed(0)}%`,
          )
          .join(", ")}) — the line is being clipped, silently.`
      : "no edge is inked by the stress copy that the default render does not already ink.",
  };
}

// ---------------------------------------------------------------------------
// Subject coverage — how much of the frame is the thing the viewer must read.
// ---------------------------------------------------------------------------

export interface CoverageOptions {
  /** Grid cell in px. Default 16 — holds a glyph stem or a UI row, not a scene. */
  cell?: number;
  /** Luma std-dev inside a cell above which the cell holds DETAIL. Default 6:
   *  a flat bezel, a flat backdrop and a gradient wash sit below; type, UI
   *  chrome and chart bars sit above. */
  variance?: number;
}

/**
 * Fraction of the frame carrying detail — NOT the fraction that is non-background.
 * Corner sampling is the obvious answer and it is wrong twice: a full-bleed
 * recording has no background in its corners, and a laptop's flat body is neither
 * background nor product. Local variance answers the question actually asked
 * without knowing what any of it is. Measured on the shipped video: 16.5% inside
 * `laptop-frame` vs 33.7% un-framed, which `anatomy.md` bans.
 */
export function detailCoverage(g: Gray, opts: CoverageOptions = {}): number {
  const cell = opts.cell ?? 16;
  const varFloor = opts.variance ?? 6;
  const { width, height, data } = g;
  if (!width || !height) return 0;
  const cx = Math.ceil(width / cell);
  const cy = Math.ceil(height / cell);
  let detail = 0;
  for (let j = 0; j < cy; j++) {
    for (let i = 0; i < cx; i++) {
      const x1 = Math.min(width, (i + 1) * cell);
      const y1 = Math.min(height, (j + 1) * cell);
      let n = 0;
      let sum = 0;
      let sq = 0;
      for (let y = j * cell; y < y1; y++) {
        const r = y * width;
        for (let x = i * cell; x < x1; x++) {
          const v = data[r + x];
          n++;
          sum += v;
          sq += v * v;
        }
      }
      if (!n) continue;
      const sd = Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2));
      if (sd > varFloor) detail++;
    }
  }
  return detail / (cx * cy);
}

/**
 * Defect 3, measured the way the eye reads it: how much of the frame IS the
 * product.
 *
 * `detailCoverage` cannot answer that and must not be judged as if it could. It
 * counts high-frequency CELLS, so a laptop's bezel, hinge and drop shadow all
 * score as detail while a full-frame recording of a calm UI does not. Measured
 * on identical footage at identical frames: framed 12.6% vs bare 13.1% — no
 * separation at all — and on a cinematic take framed 10.8% vs bare 7.2%, where
 * the metric prefers the device frame. It is a busyness metric wearing a
 * subject-size metric's name.
 *
 * The subject is instead exactly the pixels that CHANGE when the screen source
 * changes: the chassis around it does not, the backdrop does not, only the
 * content does. Same "the component is its own control" trick `edgeBleedDelta`
 * uses, and it needs no idea what any of the pixels are.
 *
 * Measured: laptop-frame 25.3%, phone-frame 40.3%, screen-recording bare 99.8%
 * — against the human's hand measurement of the shipped video, 16.5% framed vs
 * 33.7% bare. Reported, never judged: a device frame is not a broken component,
 * it is a cost, and the beat that pays it is the planner's call.
 */
export function subjectArea(
  a: Frame[],
  b: Frame[],
  opts: { noise?: number } = {},
): Measurement {
  const noise = opts.noise ?? 8;
  const as = [...a].sort((x, y) => x.index - y.index);
  const bs = new Map(b.map((f) => [f.index, f]));
  const moved: number[] = [];
  for (const f of as) {
    const other = bs.get(f.index);
    if (other) moved.push(frameDiff(f.gray, other.gray, noise).moved);
  }
  if (!moved.length) {
    return unjudged(
      "subjectArea",
      "fraction",
      "no frame pair to compare — the two source renders share no frame index.",
    );
  }
  const value = median(moved);
  return {
    check: "subjectArea",
    value,
    unit: "fraction",
    threshold: null,
    pass: null,
    series: moved,
    detail: `the screen content holds ${(value * 100).toFixed(1)}% of the frame (median over ${moved.length} frames, measured as the pixels that change when the source does). Reported, not judged — a device frame is a cost, not a bug.`,
  };
}

/** value = MEDIAN coverage over the clip (median, not mean: an entry animation
 *  starts on an empty frame). `min` supplied only where the caller declares the
 *  beat a product shot (0.25); otherwise threshold null / pass null. */
export function coverageCheck(
  frames: Frame[],
  opts: CoverageOptions & { min?: number } = {},
): Measurement {
  if (!frames.length) {
    return unjudged("detailCoverage", "fraction", "no frames.");
  }
  const series = [...frames]
    .sort((a, b) => a.index - b.index)
    .map((f) => detailCoverage(f.gray, opts));
  const value = median(series);
  if (opts.min === undefined) {
    return {
      check: "detailCoverage",
      value,
      unit: "fraction",
      threshold: null,
      pass: null,
      series,
      detail: `${(value * 100).toFixed(1)}% of the frame carries detail (median over ${series.length} frames). Not judged — no product-shot floor was declared.`,
    };
  }
  const pass = value >= opts.min;
  return {
    check: "detailCoverage",
    value,
    unit: "fraction",
    threshold: opts.min,
    pass,
    series,
    detail: pass
      ? `${(value * 100).toFixed(1)}% of the frame carries detail.`
      : `only ${(value * 100).toFixed(1)}% of the frame carries detail against a ${(opts.min * 100).toFixed(0)}% floor — the product is a distant floating window. Show it big and legible.`,
  };
}
