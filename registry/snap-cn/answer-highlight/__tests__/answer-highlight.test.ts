import { describe, expect, it } from "vitest";
import { bare, dragEdge, findRun, paintBand, ramp, splitWords } from "../index";

describe("splitWords", () => {
  it("keeps punctuation attached to its word", () => {
    expect(splitWords("keep it declarative, always")).toEqual([
      "keep",
      "it",
      "declarative,",
      "always",
    ]);
  });

  it("collapses runs of whitespace and newlines", () => {
    expect(splitWords("  a\n\n b   c ")).toEqual(["a", "b", "c"]);
  });
});

describe("bare", () => {
  it("strips outer punctuation only", () => {
    expect(bare("declarative,")).toBe("declarative");
    expect(bare('"quoted."')).toBe("quoted");
    expect(bare("state-of-the-art")).toBe("state-of-the-art");
    expect(bare("30-second")).toBe("30-second");
  });
});

describe("findRun", () => {
  const words = splitWords(
    "Build one composition per scene and keep the timeline declarative, so it renders.",
  );

  it("finds a run without needing its punctuation written in", () => {
    expect(findRun(words, "keep the timeline declarative")).toEqual([6, 10]);
  });

  it("finds a single word", () => {
    expect(findRun(words, "declarative")).toEqual([9, 10]);
  });

  it("returns null rather than a near miss", () => {
    expect(findRun(words, "keep the timeline honest")).toBeNull();
    expect(findRun(words, "")).toBeNull();
  });

  it("finds the first occurrence when a phrase repeats", () => {
    expect(findRun(splitWords("a b a b"), "a b")).toEqual([0, 2]);
  });
});

describe("dragEdge", () => {
  it("is zero before the drag and the full count after it", () => {
    expect(dragEdge(0, 10, 3, 4)).toBe(0);
    expect(dragEdge(10, 10, 3, 4)).toBe(0);
    expect(dragEdge(999, 10, 3, 4)).toBe(4);
  });

  it("is fractional inside a word, so the edge does not jump", () => {
    expect(dragEdge(11.5, 10, 3, 4)).toBeCloseTo(0.5, 5);
    expect(dragEdge(16, 10, 3, 4)).toBeCloseTo(2, 5);
  });
});

describe("paintBand", () => {
  it("paints nothing before the drag reaches the word", () => {
    expect(paintBand(0, "rgb(1 2 3 / 0.16)", "#3072db", 2)).toBeUndefined();
  });

  it("paints a solid band once the drag is past", () => {
    expect(paintBand(1, "BAND", "#3072db", 2)).toBe("BAND");
  });

  it("paints a hard stop and a caret while crossing", () => {
    const bg = paintBand(0.5, "BAND", "CARET", 2) ?? "";
    expect(bg).toContain("linear-gradient(to right, BAND 0 50.00%");
    expect(bg).toContain("CARET 50.00%");
    expect(bg).toContain("calc(50.00% + 2.00px)");
    expect(bg).toContain("transparent");
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
