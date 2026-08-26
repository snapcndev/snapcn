import { describe, expect, it } from "vitest";
import { INSTALL_ALL_NAMES } from "@/config/site";
import { suggestComponents } from "@/lib/registry-suggest";

const suggest = (q: string) => suggestComponents(q, INSTALL_ALL_NAMES);

describe("suggestComponents", () => {
  it("says nothing for the names that were actually invented", () => {
    // Verbatim from thirty days of `registry_component_missing`. None of these
    // is a typo of anything we ship, and offering the least-bad name in the
    // registry would send someone to install the wrong component confidently.
    for (const invented of [
      "blur-out-up",
      "dynamic-grid",
      "soft-blur-in",
      "number-wheel",
      "shader-warp",
      "line-by-line-slide",
      "frosted-glass-wipe",
      "rgb-glitch-text",
      "button",
      "dropdown",
      "combobox",
    ]) {
      expect(suggest(invented), invented).toEqual([]);
    }
  });

  it("catches a typo of a real name", () => {
    expect(suggest("text-revel")).toContain("text-reveal");
    expect(suggest("prompt-sned")).toContain("prompt-send");
    expect(suggest("logo-driftt")).toContain("logo-drift");
  });

  it("catches a near-miss on wording", () => {
    // Half the hyphenated words shared is the bar.
    expect(suggest("text-reveal-words")).toContain("text-reveal");
    expect(suggest("laptop-frame-scroll")).toContain("laptop-frame");
  });

  it("returns an exact name unchanged, if one is ever asked for", () => {
    expect(suggest("text-select")[0]).toBe("text-select");
  });

  it("offers at most three, best first", () => {
    expect(suggest("text-").length).toBeLessThanOrEqual(3);
  });

  it("is not confused by an empty or absurd name", () => {
    expect(suggest("")).toEqual([]);
    expect(suggest("-".repeat(200))).toEqual([]);
  });
});

describe("llms.txt names every installable component", () => {
  it("lists all of them, so an agent never has to guess", async () => {
    const { LLMS_HEADER } = await import("@/lib/llms");
    for (const name of INSTALL_ALL_NAMES) {
      expect(LLMS_HEADER, name).toContain(`@snapcn/${name}\``);
    }
  });

  it("tells the agent the list is closed", async () => {
    const { LLMS_HEADER } = await import("@/lib/llms");
    expect(LLMS_HEADER).toMatch(/complete set/i);
    expect(LLMS_HEADER).toMatch(/do not\s+infer, pluralise or invent/i);
  });
});
