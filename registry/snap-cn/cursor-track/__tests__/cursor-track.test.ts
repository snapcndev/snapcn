/**
 * Unit tests for pure helpers in registry/snap-cn/cursor-track/index.tsx.
 *
 * Run with:
 *   pnpm vitest run registry/snap-cn/cursor-track
 *
 * No React DOM or Remotion player needed — only pure JS logic is exercised.
 */

import { describe, expect, it } from "vitest";

import {
  CLICK_FRAMES,
  type CursorWaypoint,
  cursorPoseAt,
  cursorTrackFrames,
  DEMO_PATH,
  TAIL_FRAMES,
  TRAVEL_FRAMES,
} from "../index";

const W = 1280;
const H = 720;

describe("cursorPoseAt — placement and ordering", () => {
  it("is a centred no-op on an empty path", () => {
    expect(cursorPoseAt(0, [])).toEqual({
      x: 0.5,
      y: 0.5,
      click: 0,
      opacity: 0,
    });
    expect(cursorPoseAt(999, [])).toEqual({
      x: 0.5,
      y: 0.5,
      click: 0,
      opacity: 0,
    });
  });

  it("parks at the first waypoint — there is nothing to travel from", () => {
    const path: CursorWaypoint[] = [{ at: 10, x: 0.2, y: 0.8 }];
    for (const f of [-100, 0, 10, 500]) {
      const pose = cursorPoseAt(f, path);
      expect(pose.x).toBe(0.2);
      expect(pose.y).toBe(0.8);
    }
  });

  it("sorts by `at`, not by array order", () => {
    const path: CursorWaypoint[] = [
      { at: 20, x: 0.9, y: 0.9 },
      { at: 0, x: 0.1, y: 0.1 },
    ];
    expect(cursorPoseAt(0, path).x).toBe(0.1);
    expect(cursorPoseAt(500, path).x).toBeCloseTo(0.9, 6);
  });

  it("breaks same-`at` ties on array order, last wins", () => {
    const path: CursorWaypoint[] = [
      { at: 0, x: 0.1, y: 0.1 },
      { at: 0, x: 0.8, y: 0.8 },
    ];
    expect(cursorPoseAt(0, path).x).toBe(0.8);
    expect(cursorPoseAt(0, path).y).toBe(0.8);
  });

  it("holds the last waypoint forever after it arrives", () => {
    const path: CursorWaypoint[] = [
      { at: 0, x: 0, y: 0 },
      { at: 10, x: 1, y: 1, duration: 10 },
    ];
    expect(cursorPoseAt(20, path).x).toBeCloseTo(1, 6);
    expect(cursorPoseAt(10_000, path).x).toBeCloseTo(1, 6);
  });
});

describe("cursorPoseAt — travel", () => {
  const path: CursorWaypoint[] = [
    { at: 0, x: 0, y: 0 },
    { at: 10, x: 1, y: 0.5, duration: 20 },
  ];

  it("has not moved at the frame the leg starts", () => {
    expect(cursorPoseAt(10, path).x).toBeCloseTo(0, 6);
  });

  it("lands exactly on the destination at at + duration", () => {
    expect(cursorPoseAt(30, path).x).toBeCloseTo(1, 6);
    expect(cursorPoseAt(30, path).y).toBeCloseTo(0.5, 6);
  });

  it("accelerates out and decelerates in — half the travel at half the leg", () => {
    // Easing.inOut(Easing.cubic) is symmetric about its midpoint. A camera
    // decelerate would already be past halfway here, which is the tell.
    expect(cursorPoseAt(20, path).x).toBeCloseTo(0.5, 6);
    const early = cursorPoseAt(12, path).x;
    const late = cursorPoseAt(28, path).x;
    expect(early).toBeLessThan(0.1);
    expect(1 - late).toBeLessThan(0.1);
    expect(early).toBeCloseTo(1 - late, 6);
  });

  it("jump-cuts on a zero-length leg rather than dividing by zero", () => {
    const cut: CursorWaypoint[] = [
      { at: 0, x: 0, y: 0 },
      { at: 10, x: 1, y: 1, duration: 0 },
    ];
    expect(cursorPoseAt(9, cut).x).toBe(0);
    expect(cursorPoseAt(10, cut).x).toBe(1);
  });
});

describe("cursorPoseAt — overlapping legs are truncated, never blended", () => {
  const path: CursorWaypoint[] = [
    { at: 0, x: 0, y: 0, duration: 1 },
    { at: 10, x: 1, y: 0, duration: 20 }, // would land at 30…
    { at: 20, x: 1, y: 1, duration: 10 }, // …but this takes over at 20
  ];

  it("starts the later leg from the pose actually on screen", () => {
    // The overrun leg is frozen at frame 20, where it is exactly halfway.
    expect(cursorPoseAt(20, path).x).toBeCloseTo(0.5, 6);
    expect(cursorPoseAt(20, path).y).toBeCloseTo(0, 6);
  });

  it("reaches the later leg's target, not an average of the two", () => {
    const pose = cursorPoseAt(30, path);
    expect(pose.x).toBeCloseTo(1, 6);
    expect(pose.y).toBeCloseTo(1, 6);
  });

  it("stays continuous across the handover", () => {
    let prev = cursorPoseAt(10, path).x;
    for (let f = 11; f <= 30; f++) {
      const next = cursorPoseAt(f, path).x;
      expect(next).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = next;
    }
  });
});

describe("cursorPoseAt — click rings", () => {
  const path: CursorWaypoint[] = [
    { at: 0, x: 0, y: 0, duration: 0 },
    { at: 10, x: 1, y: 1, duration: 10, click: true },
  ];

  it("is silent before the arrival frame", () => {
    expect(cursorPoseAt(19, path).click).toBe(0);
  });

  it("is live on the arrival frame and dies exactly clickFrames later", () => {
    expect(cursorPoseAt(20, path).click).toBeGreaterThan(0);
    expect(cursorPoseAt(20 + CLICK_FRAMES - 1, path).click).toBeCloseTo(1, 6);
    expect(cursorPoseAt(20 + CLICK_FRAMES, path).click).toBe(0);
  });

  it("grows monotonically while it is up", () => {
    let prev = 0;
    for (let f = 20; f < 20 + CLICK_FRAMES; f++) {
      const c = cursorPoseAt(f, path).click;
      expect(c).toBeGreaterThan(prev);
      prev = c;
    }
  });

  it("shows one ring, not two, when clicks overlap", () => {
    const overlapping: CursorWaypoint[] = [
      { at: 0, x: 0, y: 0, duration: 0, click: true }, // ring at 0
      { at: 2, x: 1, y: 1, duration: 0, click: true }, // ring at 2
    ];
    // The later ring wins outright — its progress, not a sum of the two.
    expect(cursorPoseAt(2, overlapping).click).toBeCloseTo(1 / CLICK_FRAMES, 6);
  });

  it("is silent when clickFrames is zero", () => {
    expect(cursorPoseAt(20, path, 0).click).toBe(0);
  });
});

describe("cursorPoseAt — opacity", () => {
  it("fades up over the first waypoint's own duration", () => {
    const path: CursorWaypoint[] = [
      { at: 10, x: 0, y: 0, duration: 8 },
      { at: 30, x: 1, y: 1 },
    ];
    expect(cursorPoseAt(0, path).opacity).toBe(0);
    expect(cursorPoseAt(10, path).opacity).toBe(0);
    expect(cursorPoseAt(14, path).opacity).toBeGreaterThan(0);
    expect(cursorPoseAt(14, path).opacity).toBeLessThan(1);
    expect(cursorPoseAt(18, path).opacity).toBe(1);
    expect(cursorPoseAt(900, path).opacity).toBe(1);
  });

  it("snaps up when the first waypoint has no duration", () => {
    const path: CursorWaypoint[] = [{ at: 5, x: 0, y: 0, duration: 0 }];
    expect(cursorPoseAt(4, path).opacity).toBe(0);
    expect(cursorPoseAt(5, path).opacity).toBe(1);
  });
});

describe("cursorTrackFrames", () => {
  it("is zero for an empty path — nothing renders, so nothing is billed", () => {
    expect(cursorTrackFrames([])).toBe(0);
    expect(cursorTrackFrames()).toBe(0);
  });

  it("adds the tail past the last settle", () => {
    expect(cursorTrackFrames([{ at: 40, x: 0, y: 0, duration: 10 }])).toBe(
      50 + TAIL_FRAMES,
    );
  });

  it("adds the ring's life when the last waypoint clicks", () => {
    expect(
      cursorTrackFrames([{ at: 40, x: 0, y: 0, duration: 10, click: true }]),
    ).toBe(50 + CLICK_FRAMES + TAIL_FRAMES);
  });

  it("takes the latest end, not the last array entry", () => {
    const path: CursorWaypoint[] = [
      { at: 90, x: 0, y: 0, duration: 10 },
      { at: 10, x: 1, y: 1, duration: 10 },
    ];
    expect(cursorTrackFrames(path)).toBe(100 + TAIL_FRAMES);
  });

  it("uses the default travel length when duration is omitted", () => {
    expect(cursorTrackFrames([{ at: 0, x: 0, y: 0 }])).toBe(
      TRAVEL_FRAMES + TAIL_FRAMES,
    );
  });

  it("covers the demo path's last settle", () => {
    expect(cursorTrackFrames(DEMO_PATH)).toBe(132);
  });
});

describe("DEMO_PATH", () => {
  it("enters from off-frame, so the cursor is never sitting inertly on frame 0", () => {
    expect(DEMO_PATH[0].x).toBeLessThan(0);
    expect(cursorPoseAt(0, DEMO_PATH).x).toBeLessThan(0);
  });

  it("clicks at least once, so the preview shows a ring", () => {
    expect(DEMO_PATH.some((w) => w.click)).toBe(true);
  });
});

/**
 * The one check that fails if the easing decision is quietly reverted, and the
 * only rule here that is invisible to the eye in a `<Player>`.
 *
 * motion-quality: a frame that moves less than half a pixel rasterises
 * identically to the one before it, so a RUN of them is a visible freeze — an
 * aggressive ease-out (quint/expo) spends five of fourteen frames there.
 * `Easing.inOut(Easing.cubic)` leaves a pointer at rest at both ends of a leg,
 * so exactly one frame at each end is allowed to be that slow; anything in
 * between, or a second frame at either end, is a freeze.
 */
describe("no frame of a travel leg freezes (< 0.5px)", () => {
  const at = (frame: number) => {
    const p = cursorPoseAt(frame, DEMO_PATH);
    return { x: p.x * W, y: p.y * H };
  };

  const legs = DEMO_PATH.slice(1).map((w, i) => {
    const next = DEMO_PATH[i + 2];
    return {
      start: w.at,
      end: Math.min(w.at + (w.duration ?? TRAVEL_FRAMES), next?.at ?? Infinity),
    };
  });

  it("has a leg to check", () => {
    expect(legs.length).toBeGreaterThan(0);
  });

  for (const { start, end } of legs) {
    it(`moves > 0.5px on every interior frame of the leg at ${start}`, () => {
      const steps: number[] = [];
      for (let f = start; f < end; f++) {
        const a = at(f);
        const b = at(f + 1);
        steps.push(Math.hypot(b.x - a.x, b.y - a.y));
      }

      const slow = steps
        .map((d, i) => ({ d, i }))
        .filter((s) => s.d < 0.5)
        .map((s) => s.i);

      // Only the frame leaving rest and the frame arriving at rest may be slow.
      expect(slow.every((i) => i === 0 || i === steps.length - 1)).toBe(true);
      expect(slow.length).toBeLessThanOrEqual(2);
    });
  }
});
