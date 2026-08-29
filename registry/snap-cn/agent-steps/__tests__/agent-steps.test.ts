import { describe, expect, it } from "vitest";
import { columnOffset, ramp, schedule, toSteps } from "../index";

describe("toSteps", () => {
  it("passes an array through untouched", () => {
    const steps = [{ running: "a…", done: "a" }];
    expect(toSteps(steps)).toBe(steps);
  });

  it("splits the customizer's one-line form", () => {
    expect(toSteps("Reading… > Read 4 docs; Building… > Built it")).toEqual([
      { running: "Reading…", done: "Read 4 docs", icon: "check" },
      { running: "Building…", done: "Built it", icon: "check" },
    ]);
  });

  it("reads the trailing @globe marker", () => {
    expect(toSteps("Searching… > Searched the web @globe")).toEqual([
      { running: "Searching…", done: "Searched the web", icon: "globe" },
    ]);
  });

  it("falls back to the same label when no > is given", () => {
    expect(toSteps("Working")).toEqual([
      { running: "Working", done: "Working", icon: "check" },
    ]);
  });
});

describe("schedule", () => {
  it("enters each step on the frame after the last one finished", () => {
    const { steps, outro } = schedule([40, 31], 41, 17);
    expect(steps[0]).toEqual({ enter: 41, done: 81 });
    // The last step never completes — it is still running when the column
    // clears, which is what makes the result read as its answer.
    expect(steps[1].enter).toBe(82);
    expect(steps[1].done).toBe(Number.POSITIVE_INFINITY);
    expect(outro).toBe(99);
  });

  it("puts the outro one final hold after the last row enters", () => {
    const { steps, outro } = schedule([10], 5, 12);
    expect(steps[0].enter).toBe(5);
    expect(outro).toBe(17);
  });
});

describe("columnOffset", () => {
  it("is zero before the first row enters", () => {
    expect(columnOffset(0, [41, 82], 18.5)).toBe(0);
    expect(columnOffset(41, [41, 82], 18.5)).toBe(0);
  });

  it("reaches one row per completed shift", () => {
    expect(columnOffset(200, [41, 82], 18.5)).toBeCloseTo(2, 5);
  });

  it("carries two overlapping shifts at once", () => {
    // Second row lands three frames after the first, well inside the 18.5-frame
    // travel — the column has to be moving for both, not interpolating between
    // indices, or it visibly stalls and then jumps.
    const mid = columnOffset(50, [41, 44], 18.5);
    expect(mid).toBeGreaterThan(columnOffset(50, [41], 18.5));
    expect(mid).toBeLessThan(2);
  });
});

describe("ramp", () => {
  it("clamps at both ends", () => {
    expect(ramp(0, 10, 5)).toBe(0);
    expect(ramp(12.5, 10, 5)).toBe(0.5);
    expect(ramp(99, 10, 5)).toBe(1);
  });

  it("is a step when the duration is zero", () => {
    expect(ramp(9, 10, 0)).toBe(0);
    expect(ramp(10, 10, 0)).toBe(1);
  });
});
