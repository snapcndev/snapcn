import { describe, expect, it } from "vitest";
import type { ControlConfig } from "@/lib/customizer-config";
import { applyBrand, type BrandKit, isLogoSrc, normalizeBrand } from "../brand";
import type { Clip } from "../types";

const controls: ControlConfig = {
  accentColor: {
    type: "color",
    default: "#000000",
    label: "Accent",
    brand: "accent",
  },
  titleColor: { type: "color", default: "#111111", label: "Title" },
  logoSrc: { type: "image", default: "", label: "Logo", brand: "logo" },
};
const clip = (props: Record<string, unknown>): Clip => ({
  id: "a",
  slug: "x",
  props,
  durationInFrames: 90,
});
const kit: BrandKit = { accent: "#ff0000", logo: "https://example.com/l.png" };
const lookup = () => controls;

describe("applyBrand", () => {
  it("moves the marked knobs and nothing else", () => {
    const [out] = applyBrand(
      [clip({ accentColor: "#000000", titleColor: "#111111", logoSrc: "" })],
      kit,
      lookup,
    );
    expect(out.props.accentColor).toBe("#ff0000");
    expect(out.props.logoSrc).toBe("https://example.com/l.png");
    // ink stays: a headline that follows the brand colour goes invisible
    expect(out.props.titleColor).toBe("#111111");
  });

  it("leaves a clip alone when nothing would change", () => {
    const clips = [
      clip({ accentColor: "#ff0000", logoSrc: "https://example.com/l.png" }),
    ];
    expect(applyBrand(clips, kit, lookup)[0]).toBe(clips[0]);
  });

  it("treats a null field as leave-alone, not clear", () => {
    const [out] = applyBrand(
      [clip({ accentColor: "#00ff00" })],
      { accent: null, logo: null },
      lookup,
    );
    expect(out.props.accentColor).toBe("#00ff00");
  });

  it("skips a slug the registry has no controls for", () => {
    const clips = [clip({ accentColor: "#000000" })];
    expect(applyBrand(clips, kit, () => undefined)[0]).toBe(clips[0]);
  });
});

describe("isLogoSrc", () => {
  it("takes https and inline images", () => {
    expect(isLogoSrc("https://a.test/l.svg")).toBe(true);
    expect(isLogoSrc("data:image/png;base64,AAAA")).toBe(true);
  });
  it("refuses everything that reaches an img src another way", () => {
    for (const bad of [
      "javascript:alert(1)",
      "http://a.test/l.png",
      "file:///etc/passwd",
      "data:text/html;base64,AA",
      "",
      7,
    ]) {
      expect(isLogoSrc(bad)).toBe(false);
    }
  });
});

describe("normalizeBrand", () => {
  it("drops anything that is not a hex or a legal image", () => {
    expect(normalizeBrand({ accent: "red", logo: "javascript:1" })).toEqual({
      accent: null,
      logo: null,
    });
    expect(normalizeBrand(undefined)).toEqual({ accent: null, logo: null });
    expect(
      normalizeBrand({ accent: "#abc", logo: "https://a.test/x.png" }),
    ).toEqual({ accent: "#abc", logo: "https://a.test/x.png" });
  });
});
