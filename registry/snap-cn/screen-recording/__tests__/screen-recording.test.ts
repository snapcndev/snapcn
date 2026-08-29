/**
 * Unit tests for pure helpers in registry/snap-cn/screen-recording/index.tsx.
 *
 * Run with:
 *   pnpm vitest run registry/snap-cn/screen-recording
 *
 * No React DOM or Remotion player needed — only pure JS logic is exercised.
 */

import { Easing, interpolate } from "remotion";
import { describe, expect, it } from "vitest";

import {
  CAMERA_MOVE_FRAMES,
  type CameraMove,
  cameraPoseAt,
  clampFocus,
  DEMO_CAMERA,
  RESTING_POSE,
  screenRecordingFrames,
  shotLayout,
  TAIL_FRAMES,
} from "../index";

const W = 1280;
const H = 720;

describe("cameraPoseAt", () => {
  it("rests at zoom 1, dead centre, with no track", () => {
    expect(cameraPoseAt(0, [])).toEqual(RESTING_POSE);
    expect(cameraPoseAt(400, undefined)).toEqual(RESTING_POSE);
  });

  it("holds the resting pose until the first move starts", () => {
    const camera: CameraMove[] = [{ at: 40, duration: 20, zoom: 2 }];
    expect(cameraPoseAt(0, camera)).toEqual(RESTING_POSE);
    expect(cameraPoseAt(39, camera)).toEqual(RESTING_POSE);
    expect(cameraPoseAt(40, camera)).toEqual(RESTING_POSE);
  });

  it("lands the target exactly at at + duration, and holds it after", () => {
    const camera: CameraMove[] = [
      { at: 40, duration: 20, zoom: 2.2, x: 0.62, y: 0.31 },
    ];
    expect(cameraPoseAt(60, camera)).toEqual({ zoom: 2.2, x: 0.62, y: 0.31 });
    expect(cameraPoseAt(9999, camera)).toEqual({ zoom: 2.2, x: 0.62, y: 0.31 });
  });

  it("carries an omitted field forward from the previous move's target", () => {
    const camera: CameraMove[] = [
      { at: 0, duration: 10, zoom: 2.2, x: 0.62, y: 0.31 },
      // A pure pan: zoom and y carry.
      { at: 40, duration: 10, x: 0.2 },
      // A pure pull-back: the focal point carries.
      { at: 80, duration: 10, zoom: 1.4 },
    ];
    expect(cameraPoseAt(50, camera)).toEqual({ zoom: 2.2, x: 0.2, y: 0.31 });
    expect(cameraPoseAt(90, camera)).toEqual({ zoom: 1.4, x: 0.2, y: 0.31 });
  });

  it("carries forward from the target, not from a truncated on-screen pose", () => {
    const camera: CameraMove[] = [
      { at: 0, duration: 100, zoom: 3, x: 0.8, y: 0.8 },
      // Interrupts the first move at frame 10 and only names a zoom, so the
      // focal point it carries is 0.8/0.8 — the first move's TARGET, even
      // though the camera never got near it.
      { at: 10, duration: 10, zoom: 1.5 },
    ];
    expect(cameraPoseAt(20, camera)).toEqual({ zoom: 1.5, x: 0.8, y: 0.8 });
  });

  it("truncates an overrun move instead of blending it", () => {
    const camera: CameraMove[] = [
      { at: 0, duration: 100, zoom: 5 },
      { at: 10, duration: 10, zoom: 1 },
    ];
    // The second move's `from` is the pose actually on screen at frame 10 — a
    // fraction of the way into a 1 -> 5 push, never 5 itself.
    const handover = cameraPoseAt(10, camera);
    expect(handover.zoom).toBeGreaterThan(1);
    expect(handover.zoom).toBeLessThan(5);
    // ...and it is continuous: the pose at the handover frame is the same
    // whether you read it as the end of move one or the start of move two.
    expect(cameraPoseAt(10, [camera[0]]).zoom).toBeCloseTo(handover.zoom, 10);
    expect(cameraPoseAt(20, camera).zoom).toBe(1);
  });

  it("sorts by `at` and lets the last array entry win a tie", () => {
    const unsorted: CameraMove[] = [
      { at: 60, duration: 10, zoom: 3 },
      { at: 20, duration: 10, zoom: 2 },
    ];
    expect(cameraPoseAt(30, unsorted).zoom).toBe(2);
    expect(cameraPoseAt(70, unsorted).zoom).toBe(3);

    const tied: CameraMove[] = [
      { at: 20, duration: 10, zoom: 2 },
      { at: 20, duration: 10, zoom: 4 },
    ];
    expect(cameraPoseAt(30, tied).zoom).toBe(4);
    // The tied-out entry never displays, so it cannot carry a field forward
    // either — `x` here comes from the resting pose, not from the loser.
    const tiedCarry: CameraMove[] = [
      { at: 20, duration: 10, x: 0.9 },
      { at: 20, duration: 10, zoom: 4 },
    ];
    expect(cameraPoseAt(30, tiedCarry)).toEqual({ zoom: 4, x: 0.5, y: 0.5 });
  });

  it("treats a zero-length move as a cut", () => {
    const camera: CameraMove[] = [{ at: 30, duration: 0, zoom: 2, x: 0.3 }];
    expect(cameraPoseAt(29, camera)).toEqual(RESTING_POSE);
    expect(cameraPoseAt(30, camera)).toEqual({ zoom: 2, x: 0.3, y: 0.5 });
  });

  it("is a pure function of the frame, whatever order frames are asked for", () => {
    const forwards = [0, 20, 40, 60, 80, 100, 120].map((f) =>
      cameraPoseAt(f, DEMO_CAMERA),
    );
    const backwards = [120, 100, 80, 60, 40, 20, 0]
      .map((f) => cameraPoseAt(f, DEMO_CAMERA))
      .reverse();
    expect(backwards).toEqual(forwards);
  });
});

/**
 * The one check that fails if the easing decision is ever quietly reverted.
 *
 * motion-quality: a frame that moves less than half a pixel rasterises
 * identically to the one before it, so a RUN of them is a visible freeze. An
 * arrival frame under 0.5px is a settle; several are not. `CAMERA_EASE` costs
 * the demo track exactly one such frame per move; the quint-out everybody
 * reaches for instead costs four.
 */
const QUINT_OUT = Easing.bezier(0.22, 1, 0.36, 1);

/** The shot's four edges in composition px, as the component positions them. */
function shotEdges(zoom: number, x: number, y: number): number[] {
  const fx = clampFocus(x, zoom);
  const fy = clampFocus(y, zoom);
  const tx = W / 2 - fx * W * zoom;
  const ty = H / 2 - fy * H * zoom;
  return [tx, tx + W * zoom, ty, ty + H * zoom];
}

/** Longest run of consecutive frames whose largest edge shift is < 0.5px. */
function frozenRun(
  poseAt: (frame: number) => { zoom: number; x: number; y: number },
  from: number,
  to: number,
): number {
  let run = 0;
  let worst = 0;
  let prev = shotEdges(poseAt(from).zoom, poseAt(from).x, poseAt(from).y);
  for (let f = from + 1; f <= to; f++) {
    const p = poseAt(f);
    const now = shotEdges(p.zoom, p.x, p.y);
    const shift = Math.max(...now.map((v, i) => Math.abs(v - prev[i])));
    if (shift < 0.5) {
      run += 1;
      worst = Math.max(worst, run);
    } else {
      run = 0;
    }
    prev = now;
  }
  return worst;
}

describe("camera easing does not freeze on a frame clock", () => {
  it("costs DEMO_CAMERA at most one sub-0.5px frame per move", () => {
    for (const move of DEMO_CAMERA) {
      const end = move.at + (move.duration ?? CAMERA_MOVE_FRAMES);
      expect(
        frozenRun((f) => cameraPoseAt(f, DEMO_CAMERA), move.at, end),
      ).toBeLessThanOrEqual(1);
    }
  });

  it("holds for a big synthetic push too", () => {
    const camera: CameraMove[] = [
      { at: 0, duration: 25, zoom: 2.2, x: 0.62, y: 0.31 },
    ];
    expect(
      frozenRun((f) => cameraPoseAt(f, camera), 0, 25),
    ).toBeLessThanOrEqual(1);
  });

  it("would fail on the quint-out this curve replaced", () => {
    // Same track, same travel — only the curve changes.
    const [push] = DEMO_CAMERA;
    const dur = push.duration ?? CAMERA_MOVE_FRAMES;
    const quintPose = (f: number) => {
      const p = interpolate(f, [push.at, push.at + dur], [0, 1], {
        easing: QUINT_OUT,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      return {
        zoom: 1 + ((push.zoom ?? 1) - 1) * p,
        x: 0.5 + ((push.x ?? 0.5) - 0.5) * p,
        y: 0.5 + ((push.y ?? 0.5) - 0.5) * p,
      };
    };
    expect(frozenRun(quintPose, push.at, push.at + dur)).toBeGreaterThan(1);
  });
});

describe("clampFocus", () => {
  it("pins the focal point to dead centre at zoom 1 and below", () => {
    expect(clampFocus(0.9, 1)).toBe(0.5);
    expect(clampFocus(0.1, 0.6)).toBe(0.5);
  });

  it("allows exactly the half-frame the zoom can hold", () => {
    expect(clampFocus(0.5, 2)).toBe(0.5);
    expect(clampFocus(0, 2)).toBe(0.25);
    expect(clampFocus(1, 2)).toBe(0.75);
    expect(clampFocus(0.62, 2)).toBe(0.62);
  });

  it("never lets an edge of the shot come inside the frame", () => {
    for (const zoom of [1, 1.2, 1.6, 2.2, 4]) {
      for (const x of [-0.4, 0, 0.31, 0.5, 0.87, 1.5]) {
        const left = W / 2 - clampFocus(x, zoom) * W * zoom;
        expect(left).toBeLessThanOrEqual(1e-9);
        expect(left + W * zoom).toBeGreaterThanOrEqual(W - 1e-9);
      }
    }
  });
});

describe("screenRecordingFrames", () => {
  it("is 0 for a locked-off shot, so the composer uses the source's length", () => {
    expect(screenRecordingFrames()).toBe(0);
    expect(screenRecordingFrames([])).toBe(0);
  });

  it("is the last settle plus the tail hold", () => {
    expect(screenRecordingFrames([{ at: 40, duration: 25, zoom: 2 }])).toBe(
      40 + 25 + TAIL_FRAMES,
    );
  });

  it("uses the default duration when a move omits one", () => {
    expect(screenRecordingFrames([{ at: 40, zoom: 2 }])).toBe(
      40 + CAMERA_MOVE_FRAMES + TAIL_FRAMES,
    );
  });

  it("takes the latest end, not the last array entry", () => {
    expect(
      screenRecordingFrames([
        { at: 90, duration: 10, zoom: 1 },
        { at: 20, duration: 200, zoom: 2 },
      ]),
    ).toBe(220 + TAIL_FRAMES);
  });
});

describe("shotLayout", () => {
  it("is the identity for an uncropped source at the composition's aspect", () => {
    const s = shotLayout(W, H, undefined, "cover", undefined);
    expect(s.left).toBe(0);
    expect(s.top).toBe(0);
    expect(s.width).toBe(W);
    expect(s.height).toBe(H);
    expect(s.mediaWidth).toBe(W);
    expect(s.mediaHeight).toBe(H);
    expect(s.mediaLeft).toBeCloseTo(0, 10);
    expect(s.mediaTop).toBeCloseTo(0, 10);
  });

  it("cover keeps the cropped region filling the frame on both axes", () => {
    const s = shotLayout(W, H, { top: 0.11 }, "cover", undefined);
    // The kept 89% is scaled up until it fills the height; the width overflows
    // and is centre-cropped by the frame's own clip.
    expect(s.height).toBeCloseTo(H, 6);
    expect(s.width).toBeGreaterThan(W);
    expect(s.left).toBeCloseTo((W - s.width) / 2, 6);
    expect(s.top).toBeCloseTo(0, 6);
    // The chrome sits above the region, so the media is pulled up by exactly
    // the cropped fraction of its own scaled height.
    expect(s.mediaTop).toBeCloseTo(-0.11 * s.mediaHeight, 6);
    expect(s.mediaLeft).toBeCloseTo(0, 6);
  });

  it("contain fits the whole cropped region inside the frame", () => {
    const s = shotLayout(W, H, { top: 0.11 }, "contain", undefined);
    expect(s.width).toBeCloseTo(W, 6);
    expect(s.height).toBeLessThan(H);
    // Centred, so the padding is even — that is what `backdropColor` fills.
    expect(s.top).toBeCloseTo((H - s.height) / 2, 6);
  });

  it("offsets a left crop as well as a top one", () => {
    const s = shotLayout(W, H, { left: 0.2, top: 0.1 }, "cover", undefined);
    expect(s.mediaLeft).toBeCloseTo(-0.2 * s.mediaWidth, 6);
    expect(s.mediaTop).toBeCloseTo(-0.1 * s.mediaHeight, 6);
  });

  it("measures the crop on the raw file once sourceAspect is given", () => {
    // A 4:3 source in a 16:9 composition. Without the hint the crop is measured
    // on the already-cover-fitted shot, so the two disagree — which is exactly
    // what the prop doc warns about.
    const hinted = shotLayout(W, H, { top: 0.1 }, "cover", 4 / 3);
    const guessed = shotLayout(W, H, { top: 0.1 }, "cover", undefined);
    expect(hinted.mediaWidth / hinted.mediaHeight).toBeCloseTo(4 / 3, 6);
    expect(guessed.mediaWidth / guessed.mediaHeight).toBeCloseTo(W / H, 6);
    expect(hinted.mediaTop).not.toBeCloseTo(guessed.mediaTop, 3);
  });

  it("agrees with or without the hint when the aspects already match", () => {
    expect(shotLayout(W, H, { top: 0.11 }, "cover", W / H)).toEqual(
      shotLayout(W, H, { top: 0.11 }, "cover", undefined),
    );
  });

  it("survives a crop that would eat the whole source", () => {
    const s = shotLayout(W, H, { top: 0.7, bottom: 0.7 }, "cover", undefined);
    expect(Number.isFinite(s.mediaHeight)).toBe(true);
    expect(s.height).toBeGreaterThan(0);
  });

  it("falls back to the composition's aspect for a non-positive sourceAspect", () => {
    // Left unguarded these divide by zero and every field comes back NaN, which
    // CSS drops silently — the shot simply never appears.
    for (const bad of [0, -1.778]) {
      const s = shotLayout(W, H, { top: 0.11 }, "cover", bad);
      expect(s).toEqual(shotLayout(W, H, { top: 0.11 }, "cover", undefined));
    }
  });

  it("scales linearly with the composition, so the layout can be laid out in %", () => {
    // The component divides every field through by the composition size and
    // emits percentages, because it is an AbsoluteFill and may be mounted in a
    // box that is NOT the composition — a device frame's screen. That is only
    // valid if the layout is scale-covariant. Assert it, or a px regression
    // silently clips the shot to the top-left corner of the screen it sits in.
    const crop = { top: 0.11, left: 0.04 };
    const one = shotLayout(W, H, crop, "cover", undefined);
    const two = shotLayout(W * 2, H * 2, crop, "cover", undefined);
    for (const k of Object.keys(one) as Array<keyof typeof one>) {
      expect(two[k]).toBeCloseTo(one[k] * 2, 6);
    }
  });
});
