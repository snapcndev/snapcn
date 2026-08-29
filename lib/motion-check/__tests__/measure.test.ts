import { describe, expect, it } from "vitest";
import {
  centroidMonotonic,
  coverageCheck,
  detailCoverage,
  edgeBleed,
  edgeBleedDelta,
  foregroundLevel,
  frameDiff,
  holdIsStill,
  ink,
  inkCentroid,
  modalLevel,
  noFrozenFrames,
  settleFrame,
  settlesBeforeTransition,
  shapeInvariant,
  subjectArea,
} from "../measure";
import { clipOf, drawRect, drawRectSubpixel, grayOf } from "../synthetic";

/**
 * Every check is proved to FIRE as well as to pass. A detector that cannot fail
 * is not a detector, and this library's whole job is to be believed — the three
 * defects that shipped were all found by a human measuring pixels by hand, and
 * the point of this file is that nobody has to do that again.
 *
 * Rasters are built in code so the arithmetic is asserted against analytically
 * known centroids, not against a video.
 */

const BG = 250;
const FG = 10;

/** A still: the same raster every frame. */
const still = (n: number) =>
  clipOf(n, () =>
    drawRect(grayOf(64, 64, BG), { x0: 10, y0: 10, x1: 30, y1: 30 }, FG),
  );

/** A bar sliding right, one whole pixel a frame, forever. */
const sliding = (n: number) =>
  clipOf(n, (i) =>
    drawRect(grayOf(64, 64, BG), { x0: 5 + i, y0: 10, x1: 15 + i, y1: 30 }, FG),
  );

describe("ink + foregroundLevel", () => {
  it("finds the background by mode, the box, and the ink's own level", () => {
    const g = drawRect(
      grayOf(64, 64, BG),
      { x0: 8, y0: 4, x1: 24, y1: 20 },
      FG,
    );
    const k = ink(g);
    expect(k.background).toBe(BG);
    expect(k.bbox).toEqual({ x0: 8, y0: 4, x1: 24, y1: 20 });
    expect(k.coverage).toBeCloseTo((16 * 16) / (64 * 64), 6);
    expect(k.columns[10]).toBe(16);
    expect(k.columns[30]).toBe(0);
    expect(foregroundLevel(g, k.background)).toBe(FG);
  });

  it("reads light-on-dark too — the percentile follows the polarity", () => {
    const g = drawRect(
      grayOf(64, 64, 12),
      { x0: 8, y0: 4, x1: 24, y1: 20 },
      240,
    );
    const k = ink(g);
    expect(k.background).toBe(12);
    expect(foregroundLevel(g, k.background)).toBe(240);
  });

  it("survives degenerate rasters", () => {
    for (const g of [grayOf(1, 1, 0), grayOf(32, 32, 0), grayOf(32, 32, 255)]) {
      const k = ink(g);
      expect(k.coverage).toBe(0);
      expect(k.bbox).toBeNull();
      expect(foregroundLevel(g, k.background)).toBe(k.background);
      expect(detailCoverage(g)).toBe(0);
    }
    expect(modalLevel(grayOf(1, 1, 77))).toBe(77);
    expect(detailCoverage(grayOf(0, 0))).toBe(0);
    expect(frameDiff(grayOf(0, 0), grayOf(0, 0))).toEqual({
      moved: 0,
      meanAbs: 0,
    });
    expect(() => frameDiff(grayOf(4, 4), grayOf(5, 5))).toThrow();
  });
});

describe("settleFrame", () => {
  it("calls a still settled on frame 0", () => {
    const s = settleFrame(still(30));
    expect(s.frame).toBe(0);
    expect(s.neverSettles).toBe(false);
    expect(s.busy).toBe(0);
  });

  it("reports 'never settles' rather than inventing a number", () => {
    const s = settleFrame(sliding(30));
    expect(s.frame).toBeNull();
    expect(s.neverSettles).toBe(true);
    expect(s.busy).toBeCloseTo(29 / 30, 6);
  });

  it("finds the last frame that moved before a quiet run", () => {
    const s = settleFrame(
      clipOf(30, (i) => {
        const x = 5 + Math.min(i, 19);
        return drawRect(
          grayOf(64, 64, BG),
          { x0: x, y0: 10, x1: x + 10, y1: 30 },
          FG,
        );
      }),
    );
    expect(s.frame).toBe(19);
    expect(s.neverSettles).toBe(false);
  });

  it("is not fooled by a blinking caret after the beat has settled", () => {
    // The naive "last frame that moved" answers 28 and then reports
    // neverSettles, which would bill every beat with a caret at full length.
    const s = settleFrame(
      clipOf(30, (i) => {
        const x = 5 + Math.min(i, 19);
        const g = drawRect(
          grayOf(64, 64, BG),
          { x0: x, y0: 10, x1: x + 10, y1: 30 },
          FG,
        );
        if (i === 26 || i === 28) {
          drawRect(g, { x0: x + 11, y0: 12, x1: x + 14, y1: 28 }, FG);
        }
        return g;
      }),
    );
    expect(s.frame).toBe(19);
    expect(s.lastMoved).toBe(29);
  });

  it("ignores motion under the floor", () => {
    // One pixel of dither in a 64x64 frame is 2.4e-4 — under the 5e-4 floor.
    const s = settleFrame(
      clipOf(20, (i) => {
        const g = grayOf(64, 64, BG);
        drawRect(g, { x0: 10, y0: 10, x1: 30, y1: 30 }, FG);
        g.data[i] = 100;
        return g;
      }),
    );
    expect(s.frame).toBe(0);
  });
});

describe("settlesBeforeTransition — defect 1: a beat still animating under the fade", () => {
  // A line gaining a word a frame — text-build's actual failure shape.
  const beat = (movesUntil: number) =>
    clipOf(75, (i) => {
      const w = Math.min(i, movesUntil);
      return drawRect(
        grayOf(128, 64, BG),
        { x0: 2, y0: 20, x1: 3 + w, y1: 40 },
        FG,
      );
    });

  it("passes a beat that finishes before the 18-frame overlap opens", () => {
    const m = settlesBeforeTransition(settleFrame(beat(40)), 75, 18);
    expect(m.value).toBe(40);
    expect(m.threshold).toBe(56);
    expect(m.pass).toBe(true);
  });

  it("FAILS a beat that is still animating when the next one fades in", () => {
    const m = settlesBeforeTransition(settleFrame(beat(60)), 75, 18);
    expect(m.value).toBe(60);
    expect(m.pass).toBe(false);
    expect(m.detail).toMatch(/still animating/);
  });

  // The three lies the first implementation told, each of which pointed the same
  // way: "settled" earlier than the truth, which is the one direction this
  // number must never err in. All three were found by attacking the metric, not
  // by a failing render.
  it("does not publish a mid-animation PAUSE as the settle frame", () => {
    // Moves to 20, holds still 20-40, then moves again to 60. The old scan took
    // the last frame followed by `quiet` still frames and answered 20.
    const s = settleFrame(
      clipOf(75, (i) => {
        const w = i <= 20 ? i : i <= 40 ? 20 : Math.min(20 + (i - 40), 40);
        return drawRect(
          grayOf(128, 64, BG),
          { x0: 2, y0: 20, x1: 3 + w, y1: 40 },
          FG,
        );
      }),
    );
    expect(s.frame).toBe(60);
  });

  it("does not fall back to an early pause when motion runs to the last frame", () => {
    // Same pause, but the second move never stops. The old scan skipped every
    // candidate within `quiet` of the end (`i + quiet > length - 1`) and so
    // answered 20 — the pause — for a clip that is plainly still going.
    const s = settleFrame(
      clipOf(75, (i) => {
        const w = i <= 20 ? i : i <= 40 ? 20 : 20 + (i - 40);
        return drawRect(
          grayOf(128, 64, BG),
          { x0: 2, y0: 20, x1: 3 + w, y1: 40 },
          FG,
        );
      }),
    );
    expect(s.neverSettles).toBe(true);
    expect(s.frame).toBeNull();
  });

  it("sees a fade too slow to trip the per-frame floor", () => {
    // One luma per frame over the whole clip: no single frame moves enough to
    // register, yet it is obviously still animating. Caught by distance-to-rest,
    // which accumulates where frame-to-frame does not.
    const s = settleFrame(
      clipOf(75, (i) =>
        drawRect(
          grayOf(128, 64, BG),
          { x0: 2, y0: 20, x1: 60, y1: 40 },
          Math.max(FG, 200 - i * 2),
        ),
      ),
    );
    expect(s.neverSettles).toBe(true);
  });

  it("reports, but does not judge, a beat that never goes quiet", () => {
    // text-build as shipped: ink still rising on the last frame. A loop and an
    // unfinished beat are indistinguishable without a periodicity test, so this
    // is a fact for the planner (bill it at full length), not a red X.
    const m = settlesBeforeTransition(settleFrame(beat(74)), 75, 18);
    expect(m.value).toBeNull();
    expect(m.pass).toBeNull();
    expect(m.detail).toMatch(/still moving on frame 74/);
  });
});

describe("inkCentroid — sub-pixel recovery from the antialiasing", () => {
  const bar = (y0: number) =>
    drawRectSubpixel(
      grayOf(64, 64, BG),
      { x0: 20, y0, x1: 40, y1: y0 + 10 },
      FG,
    );

  it("recovers a 0.37px translation to within 0.02px", () => {
    const a = inkCentroid(bar(20), { background: BG, foreground: FG });
    const b = inkCentroid(bar(20.37), { background: BG, foreground: FG });
    expect(a.y).toBeCloseTo(25, 2); // closed form: (20 + 30) / 2
    expect(b.y - a.y).toBeGreaterThan(0.35);
    expect(b.y - a.y).toBeLessThan(0.39);
    expect(Math.abs(b.y - a.y - 0.37)).toBeLessThan(0.02);
    expect(a.mass).toBeCloseTo(200, 1);
  });

  it("a threshold centroid CANNOT see it — this is why the alpha recovery exists", () => {
    // The same rasters, measured by counting thresholded pixels instead of
    // weighting them. Two identical 0.37px steps come back as 0.50 and 0.00: the
    // instrument is quantised to the pixel grid, so it invents the exact judder
    // it is supposed to be measuring.
    const threshold = (y0: number) => {
      const g = bar(y0);
      const k = ink(g);
      let sum = 0;
      let mass = 0;
      for (let y = 0; y < g.height; y++) {
        sum += k.rows[y] * (y + 0.5);
        mass += k.rows[y];
      }
      return sum / mass;
    };
    const steps = [20, 20.37, 20.74].map(threshold);
    expect(steps[1] - steps[0]).toBeCloseTo(0.5, 6);
    expect(steps[2] - steps[1]).toBeCloseTo(0, 6);

    const sub = [20, 20.37, 20.74].map(
      (y0) => inkCentroid(bar(y0), { background: BG, foreground: FG }).y,
    );
    expect(sub[1] - sub[0]).toBeCloseTo(0.37, 2);
    expect(sub[2] - sub[1]).toBeCloseTo(0.37, 2);
  });

  it("returns nothing rather than dividing by zero on a blank frame", () => {
    expect(
      inkCentroid(grayOf(8, 8, BG), { background: BG, foreground: FG }),
    ).toEqual({
      x: 0,
      y: 0,
      mass: 0,
    });
    expect(
      inkCentroid(grayOf(8, 8, BG), { background: 10, foreground: 10 }).mass,
    ).toBe(0);
  });
});

describe("centroidMonotonic — skill check 2: type snapping to the pixel grid", () => {
  // A bar shrinking about a slowly-drifting centre: the 1.6x → 1x ramp the skill
  // measured. Edges at y0 = 9 + 0.225i, y1 = 39 - 0.125i over 40 frames.
  const y0 = (i: number) => 9 + 0.225 * i;
  const y1 = (i: number) => 39 - 0.125 * i;
  const opts = {
    background: BG,
    foreground: FG,
    range: [0, 39] as [number, number],
  };

  it("is monotone when the edges are drawn sub-pixel", () => {
    const m = centroidMonotonic(
      clipOf(40, (i) =>
        drawRectSubpixel(
          grayOf(64, 64, BG),
          { x0: 20, y0: y0(i), x1: 44, y1: y1(i) },
          FG,
        ),
      ),
      opts,
    );
    expect(m.value).toBe(0);
    expect(m.pass).toBe(true);
  });

  it("FIRES when each edge snaps to a whole pixel independently", () => {
    const m = centroidMonotonic(
      clipOf(40, (i) =>
        drawRect(
          grayOf(64, 64, BG),
          { x0: 20, y0: Math.round(y0(i)), x1: 44, y1: Math.round(y1(i)) },
          FG,
        ),
      ),
      opts,
    );
    expect(m.value).toBeGreaterThan(2);
    expect(m.pass).toBe(false);
    expect(m.detail).toMatch(/snapping to the pixel grid/);
  });

  it("will not guess a direction from two frames", () => {
    expect(centroidMonotonic(still(2), opts).pass).toBeNull();
    expect(centroidMonotonic([], opts).pass).toBeNull();
  });
});

describe("shapeInvariant — skill check 3: hinting boiling the letterforms", () => {
  const range = [0, 19] as [number, number];

  it("holds under a pure scale", () => {
    const m = shapeInvariant(
      clipOf(20, (i) => {
        const w = 20 + i;
        return drawRect(
          grayOf(128, 128, BG),
          { x0: 10, y0: 5, x1: 10 + w, y1: 5 + 2 * w },
          FG,
        );
      }),
      { background: BG, range },
    );
    expect(m.value).toBeCloseTo(0, 6);
    expect(m.pass).toBe(true);
  });

  it("FIRES when the outlines change shape frame to frame", () => {
    const m = shapeInvariant(
      clipOf(20, (i) => {
        const w = 20 + i;
        const h = 2 * w + (i % 2 ? 3 : 0); // stems re-snapping to the grid
        return drawRect(
          grayOf(128, 128, BG),
          { x0: 10, y0: 5, x1: 10 + w, y1: 5 + h },
          FG,
        );
      }),
      { background: BG, range },
    );
    expect(m.value).toBeGreaterThan(0.01);
    expect(m.pass).toBe(false);
    expect(m.detail).toMatch(/geometricPrecision/);
  });

  it("reports nothing rather than a ratio on an empty clip", () => {
    expect(shapeInvariant([], { background: BG, range }).pass).toBeNull();
  });
});

describe("noFrozenFrames — skill check 4: a settle worth five frames is a freeze", () => {
  const opts = {
    background: BG,
    foreground: FG,
    range: [0, 13] as [number, number],
  };
  // The skill's own measurement: a 50px rise over 14 frames at 30fps.
  const rise = (ease: (t: number) => number) =>
    clipOf(14, (i) => {
      const y = 10 + 50 * ease(i / 13);
      return drawRectSubpixel(
        grayOf(64, 128, BG),
        { x0: 20, y0: y, x1: 40, y1: y + 10 },
        FG,
      );
    });

  it("passes a moderate decelerate", () => {
    const m = noFrozenFrames(
      rise((t) => 1 - (1 - t) ** 2),
      opts,
    );
    expect(m.value).toBe(1); // one frame of settle is a settle
    expect(m.pass).toBe(true);
  });

  it("FIRES on a quint-out — the curve everyone reaches for", () => {
    const m = noFrozenFrames(
      rise((t) => 1 - (1 - t) ** 5),
      opts,
    );
    expect(m.value).toBe(5); // the skill measured exactly 5 of 14
    expect(m.pass).toBe(false);
    expect(m.detail).toMatch(/rasterise identically/);
  });
});

describe("holdIsStill — skill check 1: a hold must be byte-identical", () => {
  it("passes a hold the renderer left alone", () => {
    const m = holdIsStill(still(20), [10, 19]);
    expect(m.value).toBe(1);
    expect(m.pass).toBe(true);
  });

  it("FIRES when one static style comes back as several rasterisations", () => {
    // will-change: transform — each parallel tab inherits a different raster.
    const m = holdIsStill(
      clipOf(20, (i) => {
        const g = drawRect(
          grayOf(64, 64, BG),
          { x0: 10, y0: 10, x1: 30, y1: 30 },
          FG,
        );
        if (i >= 10) g.data[i % 4] = 200; // 4 rasterisations of one style
        return g;
      }),
      [10, 19],
    );
    expect(m.value).toBe(4);
    expect(m.pass).toBe(false);
  });

  it("does not judge a hold with nothing in it", () => {
    expect(holdIsStill(still(5), [40, 50]).pass).toBeNull();
    expect(holdIsStill([], [0, 10]).pass).toBeNull();
  });
});

describe("edgeBleed — defect 2: text sliding off the frame, silently", () => {
  const at = (x0: number, x1: number) =>
    clipOf(3, () =>
      drawRect(grayOf(64, 64, BG), { x0, y0: 20, x1, y1: 40 }, FG),
    );

  it("fires 1px from the edge and stays silent 20px in", () => {
    const clipped = edgeBleed(at(1, 30));
    expect(clipped.peak.left).toBeCloseTo(20 / 64, 6);
    expect(clipped.partial).toEqual(["left"]);
    expect(clipped.filled).toEqual([]);

    const inset = edgeBleed(at(20, 30));
    expect(inset.peak.left).toBe(0);
    expect(inset.partial).toEqual([]);
  });

  it("tells a device at the crop from content that is cut off", () => {
    const b = edgeBleed(
      clipOf(1, () =>
        drawRect(grayOf(64, 64, BG), { x0: 0, y0: 0, x1: 30, y1: 64 }, FG),
      ),
    );
    expect(b.filled).toEqual(["left"]); // spans the whole edge: composition
    expect(b.partial).toEqual(["top", "bottom"]); // touches it: contact
    expect(b.worstFrame).toBe(0);
  });

  it("FAILS copy that runs off an edge the default render never touches", () => {
    const m = edgeBleedDelta(edgeBleed(at(1, 30)), edgeBleed(at(20, 30)));
    expect(m.value).toBe(1);
    expect(m.pass).toBe(false);
    expect(m.detail).toMatch(/left 0%→31%/);
  });

  it("lets a full-bleed background exclude itself — no opt-out list", () => {
    const bleeding = () =>
      edgeBleed(
        clipOf(2, () =>
          drawRect(grayOf(64, 64, BG), { x0: 0, y0: 0, x1: 30, y1: 64 }, FG),
        ),
      );
    const m = edgeBleedDelta(bleeding(), bleeding());
    expect(m.value).toBe(0);
    expect(m.pass).toBe(true);
  });

  it("survives an empty clip", () => {
    const b = edgeBleed([]);
    expect(b.peak).toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
    expect(b.worstFrame).toBeNull();
    expect(edgeBleedDelta(b, b).pass).toBe(true);
  });
});

describe("detailCoverage — defect 3: the product as a distant window", () => {
  /** 4 of 16 cells filled with alternating pixels: unmistakable detail. */
  const busyCells = () => {
    const g = grayOf(64, 64, BG);
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) if ((x + y) % 2) g.data[y * 64 + x] = FG;
    }
    return g;
  };

  it("returns the exact cell fraction", () => {
    expect(detailCoverage(busyCells())).toBe(0.25);
  });

  it("measures DETAIL, not ink — a big flat shape is not a product shot", () => {
    // Four cells solidly inked, cell-aligned: 25% of the frame, 0% detail.
    const solid = drawRect(
      grayOf(64, 64, BG),
      { x0: 16, y0: 16, x1: 48, y1: 48 },
      FG,
    );
    expect(ink(solid).coverage).toBeCloseTo(0.25, 6);
    expect(detailCoverage(solid)).toBe(0);
  });

  it("takes the median, because an entry animation starts on an empty frame", () => {
    const frames = clipOf(7, (i) => (i < 2 ? grayOf(64, 64, BG) : busyCells()));
    const m = coverageCheck(frames, { min: 0.25 });
    expect(m.value).toBe(0.25); // the mean would be 0.179 and would fail
    expect(m.pass).toBe(true);
  });

  it("FAILS a beat declared a product shot that renders it small", () => {
    // The same footage inside a frame: a quarter of the detail, off the floor.
    const framed = () => {
      const g = grayOf(64, 64, BG);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) if ((x + y) % 2) g.data[y * 64 + x] = FG;
      }
      return g;
    };
    const m = coverageCheck(clipOf(5, framed), { min: 0.25 });
    expect(m.value).toBeCloseTo(1 / 16, 6);
    expect(m.pass).toBe(false);
    expect(m.detail).toMatch(/distant floating window/);
  });

  it("reports without judging when no product-shot floor is declared", () => {
    const m = coverageCheck(clipOf(3, busyCells));
    expect(m.value).toBe(0.25);
    expect(m.threshold).toBeNull();
    expect(m.pass).toBeNull();
    expect(coverageCheck([]).pass).toBeNull();
  });
});

describe("subjectArea — defect 3, measured the way the eye reads it", () => {
  /**
   * A device frame: a chassis that is identical in both renders, and a screen
   * that is not. Only the screen is the product, and only the screen differs.
   */
  const framed = (screen: number) => (_: number) => {
    const g = grayOf(100, 100, BG);
    drawRect(g, { x0: 20, y0: 20, x1: 80, y1: 80 }, 60); // chassis
    drawRect(g, { x0: 30, y0: 30, x1: 70, y1: 70 }, screen); // 16% of frame
    return g;
  };
  const bare = (screen: number) => (_: number) =>
    drawRect(grayOf(100, 100, BG), { x0: 0, y0: 0, x1: 100, y1: 100 }, screen);

  it("measures the screen, not the chassis around it", () => {
    const m = subjectArea(clipOf(5, framed(200)), clipOf(5, framed(90)));
    // 40x40 of 100x100. detailCoverage cannot see this: the chassis is detail.
    expect(m.value).toBeCloseTo(0.16, 6);
    expect(m.pass).toBeNull();
    expect(m.detail).toMatch(/16\.0% of the frame/);
  });

  it("scores the same footage un-framed at the whole frame", () => {
    const m = subjectArea(clipOf(5, bare(200)), clipOf(5, bare(90)));
    expect(m.value).toBe(1);
  });

  it("says nothing rather than 0 when there is no pair to compare", () => {
    expect(subjectArea([], []).value).toBeNull();
    expect(subjectArea(clipOf(2, framed(200)), []).pass).toBeNull();
  });
});
