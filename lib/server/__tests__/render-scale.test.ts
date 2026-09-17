import { describe, expect, it } from "vitest";
import { outputScale } from "@/lib/server/render";

const CANVAS = { width: 1280, height: 720 };

describe("outputScale", () => {
  it("renders a paid 1080p export as the 1280 layout at 1.5x", () => {
    expect(outputScale(CANVAS, 1920, 1080)).toBe(1.5);
  });

  it("leaves a free 720p export unscaled", () => {
    expect(outputScale(CANVAS, 1280, 720)).toBe(1);
  });

  it("refuses an output that would crop or letterbox", () => {
    expect(() => outputScale(CANVAS, 1080, 1920)).toThrow();
  });
});
