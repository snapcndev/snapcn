import { describe, expect, it } from "vitest";
import { hexToHsv, hsvToHex, normalizeHex } from "../color-hex";

describe("normalizeHex", () => {
  it("accepts what people actually paste", () => {
    expect(normalizeHex("#1a2b3c")).toBe("#1A2B3C");
    expect(normalizeHex("1a2b3c")).toBe("#1A2B3C");
    expect(normalizeHex("  #ABC  ")).toBe("#AABBCC");
  });

  it("returns null for a value still being typed", () => {
    // The whole reason the hex field is uncontrolled while focused: every one
    // of these is a keystroke on the way to a real colour, and treating any of
    // them as a colour makes the field fight the typist.
    // "#1a2" is absent on purpose: three digits is valid hex and means
    // #11AA22. The picker declines to *commit* it mid-type, which is a policy
    // the component owns — this function's job is only to say what parses.
    for (const partial of ["#", "#1", "#1a", "#1a2b", "#1a2b3"]) {
      expect(normalizeHex(partial)).toBeNull();
    }
    expect(normalizeHex("rebeccapurple")).toBeNull();
    expect(normalizeHex("#gggggg")).toBeNull();
  });
});

describe("hex ⇄ hsv", () => {
  it("round-trips the colours the swatches offer", () => {
    for (const hex of [
      "#0A0A0B",
      "#FFFFFF",
      "#F8371A",
      "#3FD0B6",
      "#2CADF6",
      "#6462FC",
    ]) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });

  it("handles the achromatic ends without inventing a hue", () => {
    expect(hexToHsv("#000000")).toEqual({ h: 0, s: 0, v: 0 });
    expect(hexToHsv("#FFFFFF")).toEqual({ h: 0, s: 0, v: 1 });
  });

  it("falls back to black rather than NaN on junk", () => {
    // Reachable from a saved project written by an older build.
    expect(hexToHsv("not a colour")).toEqual({ h: 0, s: 0, v: 0 });
  });

  it("puts primaries on the right hue", () => {
    expect(hexToHsv("#FF0000").h).toBe(0);
    expect(hexToHsv("#00FF00").h).toBe(120);
    expect(hexToHsv("#0000FF").h).toBe(240);
  });
});
