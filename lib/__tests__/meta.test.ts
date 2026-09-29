import { describe, expect, it } from "vitest";
import { DESCRIPTION_MAX, metaDescription, metaTitle } from "@/lib/meta";

describe("metaTitle", () => {
  it("keeps the suffix when it fits and drops it when it does not", () => {
    expect(metaTitle("Installation — add snapcn to a Remotion project")).toBe(
      "Installation — add snapcn to a Remotion project",
    );
    const long =
      "Remotion counter animation — count-up numbers and follower counts";
    expect(metaTitle(long)).toEqual({ absolute: long });
  });
});

describe("metaDescription", () => {
  it("leaves a short one alone", () => {
    expect(metaDescription("A short line.")).toBe("A short line.");
  });

  it("keeps whole sentences when they say enough", () => {
    const text = `${"Add the MCP server to Claude Code and Cursor today, in one command and a minute. ".repeat(2)}And a third sentence that no longer fits the limit at all.`;
    const out = metaDescription(text);
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(out.endsWith(".")).toBe(true);
  });

  it("cuts on a word when the first sentence alone is too long", () => {
    const out = metaDescription(`${"word ".repeat(60)}end.`);
    expect(out.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(out.endsWith("word…")).toBe(true);
  });
});
