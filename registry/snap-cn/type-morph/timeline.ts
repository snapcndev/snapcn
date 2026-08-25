/**
 * Every number here was measured off the reference recording, frame by frame.
 *
 * Source: a 30fps screen recording, 89 frames, 1400x762. Frames were cut at
 * 30fps and each reduced to signals — the bounding box of ink (a green-channel
 * threshold isolates glyph cores and rejects the violet bloom, which a mean-RGB
 * threshold does not), the centroid and count of chromatic pixels, and mean
 * luminance. Curves were then fitted against exponential, polynomial and
 * cubic-bezier families and the residuals compared, rather than a shape being
 * assumed.
 *
 * Frame numbers below are 0-based composition frames. The source's `g001.png` is
 * frame 0.
 */

export const FPS = 30;

// ── The opening ──────────────────────────────────────────────────────────────

/**
 * Frames 0 to `CUT_AT` belong to `text-reveal`, which this component mounts
 * rather than reimplements — so its schedule lives there, not here.
 *
 * What the reference does in those frames is a *typewriter*: a constant
 * 1.5467 frames per character with the final full stop held back five frames,
 * each glyph landing at 1.178x and settling over five, arriving near-black with
 * a violet cast (#292541) rather than at the caret's own light violet. That is
 * documented because it was measured and is worth keeping, not because anything
 * below consumes it — `text-reveal` assembles word by word instead, which is a
 * different animation and a deliberate choice.
 */

// ── The slide ────────────────────────────────────────────────────────────────

/**
 * The re-centring move is ONE continuous curve, and it starts before the cut.
 *
 * This is the correction that mattered most. The obvious reading is "the lead is
 * cut, then what is left slides back to centre", which makes the motion start at
 * the cut. It does not. The line is already moving five frames earlier, and one
 * 16-frame cubic-bezier fits all 17 frames of it — through the cut — to a mean
 * error of 0.067px, max 0.23px.
 *
 * Alternatives on the same data: exponential decay 8.76px, a Remotion spring
 * with five free parameters 2.07px, degree-6 polynomial 1.60px, cubic 6.94px.
 * The bezier is better by two orders of magnitude, so this is not a close call.
 *
 * The consequence for the implementation: **the cut is a visibility change, not
 * a position change.** Residuals across it are +0.080 (before) and -0.108
 * (after) — nothing jumps. Earlier versions modelled a "pre-cut drift" and a
 * separate slide, which is the same curve described as two and fitted twice.
 */
export const SLIDE_FROM = 39;
export const SLIDE_TO = 55;
export const SLIDE_BEZIER = [0.3438, 0.0294, 0.032, 0.9269] as const;

/** The lead stops being drawn here. Position is unaffected — see `SLIDE_BEZIER`. */
export const CUT_AT = 44;

// ── The morph ────────────────────────────────────────────────────────────────

export const MORPH_FROM = 56;
export const MORPH_TO = 67;

// ── The exit ─────────────────────────────────────────────────────────────────

/**
 * The exit drift: geometric per-frame velocity, i.e. an exponential ease-in.
 *
 * Starts at frame 72 — the frames before it are static to within 0.005px, and
 * frame 73 is the first displaced one at 0.73px. Sub-pixel displacements are
 * 0.73, 1.99, 3.70, 6.05, 9.76, 16.28, 30.03, 54.2; the integer bounding box
 * reads those as 1,2,3,7,9,16,29,54 because motion blur erodes a thresholded
 * edge, which is why an earlier hand-fit had both the start frame and the first
 * step wrong.
 *
 * Fit: 0.36px mean error. Quadratic is 8.60px, cubic 3.42px, easeInQuart 1.72px.
 */
export const EXIT_FROM = 72;
export const EXIT_RATIO = 1.76456;
export const EXIT_COEFF = 1.3194;

/** The cut to the final phrase. */
export const CUT2_AT = 81;

// ── The ending ───────────────────────────────────────────────────────────────

/** Frames the final phrase is held when there is no flood. */
export const FINAL_HOLD = 12;
/** Each flood stage. Both are single-frame cuts to a flat colour, not ramps. */
export const FLOOD_STAGE_FRAMES = 4;

/**
 * The reference's own palette. Component defaults come from the design system;
 * these are here so the doc and the preview can quote what was measured.
 *
 * The page is #f7f7f7 for the whole non-flood run and never changes — the
 * per-channel median is exactly 247 on 79 of 82 frames, reading 249 only where
 * a grain overlay peaks.
 */
export const REFERENCE = {
  page: "#f7f7f7",
  ink: "#1f1f1f",
  caret: "#b3a9f9",
  floodA: "#8575fa",
  floodB: "#4931f2",
} as const;

/** Total frames, end to end. */
export function totalFrames(hasFlood = false): number {
  return CUT2_AT + 1 + (hasFlood ? FLOOD_STAGE_FRAMES * 2 : FINAL_HOLD);
}
