import { describe, expect, it } from "vitest";
import { isCopy } from "../motion-check.mts";

/**
 * `isCopy` decides which `text` controls the capacity sweep stresses with long
 * copy. Every false positive costs three renders and reports a number about a
 * prop that has no copy in it — `punch-lines` alone has five text controls that
 * are lists and CSS lengths, and before this it was billed against `wordSpacing`.
 */
describe("isCopy", () => {
  it("keeps prose, including lists that breathe", () => {
    for (const value of [
      "No extra charge",
      "Introducing",
      "snapcn 1.0",
      "You built the app. / Now show it. | And make it move. | Fast.",
      "animating, transitioning, rendering a scene, installed",
      "text-reveal, phone-frame, answer-stream, word-flip",
    ]) {
      expect(isCopy(value), value).toBe(true);
    }
  });

  it("rejects everything else a text control carries", () => {
    for (const value of [
      "",
      "https://example.com/a.png",
      "M15.757 15.459c-3.324 0.816 -6.07 2.966",
      "#5600f5",
      "0 40px 80px rgba(10,12,20,0.45)",
      "-0.013em",
      "0.25s",
      "slide,punch",
      "1,0.909,3.357",
      "59,39,37",
    ]) {
      expect(isCopy(value), value).toBe(false);
    }
  });
});
