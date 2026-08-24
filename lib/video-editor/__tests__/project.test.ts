import { describe, expect, it } from "vitest";
import {
  DEFAULT_TITLE,
  MAX_TITLE_LEN,
  ProjectInputError,
  parseProjectData,
  parseTitle,
} from "../project";
import { MAX_CLIPS } from "../types";

/**
 * The write side of a saved project — the one boundary the client cannot be
 * trusted with, because autosave fires unattended and what lands here goes
 * straight into a database row.
 */

describe("parseTitle", () => {
  it("trims, and falls back rather than storing an empty name", () => {
    expect(parseTitle("  Launch clip  ")).toBe("Launch clip");
    expect(parseTitle("   ")).toBe(DEFAULT_TITLE);
  });

  it("caps the length instead of rejecting a long one", () => {
    expect(parseTitle("x".repeat(500))).toHaveLength(MAX_TITLE_LEN);
  });

  it("rejects a non-string", () => {
    expect(() => parseTitle(42)).toThrow(ProjectInputError);
  });
});

describe("parseProjectData", () => {
  const data = {
    clips: [{ id: "clip-1", slug: "text-reveal" }],
    font: "Geist",
  };

  it("passes a timeline through unchanged", () => {
    expect(parseProjectData(data)).toBe(data);
  });

  it("refuses anything that is not a timeline object", () => {
    for (const bad of [null, "x", 3, [], {}, { clips: "no" }]) {
      expect(() => parseProjectData(bad)).toThrow(ProjectInputError);
    }
  });

  it("refuses more clips than the editor allows", () => {
    const clips = Array.from({ length: MAX_CLIPS + 1 }, (_, i) => ({
      id: `clip-${i}`,
    }));
    expect(() => parseProjectData({ clips })).toThrow(/limit/);
  });

  it("refuses a blob too large to be worth storing", () => {
    const clips = [{ id: "clip-1", props: { image: "d".repeat(6_000_000) } }];
    expect(() => parseProjectData({ clips })).toThrow(/too large/);
  });
});
