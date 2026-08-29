/**
 * Facts that came out of a renderer.
 *
 * Everything in `registry/*​/*​/config.ts` is hand-written: cheap, exact, true the
 * moment somebody types it. Everything here cost a Chromium and several minutes,
 * which is why it is a separate file written by a separate command
 * (`pnpm run measure`) and NOT a field on `ComponentConfig`. Merged into
 * props.json, one of two things happens and both are bad: `registry:build` grows
 * a browser dependency and stops working on the boxes it has to work on, or the
 * measured fields get regenerated as `undefined` every time somebody edits a
 * label. Separate file, separate lifetime, one hash tying it back to the source
 * it describes.
 *
 * Re-declared in `snapcn-mcp/src/registry.ts` — separate packages, no shared
 * module, and the dependency runs the other way. `version` is what catches a
 * divergence.
 */
export interface MeasuredComponent {
  /**
   * sha256:12 over the component's own directory plus `registry/snap-cn-ui/` —
   * its source and the shared tier every component composes. A measurement is a
   * claim ABOUT A SOURCE; without this it is a claim about nothing. Recomputed
   * at snapshot time, and a mismatch drops the entry.
   *
   * ponytail: the shared half is the whole snap-cn-ui tree, so a theme edit
   * invalidates every measurement at once. That is loud and correct and rare.
   * Narrow it to the files a component actually imports only if it starts
   * costing people re-measures they did not need.
   */
  sourceHash: string;

  /** The composition every number below is true for. A copy budget with no
   *  width is not a number, and 1280 is not the only width this ships at. */
  width: number;
  height: number;
  fps: number;
  /** The component's declared length, so the settle comparison has a baseline. */
  durationInFrames: number;

  /**
   * When the animation stops changing, as a function of how much copy it carries.
   *
   * NOT one number, and that is the whole design. text-build settles at 41f on
   * its own four-word default and at 74f on ten words — and it was the second one
   * that was still gaining words while the next beat faded in over it. A scalar
   * `settleFrame: 41` passes every check and ships the defect. Two measured
   * points, linear between them:
   *
   *   settleFrame(words) = base + perWord * (words - baseWords)
   *
   * `perWord` is 0 and `baseWords` is the default copy's word count for a
   * component with no text control — the model degrades to the scalar exactly
   * where the scalar was never wrong.
   *
   * ponytail: linear between two points. If a component ever settles
   * non-linearly in word count, measure a third and fit it; nothing else changes.
   */
  settle: { base: number; baseWords: number; perWord: number };

  /**
   * How much copy fits on one line, measured.
   *
   * Absent when it could not be measured honestly — the calibration string
   * wrapped (so there is no single-line budget), or the component's own default
   * copy already clipped (so px-per-char is a lower bound and any budget built on
   * it is a lie). A missing budget reads exactly like the world before this file
   * existed. A wrong one does not.
   */
  copy?: {
    /** The text control this budget belongs to. */
    prop: string;
    /**
     * Widest ink bounding box over the WHOLE animation ÷ characters. The max over
     * frames, never the resting width: text-reveal centres a line as it grows, so
     * it overflows mid-animation and settles back inside the frame. The last
     * frame — the one an agent looks at — is fine.
     */
    pxPerChar: number;
    /** Characters that fit in `width` with a 6% margin. Checkable by a tool
     *  holding nothing but the user's string and `.length`. */
    maxChars: number;
  };
}

export interface Measured {
  /** Bumped when a field changes meaning. A reader that does not know the
   *  version ignores the file rather than misreading it. */
  version: 1;
  measuredAt: string;
  components: Record<string, MeasuredComponent>;
}
