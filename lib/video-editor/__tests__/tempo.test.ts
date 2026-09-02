import { describe, expect, it } from "vitest";
import type { ControlConfig } from "@/lib/customizer-config";
import { applyTempo, normalizeTempo } from "../tempo";
import { type Clip, MAX_TOTAL_FRAMES } from "../types";

const speedy: ControlConfig = {
  speed: {
    type: "number",
    default: 1,
    min: 0.25,
    max: 4,
    step: 0.25,
    label: "Speed",
  },
};
// 18 of the registry's speed controls look like this: tuned at their own pace
// or faster, never slower.
const fastOnly: ControlConfig = {
  speed: {
    type: "number",
    default: 1,
    min: 1,
    max: 4,
    step: 0.25,
    label: "Speed",
  },
};
const none: ControlConfig = {
  text: { type: "text", default: "hi", label: "Text" },
};
const clip = (slug: string, durationInFrames = 200, props = {}): Clip => ({
  id: slug,
  slug,
  props,
  durationInFrames,
});

describe("applyTempo", () => {
  it("speeds the clock up and shortens the clip to match", () => {
    const [out] = applyTempo([clip("a")], 2, () => speedy);
    expect(out.props.speed).toBe(2);
    expect(out.durationInFrames).toBe(100);
  });

  it("leaves a component with no speed control alone", () => {
    const clips = [clip("a")];
    expect(applyTempo(clips, 2, () => none)[0]).toBe(clips[0]);
  });

  it("clamps to the control's own range, not the dial's", () => {
    // min is 1, so this component cannot slow down: it is left exactly as it
    // was, rather than carrying a `speed` its own control would reject.
    const clips = [clip("a")];
    expect(applyTempo(clips, 0.5, () => fastOnly)[0]).toBe(clips[0]);
    // and it still speeds up
    const [fast] = applyTempo(clips, 2, () => fastOnly);
    expect(fast.props.speed).toBe(2);
    expect(fast.durationInFrames).toBe(100);
  });

  it("scales a hand-trimmed length rather than resetting it", () => {
    const [out] = applyTempo([clip("a", 60)], 2, () => speedy);
    expect(out.durationInFrames).toBe(30);
  });

  it("is reversible", () => {
    const start = [clip("a")];
    const fast = applyTempo(start, 2, () => speedy);
    const back = applyTempo(fast, 1, () => speedy);
    expect(back[0].durationInFrames).toBe(200);
    expect(back[0].props.speed).toBe(1);
  });

  it("never grows the timeline past what the export accepts", () => {
    const clips = [clip("a", 1800), clip("b", 1800), clip("c", 1800)];
    const out = applyTempo(clips, 0.5, () => speedy);
    const total = out.reduce((n, c) => n + c.durationInFrames, 0);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_FRAMES);
  });
});

describe("normalizeTempo", () => {
  it("refuses anything outside the dial", () => {
    expect(normalizeTempo(9)).toBe(1);
    expect(normalizeTempo("2")).toBe(1);
    expect(normalizeTempo(1.5)).toBe(1.5);
  });
});
