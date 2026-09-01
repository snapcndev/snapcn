import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ComponentConfig } from "../lib/customizer-config.ts";
import {
  type Capture,
  captureFrames,
  motionCheckServeUrl,
} from "../lib/motion-check/capture.ts";
import {
  centroidMonotonic,
  coverageCheck,
  edgeBleed,
  edgeBleedDelta,
  foregroundLevel,
  holdIsStill,
  ink,
  type Measurement,
  modalLevel,
  noFrozenFrames,
  type Settle,
  settleFrame,
  settlesBeforeTransition,
  shapeInvariant,
  subjectArea,
} from "../lib/motion-check/measure.ts";
import type { Measured, MeasuredComponent } from "./lib/measured.ts";
import { sourceHash } from "./lib/source-hash.mts";

/**
 * Measure every registry component on RENDERED FRAMES and write
 * `registry/__measured__.json`.
 *
 * The motion-quality skill opens with "you cannot see a sub-pixel bug — render
 * the frames and measure them", and then documents the checks as prose. So every
 * agent re-derived the measurement by hand, badly, or skipped it, and three
 * defects shipped in one video that no test could have caught:
 *
 *   1. a beat still animating when the next faded in over it  -> settle frame
 *   2. a 45-char line sliding off the frame, silently         -> capacity
 *   3. the product rendered as a distant window               -> detail coverage
 *
 *   node scripts/motion-check.mts                 # only components whose source changed
 *   node scripts/motion-check.mts --all           # the whole registry
 *   node scripts/motion-check.mts --only text-build,text-reveal
 *   node scripts/motion-check.mts --all --no-capacity   # skip the copy-budget sweep
 *
 * Exit code is non-zero when any measurement has `pass === false`. This is NOT
 * in `pnpm test`: it needs chromium and takes minutes — see package.json.
 *
 * The file it writes is `scripts/lib/measured.ts`'s `Measured` shape, because
 * that is what `snapcn-mcp/scripts/build-manifest.mjs` reads, re-hashes and
 * copies into `props.json` — and a measured fact that does not reach
 * `snapcn_plan_video` changes nothing about the video that ships. The per-check
 * verdicts this prints ride along under `report`, which that reader ignores; it
 * is what lets a re-run with no changes print the last audit in a second
 * instead of six minutes.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const REPO = new URL(`${root}/`, "file:");

/**
 * @remotion/transitions' overlap — `snapcn-mcp/src/tools.ts:863`. The last 18
 * frames of every beat are shared with the next one, so a beat that is still
 * animating at frame `duration - 18` is animating underneath its successor.
 */
const TRANSITION_FRAMES = 18;

/**
 * Components whose whole job is to show the product. `anatomy.md:82` bans a
 * distant floating window, and the shipped video put the product at 16.5% of
 * the frame inside `laptop-frame` against 33.7% un-framed.
 *
 * They are measured with `subjectArea`, not with a `detailCoverage` floor. The
 * floor was here and it was wrong twice over: on identical footage at identical
 * frames it scored framed 12.6% against bare 13.1% (no separation), and on a
 * cinematic take it scored the FRAMED shot higher (10.8% vs 7.2%) — it counts
 * busyness, and a laptop's bezel and shadow are busy. It also failed
 * `screen-recording` (10.0%) and `cursor-track` (0.1%) permanently: the bare
 * product shot the human called the best in the video, red on every run. A gate
 * that is always red is a gate somebody switches off.
 *
 * `subjectArea` renders the same component twice with two different screen
 * sources: the pixels that change ARE the product. laptop-frame 25%,
 * phone-frame 40%, screen-recording 100%. Reported, never judged — a device
 * frame is a cost, and which beat can afford it is the planner's call
 * (`snapcn-mcp/src/skills.ts` spends that number in the screen-demo recipe).
 */
const PRODUCT_SHOTS = new Set([
  "laptop-frame",
  "phone-frame",
  "screen-recording",
  "cursor-track",
]);

/**
 * The second screen source. Any asset in the repo that is not a component's own
 * default will do — it is a differ, not a fixture, and `subjectArea` reports
 * nothing rather than 0 when a component ignores the prop.
 */
const ALT_SOURCE = "/showcase-videos/iphone-17-reveal.mp4";

/** Edge band depth, in px, shared by the bleed check and the capacity predictor. */
const BAND = 8;

export interface ComponentReport {
  slug: string;
  settleFrame: number | null;
  settleFrameAtCapacity: number | null;
  neverSettles: boolean;
  durationInFrames: number;
  capacity: Record<
    string,
    { maxChars: number; atFontSize: number | null; measuredWith: string }
  >;
  detailCoverage: number;
  /** Defect 3: the product's share of the frame. Null where nothing measured it. */
  subject: number | null;
  measurements: Measurement[];
}

// --------------------------------------------------------------------------
// CLI
// --------------------------------------------------------------------------

function getFlag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && i + 1 < process.argv.length) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

// --------------------------------------------------------------------------
// Registry
// --------------------------------------------------------------------------

/**
 * `registry/__configs__.ts` is the driver: it is where SHARED_CONTROLS is merged
 * and the MIN_SPEED_ONE overrides are applied, so it is the only place that
 * knows a component's real runtime controls. Node resolves neither the `@/`
 * alias nor extensionless relative imports; teach it both, exactly as
 * `snapcn-mcp/scripts/build-manifest.mjs` already does.
 */
async function loadConfigs(): Promise<Record<string, ComponentConfig>> {
  // `node:module`'s `registerHooks` is Node >= 22.15 and this repo is on
  // @types/node 20, so the shape is declared here rather than bumping types the
  // whole app would have to absorb.
  const { registerHooks } = (await import("node:module")) as unknown as {
    registerHooks: (hooks: {
      resolve: (
        spec: string,
        ctx: unknown,
        next: (s: string, c: unknown) => unknown,
      ) => unknown;
    }) => void;
  };
  registerHooks({
    resolve(spec: string, ctx: unknown, next) {
      if (spec.startsWith("@/")) spec = new URL(spec.slice(2), REPO).href;
      try {
        return next(spec, ctx);
      } catch {
        return next(`${spec}.ts`, ctx);
      }
    },
  });
  const mod = await import(new URL("registry/__configs__.ts", REPO).href);
  return mod.CONFIGS;
}

// --------------------------------------------------------------------------
// Copy budget
// --------------------------------------------------------------------------

/**
 * A stress string of ~`chars` characters, built from the component's own default
 * copy so it keeps its register (a headline stays a headline) and stays
 * deterministic. Cut on a word boundary — a component that wraps must be given
 * something it can wrap.
 */
export const wordsIn = (s: string) =>
  s.trim().split(/\s+/).filter(Boolean).length;

export function stressCopy(base: string, chars: number): string {
  const words = base.trim().split(/\s+/);
  const out: string[] = [];
  let len = -1;
  for (let i = 0; len < chars; i++) {
    const word = words[i % words.length];
    if (len + 1 + word.length > chars) break;
    out.push(word);
    len += 1 + word.length;
  }
  return out.join(" ") || base.slice(0, chars);
}

/**
 * A `text` control is not necessarily COPY. The registry also carries SVG path
 * data (`announce-title`'s `symbolPath`), colour lists and image URLs as text
 * controls, and sweeping a `d` attribute out to 1500 characters measures nothing
 * and costs three renders.
 */
export function isCopy(value: string): boolean {
  if (value.trim().length === 0 || value.length > 200) return false;
  if (/^(https?:|data:|\/)/.test(value)) return false;
  if (/^[Mm][\s\d.-]/.test(value)) return false;
  if (/^#[0-9a-f]{3,8}/i.test(value)) return false;
  // CSS values ride in text controls too — `laptop-frame.shadow` is
  // "0 40px 80px rgba(10,12,20,0.45)".
  if (/\d+px|rgba?\(|^var\(/.test(value)) return false;
  return true;
}

/** Widest ink bbox over a sample of the clip — the line at its longest. */
function widestInk(capture: Capture, step = 5): number {
  let widest = 0;
  for (let i = 0; i < capture.frames.length; i += step) {
    const box = ink(capture.frames[i].gray).bbox;
    if (box) widest = Math.max(widest, box.x1 - box.x0 + 1);
  }
  return widest;
}

/**
 * Predict, then verify. px-per-char from the default render's ink bbox gives a
 * first length; render the full clip there and at +10% and keep the largest with
 * zero bleed delta against the component's own default render.
 *
 * ~3 renders per text prop instead of a 7-step binary search, because bleed is
 * monotone in char count.
 *
 * ponytail: maxChars is a char count standing in for rendered width, so an
 * all-caps or W-heavy line still overflows under the limit and a line of i's is
 * refused under it. Upgrade path is publishing px-per-char here and having
 * `snapcn_plan_video` measure the actual string.
 */
export async function measureCapacity(
  slug: string,
  prop: string,
  serveUrl: string,
  baseline: Capture,
  defaultCopy: string,
  fontSize: number | null,
): Promise<{
  capacity: {
    maxChars: number;
    atFontSize: number | null;
    measuredWith: string;
  } | null;
  /** False when even 0.75x the prediction bled: the published number is the
   *  component's own default length, a floor rather than a measured ceiling. */
  verified: boolean;
  settle: Settle | null;
  /** Ink bbox width per character at the default copy — the honest unit. A char
   *  count is a proxy for it, and the proxy is what a tool can check cheaply. */
  pxPerChar: number;
  /** Words in the copy `settle` was measured on. */
  words: number;
  /** Frames the clip was extended to when the stress copy outran the component's
   *  own length; null when the declared length was enough. */
  extendedTo: number | null;
  renders: number;
}> {
  const base = edgeBleed(baseline.frames, { band: BAND });
  const pxPerChar =
    widestInk(baseline) / Math.max(defaultCopy.trim().length, 1);
  const predicted =
    pxPerChar > 0
      ? Math.max(8, Math.round((baseline.width - 2 * BAND) / pxPerChar))
      : defaultCopy.length;

  let renders = 0;
  type Accepted = { chars: number; copy: string; capture: Capture };
  let best: Accepted | null = null;

  // Largest first: if +10% is clean there is nothing below it to find.
  for (const chars of [
    Math.round(predicted * 1.1),
    predicted,
    Math.round(predicted * 0.75),
  ]) {
    // Every acceptance below breaks, so there is nothing to compare against.
    if (chars < 1) continue;
    const copy = stressCopy(defaultCopy, chars);
    // The prediction can land on the component's own default copy (a short
    // one-line prop, a budget that fits it exactly). Then the baseline IS this
    // render: accepting it costs nothing, and rendering it again would trip the
    // props-landed assert on a frame that is identical for a legitimate reason.
    if (copy.trim() === defaultCopy.trim()) {
      best = { chars: copy.length, copy, capture: baseline };
      break;
    }
    const capture = await captureFrames({
      slug,
      serveUrl,
      inputProps: { [prop]: copy },
    });
    renders += 1;
    if (!propsLanded(baseline, capture)) {
      // This prop does not move a pixel, so there is no width to run out of.
      inertProps.push(`${slug}.${prop}`);
      return {
        capacity: null,
        verified: false,
        settle: null,
        pxPerChar,
        words: 0,
        extendedTo: null,
        renders,
      };
    }
    const bleed = edgeBleedDelta(
      edgeBleed(capture.frames, { band: BAND }),
      base,
    );
    if (bleed.pass !== false) {
      best = { chars: copy.length, copy, capture };
      break;
    }
  }

  if (!best) {
    // Even three quarters of the prediction overflows: report the default copy's
    // own length as the ceiling rather than inventing one.
    return {
      capacity: {
        maxChars: defaultCopy.trim().length,
        atFontSize: fontSize,
        measuredWith: defaultCopy,
      },
      verified: false,
      settle: null,
      pxPerChar,
      words: wordsIn(defaultCopy),
      extendedTo: null,
      renders,
    };
  }

  // A stress copy can need more frames than the component's author allowed. The
  // settle frame is then simply not inside the window, and "never settles" would
  // report it as a loop — so re-render the same copy over twice the length and
  // measure where it actually stops. That number is what a planner has to bill,
  // and it is the difference between defect 1 being a fact and being a shrug.
  let settle = settleFrame(best.capture.frames);
  let extendedTo: number | null = null;
  if (settle.neverSettles) {
    extendedTo = Math.min(baseline.durationInFrames * 2, 900);
    const longer = await captureFrames({
      slug,
      serveUrl,
      inputProps: { [prop]: best.copy },
      durationInFrames: extendedTo,
    });
    renders += 1;
    settle = settleFrame(longer.frames);
  }

  return {
    capacity: {
      maxChars: best.chars,
      atFontSize: fontSize,
      measuredWith: best.copy,
    },
    verified: true,
    settle,
    pxPerChar,
    words: wordsIn(best.copy),
    extendedTo,
    renders,
  };
}

/**
 * The whole capacity and bleed-delta story is worthless if `inputProps` never
 * reached the component — without the `defaultProps` edit in
 * `src/remotion/dev-root.tsx` the stress render silently returns the default
 * copy and every number comes back clean and wrong. Frame hashes are already in
 * hand, so the check is free: a different string cannot rasterise identically.
 *
 * It is a check on the WIRING, though, not on one prop. Some text controls
 * genuinely do not move a pixel — `type-morph`'s `emphasis` is a word that has
 * to appear in the body copy, `hero-launch`'s heading may be off-screen at the
 * defaults — so one identical pair is a fact about that prop, and only a run in
 * which NO stress render ever differed is the wiring bug.
 */
let propsHaveLanded = false;
const inertProps: string[] = [];

function propsLanded(baseline: Capture, stress: Capture): boolean {
  const landed = stress.frames.some(
    (f, i) => !baseline.frames[i] || baseline.frames[i].hash !== f.hash,
  );
  if (landed) propsHaveLanded = true;
  return landed;
}

/** Called once at the end of a run: nothing anywhere reacted to `inputProps`. */
function assertWiring(): void {
  if (propsHaveLanded || inertProps.length === 0) return;
  throw new Error(
    `inputProps reached nothing in ${inertProps.length} stress render(s) ` +
      `(${inertProps.slice(0, 3).join(", ")}…). src/remotion/dev-root.tsx must ` +
      `pass defaultProps and let Stage take props, or every capacity and ` +
      `bleed number in this run is clean and wrong.`,
  );
}

// --------------------------------------------------------------------------
// One component
// --------------------------------------------------------------------------

async function measureOne(
  slug: string,
  config: ComponentConfig,
  serveUrl: string,
  withCapacity: boolean,
): Promise<{
  report: ComponentReport;
  measured: Omit<MeasuredComponent, "sourceHash"> & {
    detailCoverage: number;
    subject?: number;
  };
  frames: number;
}> {
  const baseline = await captureFrames({ slug, serveUrl });
  let frames = baseline.frames.length;

  const settle = settleFrame(baseline.frames);
  const atDefaults = settlesBeforeTransition(
    settle,
    baseline.durationInFrames,
    TRANSITION_FRAMES,
  );
  // A registry component's `durationInFrames` IS its animation's length — that
  // is how every config in this repo is authored — so at its own defaults a
  // component settling on its last frame is not a defect, it is the definition.
  // Measured on the first full run: 12 of 32 failed this at defaults, most by
  // one to three frames, and a check that fails a third of the registry for
  // doing what it was authored to do is a check nobody trusts.
  //
  // The number is still THE missing number. It is published so the planner can
  // bill `settle + 18` instead of `durationInFrames`; the judged case is the
  // one below, where the COPY is what pushed the beat past its own end.
  if (atDefaults.pass === false) {
    atDefaults.pass = null;
    atDefaults.detail += ` Reported, not judged: bill this beat at ${settle.frame} + ${TRANSITION_FRAMES} frames instead of its ${baseline.durationInFrames}-frame length.`;
  }
  const measurements: Measurement[] = [atDefaults];

  // Skill check 1 — frames where nothing is animating must be byte-identical.
  // The window has to be a hold, and the settle frame only promises motion
  // BELOW the settle threshold after it, not zero motion: a blinking caret, a
  // counter ticking one digit, or `screen-recording` still playing its take all
  // change bytes for a legitimate reason. Measured on the first full run:
  // judging the raw settle window failed 10/32 components, including 16
  // distinct rasterisations across `screen-recording`'s "hold" — which is the
  // recording, not a bug. So the verdict is only taken where NOTHING moved by
  // more than the luma noise floor; everywhere else the count is reported.
  //
  // ponytail: a real hold is a DECLARED range (the author knows the animation
  // ends at frame N). A measured one cannot tell a caret from a bug. Upgrade is
  // a `hold` field in the component config, if one is ever worth writing.
  const last = baseline.frames.length - 1;
  const holdMoves =
    settle.frame === null
      ? 1
      : Math.max(0, ...settle.motion.slice(settle.frame + 1, last + 1));
  measurements.push(
    settle.frame !== null && last - settle.frame >= 2 && holdMoves === 0
      ? holdIsStill(baseline.frames, [settle.frame, last])
      : {
          check: "holdIsStill",
          value:
            settle.frame !== null && last - settle.frame >= 2
              ? new Set(
                  baseline.frames
                    .slice(settle.frame, last + 1)
                    .map((f) => f.hash),
                ).size
              : null,
          unit: "count",
          threshold: null,
          pass: null,
          detail: settle.neverSettles
            ? "never settles — no hold to compare."
            : last - (settle.frame ?? 0) < 2
              ? "settles inside the last two frames — no hold to compare."
              : `${(holdMoves * 100).toFixed(3)}% of pixels still move after the settle frame (a caret, a counter, a playing recording) — reported, not judged: byte-identity only applies where nothing moves at all.`,
        },
  );

  // The three Rule-0 checks from the `motion-quality` skill. They were
  // implemented and then had ZERO callers, which is the same as not having them:
  // the skill's whole point is that these bugs are invisible until measured.
  //
  // Judged vs reported is not squeamishness. `noFrozenFrames` is valid for any
  // animation — a frame that moves less than half a pixel rasterises identically
  // and reads as a stall. The other two assume a MONOTONE scale or translate,
  // which most of this registry is not (a status cycle reverses on purpose, a
  // chart grows bar by bar), so on an arbitrary component a direction reversal
  // is a fact about the animation rather than a defect. They are measured and
  // printed; a floor belongs on them only once a component declares it scales
  // text, which nothing does yet.
  //
  // ponytail: range is [0, settle] — the animating window. A component that
  // never settles is measured over the whole clip, which is the honest window
  // for it.
  const animEnd = settle.frame ?? baseline.frames.length - 1;
  if (animEnd >= 2) {
    const bg = modalLevel(baseline.frames[0].gray);
    const fg = foregroundLevel(baseline.frames[animEnd].gray, bg);
    const range: [number, number] = [0, animEnd];
    const geometry = { background: bg, foreground: fg, range };
    measurements.push(noFrozenFrames(baseline.frames, geometry));
    for (const m of [
      centroidMonotonic(baseline.frames, geometry),
      shapeInvariant(baseline.frames, { background: bg, range }),
    ]) {
      measurements.push({ ...m, threshold: null, pass: null });
    }
  }

  measurements.push(coverageCheck(baseline.frames));

  // Defect 3. One extra render for the handful of components that exist to show
  // the product, and only where an image control is what carries it.
  let subject: number | null = null;
  if (PRODUCT_SHOTS.has(slug)) {
    const [prop, control] =
      Object.entries(config.controls).find(
        ([, c]) => c.type === "image" && c.default !== ALT_SOURCE,
      ) ?? [];
    if (prop && control) {
      const alt = await captureFrames({
        slug,
        serveUrl,
        inputProps: { [prop]: ALT_SOURCE },
      });
      frames += alt.frames.length;
      const m = propsLanded(baseline, alt)
        ? subjectArea(baseline.frames, alt.frames)
        : {
            check: "subjectArea",
            value: null,
            unit: "fraction" as const,
            threshold: null,
            pass: null,
            detail: `changing ${prop} changes no pixel — this component does not render the source it is given.`,
          };
      subject = m.value;
      measurements.push(m);
    }
  }

  // The single-render bleed report. The judged one is the delta below, where a
  // component is its own control.
  const bleed = edgeBleed(baseline.frames, { band: BAND });
  measurements.push({
    check: "edgeBleed",
    value: bleed.partial.length,
    unit: "count",
    threshold: null,
    pass: null,
    detail:
      `partial [${bleed.partial.join(",") || "none"}] ` +
      `full-bleed [${bleed.filled.join(",") || "none"}]`,
    frame: bleed.worstFrame ?? undefined,
  });

  const capacity: ComponentReport["capacity"] = {};
  const points: Array<
    { prop: string } & Awaited<ReturnType<typeof measureCapacity>>
  > = [];
  let settleAtCapacity: number | null = null;

  if (withCapacity) {
    const fontSize =
      config.controls.fontSize && "default" in config.controls.fontSize
        ? (config.controls.fontSize.default as number)
        : null;
    for (const [prop, control] of Object.entries(config.controls)) {
      if (control.type !== "text" || !isCopy(control.default)) continue;
      const result = await measureCapacity(
        slug,
        prop,
        serveUrl,
        baseline,
        control.default,
        fontSize,
      );
      frames += result.renders * baseline.durationInFrames;
      if (result.capacity && !result.verified) {
        measurements.push({
          check: `capacity:${prop}`,
          value: result.capacity.maxChars,
          unit: "count",
          threshold: null,
          pass: null,
          detail:
            `even 0.75x the predicted length ran off an edge the default render ` +
            `never touches, so ${result.capacity.maxChars} chars is the default ` +
            `copy's own length — a floor, not a measured ceiling.`,
        });
      }
      if (!result.capacity) {
        measurements.push({
          check: `capacity:${prop}`,
          value: null,
          unit: "count",
          threshold: null,
          pass: null,
          detail:
            "changing this prop does not change a single frame — it is not copy " +
            "the component lays out (an emphasis word that must match the body, " +
            "a label the defaults never show). No copy budget to publish.",
        });
        continue;
      }
      capacity[prop] = result.capacity;
      points.push({ prop, ...result });
      if (!result.settle) continue;
      // The planner fills user copy, so it must bill the worst case.
      if (result.settle.frame !== null) {
        settleAtCapacity = Math.max(settleAtCapacity ?? 0, result.settle.frame);
      }
      const atCapacity = settlesBeforeTransition(
        result.settle,
        baseline.durationInFrames,
        TRANSITION_FRAMES,
      );
      atCapacity.check = `settlesBeforeTransition@capacity:${prop}`;
      if (result.extendedTo) {
        atCapacity.detail += ` Measured over ${result.extendedTo} frames: at ${result.capacity.maxChars} chars the copy does not finish inside the component's own ${baseline.durationInFrames}.`;
        if (atDefaults.pass === true) {
          atCapacity.pass = false;
          atCapacity.threshold =
            baseline.durationInFrames - TRANSITION_FRAMES - 1;
        }
      }
      // Same reasoning as `atDefaults`: this is defect 1 only when the longer
      // copy is what pushed the beat past its own end. A component that already
      // ran to its last frame at its default copy is a planner-billing fact,
      // not a copy-length failure.
      if (atCapacity.pass === false && atDefaults.pass !== true) {
        atCapacity.pass = null;
        atCapacity.detail +=
          " Reported, not judged: the default copy already settles inside the transition overlap, so the copy length is not what did this.";
      }
      measurements.push(atCapacity);
    }
  }

  const coverage = measurements.find((m) => m.check === "detailCoverage");
  const detail = coverage?.value ?? 0;

  // `settle(words) = base + perWord * (words - baseWords)` — the model
  // `scripts/lib/measured.ts` publishes, from the two points this run measured.
  // A component with no copy control (or one whose copy moves nothing) keeps
  // perWord 0, which degrades to the scalar exactly where the scalar was right.
  const base = settle.frame ?? baseline.durationInFrames;
  const worst = points
    .filter((p) => p.settle?.frame != null)
    .sort((a, b) => (b.settle?.frame ?? 0) - (a.settle?.frame ?? 0))[0];
  const baseWords = worst
    ? wordsIn(String(config.controls[worst.prop]?.default ?? ""))
    : 0;
  const dWords = worst ? worst.words - baseWords : 0;
  const perWord =
    worst && dWords > 0
      ? Math.max(
          0,
          Number((((worst.settle?.frame ?? base) - base) / dWords).toFixed(2)),
        )
      : 0;
  const budget = points
    .filter((p) => p.verified && p.capacity)
    .sort(
      (a, b) => (a.capacity?.maxChars ?? 0) - (b.capacity?.maxChars ?? 0),
    )[0];

  return {
    report: {
      slug,
      settleFrame: settle.frame,
      settleFrameAtCapacity: settleAtCapacity,
      neverSettles: settle.neverSettles,
      durationInFrames: baseline.durationInFrames,
      capacity,
      detailCoverage: detail,
      subject,
      measurements,
    },
    measured: {
      width: baseline.width,
      height: baseline.height,
      fps: baseline.fps,
      durationInFrames: baseline.durationInFrames,
      settle: { base, baseWords, perWord },
      ...(budget?.capacity
        ? {
            copy: {
              prop: budget.prop,
              pxPerChar: Number(budget.pxPerChar.toFixed(2)),
              maxChars: budget.capacity.maxChars,
            },
          }
        : {}),
      // Not in `MeasuredComponent`, and deliberately carried anyway: defect 3
      // was a product shot at 16.5% of the frame, and the planner cannot gate a
      // beat on a number nobody published. The MCP's reader copies the entry
      // whole, so it arrives without either side learning a new field.
      detailCoverage: Number(detail.toFixed(4)),
      ...(subject === null ? {} : { subject: Number(subject.toFixed(4)) }),
    },
    frames,
  };
}

// --------------------------------------------------------------------------
// The run
// --------------------------------------------------------------------------

const OUT = path.join(root, "registry", "__measured__.json");

/** The document on disk: `scripts/lib/measured.ts`'s shape, plus the audit's own
 *  verdicts under `report` (which the MCP's reader ignores). */
type Doc = Measured & {
  components: Record<
    string,
    MeasuredComponent & { detailCoverage?: number; subject?: number }
  >;
  report: Record<string, ComponentReport>;
};

function readDoc(): Doc {
  try {
    const doc = JSON.parse(readFileSync(OUT, "utf8"));
    return {
      version: 1,
      measuredAt: doc.measuredAt ?? "",
      components: doc.components ?? {},
      report: doc.report ?? {},
    };
  } catch {
    return { version: 1, measuredAt: "", components: {}, report: {} };
  }
}

export async function measureRegistry(
  only?: string[],
): Promise<ComponentReport[]> {
  const configs = await loadConfigs();
  const doc = readDoc();
  const withCapacity = !hasFlag("no-capacity");

  const hashes = new Map<string, string>();
  const slugs = (only ?? Object.keys(configs)).filter((slug) => {
    if (!configs[slug]) {
      console.error(`measure: no config for "${slug}"`);
      return false;
    }
    const hash = sourceHash(root, slug);
    if (!hash) {
      console.error(`measure: no registry directory for "${slug}" — skipped.`);
      return false;
    }
    hashes.set(slug, hash);
    if (only || hasFlag("all")) return true;
    // Incremental default: a component whose source has not moved cannot have
    // moved its numbers. Same hash the MCP re-checks before it copies one.
    return doc.components[slug]?.sourceHash !== hash;
  });

  if (slugs.length === 0) {
    console.log("measure: nothing changed — every entry is current.");
    return Object.values(doc.report);
  }

  console.log(`Bundling dev root once for ${slugs.length} component(s)…`);
  const t0 = Date.now();
  const serveUrl = await motionCheckServeUrl();
  const bundleMs = Date.now() - t0;
  console.log(`Bundled in ${(bundleMs / 1000).toFixed(1)}s`);

  let totalFrames = 0;
  const reports: ComponentReport[] = [];
  for (const [i, slug] of slugs.entries()) {
    const started = Date.now();
    try {
      const { report, measured, frames } = await measureOne(
        slug,
        configs[slug],
        serveUrl,
        withCapacity,
      );
      totalFrames += frames;
      reports.push(report);
      doc.report[slug] = report;
      // The hash is stamped from the SAME read the run was driven by, so a file
      // edited while the browser was busy cannot be recorded as measured.
      doc.components[slug] = {
        sourceHash: hashes.get(slug) as string,
        ...measured,
      };
      const fails = report.measurements.filter((m) => m.pass === false).length;
      console.log(
        `[${i + 1}/${slugs.length}] ${slug} — ${frames} frames, ` +
          `${((Date.now() - started) / 1000).toFixed(1)}s` +
          (fails ? `, ${fails} failing` : ""),
      );
    } catch (err) {
      console.error(
        `[${i + 1}/${slugs.length}] ${slug} — ${(err as Error).message}`,
      );
    }
  }

  // `series` is the per-frame curve a human argues with when a verdict looks
  // wrong — the skill's own rule is that a metric disagreeing with the eye is
  // the metric's problem, and that argument needs the raw curve. Keep it where
  // it will actually be read (a failure, and the settle curve every threshold
  // is tuned against), drop the rest, and round what stays: all of it at full
  // float precision is 418KB of committed noise.
  function round(this: Measurement, key: string, v: unknown) {
    if (
      key === "series" &&
      this.pass !== false &&
      this.check !== "settlesBeforeTransition"
    ) {
      return undefined;
    }
    return typeof v === "number" && !Number.isInteger(v)
      ? Number(v.toFixed(5))
      : v;
  }
  assertWiring();
  const sorted = <T,>(o: Record<string, T>) =>
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        version: 1,
        measuredAt: new Date().toISOString(),
        components: sorted(doc.components),
        report: sorted(doc.report),
      },
      round,
      2,
    )}\n`,
  );
  console.log(
    `\nWrote registry/__measured__.json — ${totalFrames} frames in ` +
      `${((Date.now() - t0) / 1000).toFixed(0)}s (bundle ${(bundleMs / 1000).toFixed(0)}s)`,
  );
  return reports;
}

/** One line per component, sorted by severity, naming the frame and the number. */
function report(reports: ComponentReport[]): void {
  const severity = (r: ComponentReport) =>
    r.measurements.filter((m) => m.pass === false).length;
  const rows = [...reports].sort(
    (a, b) => severity(b) - severity(a) || a.slug.localeCompare(b.slug),
  );

  const pad = (s: string, n: number) => s.padEnd(n);
  console.log(
    `\n${pad("component", 20)}${pad("settle", 12)}${pad("@capacity", 12)}${pad("detail", 9)}${pad("subject", 9)}${pad("copy budget", 22)}verdict`,
  );
  console.log("-".repeat(105));
  for (const r of rows) {
    const limit = r.durationInFrames - TRANSITION_FRAMES - 1;
    const settle = r.neverSettles ? "never" : `${r.settleFrame}/${limit}`;
    const overran = r.measurements.some(
      (m) =>
        m.check.startsWith("settlesBeforeTransition@capacity") &&
        m.pass === false,
    );
    // The tightest budget is the one a planner has to respect; the rest are in
    // the JSON.
    const budgets = Object.entries(r.capacity).sort(
      (a, b) => a[1].maxChars - b[1].maxChars,
    );
    const cap = budgets.length
      ? `${budgets[0][0]} ${budgets[0][1].maxChars}ch` +
        (budgets.length > 1 ? ` +${budgets.length - 1}` : "")
      : "—";
    const fails = r.measurements.filter((m) => m.pass === false);
    console.log(
      pad(r.slug, 20) +
        pad(settle, 12) +
        pad(
          r.settleFrameAtCapacity !== null
            ? `${r.settleFrameAtCapacity}/${limit}`
            : overran
              ? "never"
              : "—",
          12,
        ) +
        pad(`${(r.detailCoverage * 100).toFixed(1)}%`, 9) +
        pad(
          typeof r.subject === "number"
            ? `${(r.subject * 100).toFixed(1)}%`
            : "—",
          9,
        ) +
        pad(cap, 22) +
        (fails.length
          ? fails.map((f) => f.check).join(", ")
          : r.settleFrame !== null && r.settleFrame > limit
            ? `bill ${r.settleFrame}+${TRANSITION_FRAMES}`
            : r.neverSettles
              ? `bill ${r.durationInFrames} (never settles)`
              : "ok"),
    );
  }

  const failing = rows.flatMap((r) =>
    r.measurements
      .filter((m) => m.pass === false)
      .map((m) => ({ slug: r.slug, m })),
  );
  if (failing.length) {
    console.log(`\n${failing.length} failing measurement(s):`);
    for (const { slug, m } of failing) {
      console.log(
        `  ${slug} ${m.check}: ${m.value}${m.unit === "fraction" ? "" : ` ${m.unit}`}` +
          ` (limit ${m.threshold})` +
          (m.frame !== undefined ? ` at frame ${m.frame}` : "") +
          ` — ${m.detail}`,
      );
    }
  }
}

// Guarded so the pure helpers above are importable from a test without the
// import launching a browser and rendering the registry.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const only = getFlag("only")
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const reports = await measureRegistry(only);
  report(reports);
  process.exit(
    reports.some((r) => r.measurements.some((m) => m.pass === false)) ? 1 : 0,
  );
}
