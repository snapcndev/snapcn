/**
 * Unit tests for pure helpers in registry/snap-cn/terminal-simulator/index.tsx.
 *
 * Run with:
 *   pnpm vitest run registry/snap-cn/terminal-simulator/__tests__/terminal-simulator.test.ts
 *
 * No React DOM or Remotion player needed — only pure JS logic is exercised.
 */

import { describe, expect, it } from "vitest";

import {
  autoPause,
  buildCameraStops,
  cameraAt,
  cameraSpeed,
  chunkedReveal,
  commandSpans,
  computeLineStarts,
  computeScrollRows,
  parseIntro,
  resolveZoom,
  type TerminalLine,
  typingDuration,
} from "../index";

const line = (
  text: string,
  overrides: Partial<TerminalLine> = {},
): TerminalLine => ({
  text,
  type: "log",
  ...overrides,
});

describe("autoPause", () => {
  it("honors an explicit pause, even zero", () => {
    expect(autoPause(line("Installing...", { pause: 30 }))).toBe(30);
    expect(autoPause(line("Installing...", { pause: 0 }))).toBe(0);
  });

  it("auto-freezes lines ending in an ellipsis for 18 frames", () => {
    expect(autoPause(line("Resolving registry @snapcn..."))).toBe(18);
    expect(autoPause(line("Compiling...   "))).toBe(18);
  });

  it("does not pause plain lines", () => {
    expect(autoPause(line("Done."))).toBe(0);
  });
});

describe("typingDuration", () => {
  it("is ceil(length / (chunkSize * charsPerFrame))", () => {
    expect(typingDuration(44, 2, 3)).toBe(8);
    expect(typingDuration(10, 1, 1)).toBe(10);
    expect(typingDuration(1, 4, 5)).toBe(1);
  });
});

describe("computeLineStarts", () => {
  it("accumulates lead-in, per-line delay, typing time and pauses", () => {
    const lines: TerminalLine[] = [
      line("abcdef", { type: "command", delay: 0 }), // types in 6 frames
      line("xyz...", { delay: 4 }), // auto-pause 18
      line("ok", { delay: 2 }),
    ];
    const starts = computeLineStarts(lines, 1, 1);
    expect(starts[0]).toBe(10); // lead-in + delay 0
    expect(starts[1]).toBe(10 + 6 + 4); // after typing + delay
    expect(starts[2]).toBe(20 + 6 + 18 + 2); // typing + auto-pause + delay
  });

  it("defaults a missing delay to 8 frames", () => {
    const starts = computeLineStarts([line("hi")], 1, 1);
    expect(starts[0]).toBe(18);
  });
});

describe("chunkedReveal", () => {
  it("clamps to [0, totalChars]", () => {
    expect(chunkedReveal(-5, 10, 1, 1)).toBe(0);
    expect(chunkedReveal(999, 10, 1, 1)).toBe(10);
  });

  it("snaps up to multiples of chunkSize", () => {
    const revealed = chunkedReveal(4, 20, 1, 3);
    expect(revealed % 3).toBe(0);
    expect(revealed).toBe(6); // floor(4) -> ceil(4/3)*3
  });

  it("never exceeds totalChars even when snapping", () => {
    expect(chunkedReveal(19, 20, 1, 3)).toBe(20);
  });

  it("is monotonic over frames", () => {
    let prev = 0;
    for (let f = 0; f <= 30; f++) {
      const r = chunkedReveal(f, 25, 2, 3);
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
    expect(prev).toBe(25);
  });

  it("handles empty text", () => {
    expect(chunkedReveal(10, 0, 1, 1)).toBe(0);
  });
});

describe("computeScrollRows", () => {
  const starts = [10, 20, 30, 40, 50];

  it("does not scroll while everything fits", () => {
    expect(computeScrollRows(100, starts, 5)).toBe(0);
  });

  it("steps one row per overflowing line that has started", () => {
    expect(computeScrollRows(25, starts, 2)).toBe(0); // line 2 starts at 30
    expect(computeScrollRows(30, starts, 2)).toBe(1);
    expect(computeScrollRows(45, starts, 2)).toBe(2);
    expect(computeScrollRows(50, starts, 2)).toBe(3);
  });
});

describe("resolveZoom", () => {
  it("is disabled by default", () => {
    expect(resolveZoom(undefined)).toEqual({
      enabled: false,
      scale: 1,
      followCursor: true,
    });
    expect(resolveZoom(false).enabled).toBe(false);
  });

  it("expands `true` into cursor-following defaults", () => {
    expect(resolveZoom(true)).toEqual({
      enabled: true,
      scale: 2.4,
      followCursor: true,
    });
  });

  it("fills missing fields of a partial object", () => {
    expect(resolveZoom({ enabled: true, scale: 3 })).toEqual({
      enabled: true,
      scale: 3,
      followCursor: true,
    });
    expect(resolveZoom({ enabled: true, followCursor: false }).scale).toBe(2.4);
  });
});

describe("cameraAt", () => {
  const stops = [
    { frame: 0, x: 0, y: 0, z: 1 },
    { frame: 10, x: 100, y: 50, z: 2 },
  ];

  it("clamps to the first and last stop outside the timeline", () => {
    expect(cameraAt(-5, stops)).toEqual({ x: 0, y: 0, z: 1 });
    expect(cameraAt(99, stops)).toEqual({ x: 100, y: 50, z: 2 });
  });

  it("lerps linearly when a segment has no easing", () => {
    expect(cameraAt(5, stops)).toEqual({ x: 50, y: 25, z: 1.5 });
  });

  it("applies the segment's own easing", () => {
    const eased = [
      { frame: 0, x: 0, y: 0, z: 1 },
      { frame: 10, x: 100, y: 0, z: 1, easing: (t: number) => t * t },
    ];
    // t = 0.5 -> eased 0.25 -> x = 25
    expect(cameraAt(5, eased).x).toBeCloseTo(25);
  });
});

describe("buildCameraStops", () => {
  it("starts on the intro and ends landed on the terminal", () => {
    const stops = buildCameraStops(true, true, 1.5);
    const first = stops[0];
    const last = stops[stops.length - 1];
    expect(first.frame).toBe(0);
    expect(first.z).toBe(1);
    expect(last.z).toBe(1.5);
    // Frames strictly ascend — the camera never jumps backward in time.
    for (let i = 1; i < stops.length; i++) {
      expect(stops[i].frame).toBeGreaterThan(stops[i - 1].frame);
    }
  });

  it("collapses skipped stations so the path stays gap-free", () => {
    const noIntro = buildCameraStops(false, true, 1.5);
    expect(noIntro[0].frame).toBe(0); // starts directly on the command panel
    const terminalOnly = buildCameraStops(false, false, 2);
    expect(terminalOnly).toHaveLength(1);
    expect(cameraAt(0, terminalOnly).z).toBe(2);
  });

  it("holds still on the intro, then accelerates into the whip", () => {
    const stops = buildCameraStops(true, true, 1.5);
    // During the hold the camera does not move.
    expect(cameraAt(0, stops)).toEqual(cameraAt(15, stops));
    // The whip covers far more ground in its second half than its first
    // (sudden acceleration, not a linear slide).
    const a = cameraAt(41, stops).x - cameraAt(40, stops).x;
    const b = cameraAt(56, stops).x - cameraAt(55, stops).x;
    expect(b).toBeGreaterThan(a * 3);
  });
});

describe("cameraSpeed", () => {
  it("is zero while the camera holds and positive mid-whip", () => {
    const stops = buildCameraStops(true, true, 1.5);
    expect(cameraSpeed(10, stops)).toBe(0);
    expect(cameraSpeed(56, stops)).toBeGreaterThan(20);
  });
});

describe("parseIntro", () => {
  it("splits *emphasis* runs out, keeping surrounding text and spaces", () => {
    expect(parseIntro("*work* one step at a *time.*")).toEqual([
      { text: "work", accent: true },
      { text: " one step at a ", accent: false },
      { text: "time.", accent: true },
    ]);
  });

  it("returns a single plain run when there is no emphasis", () => {
    expect(parseIntro("just text")).toEqual([
      { text: "just text", accent: false },
    ]);
  });
});

describe("commandSpans", () => {
  it("colours manager, subcommand and args distinctly", () => {
    const spans = commandSpans("npm install one-tool");
    const words = spans.filter((s) => s.text.trim().length > 0);
    expect(words.map((w) => w.text)).toEqual(["npm", "install", "one-tool"]);
    // manager, subcommand and arg get three different colours.
    expect(new Set(words.map((w) => w.color)).size).toBe(3);
  });

  it("preserves whitespace so the joined text is unchanged", () => {
    const spans = commandSpans("yarn add react react-dom");
    expect(spans.map((s) => s.text).join("")).toBe("yarn add react react-dom");
  });
});
