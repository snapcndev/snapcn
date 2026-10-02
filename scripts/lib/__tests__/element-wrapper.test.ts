import { describe, expect, it } from "vitest";
import { code, hideLayers, staticAssets } from "../element-wrapper.mts";

/**
 * A component-owned-sequence Element is one timeline layer. In Studio 4.0.52x
 * every `<AbsoluteFill>` / `<Img>` is a row of its own, so the scene's are hidden
 * and only the wrapper's Sequence — which sets `showInTimeline` itself — shows.
 */
describe("hideLayers", () => {
  it("hides the scene's Remotion layers and leaves the wrapper's", () => {
    const code =
      hideLayers(`import { AbsoluteFill, Img as Picture, Sequence } from "remotion";
import { Card } from "./card";
export const X = ({ showInTimeline }: { showInTimeline?: boolean }) => (
  <Sequence showInTimeline={showInTimeline}>
    <AbsoluteFill style={{ opacity: 1 }}>
      <Picture src="a.png" />
      <Card />
    </AbsoluteFill>
  </Sequence>
);
`);
    expect(code).toContain("<Sequence showInTimeline={showInTimeline}>");
    expect(code).toContain(
      "<AbsoluteFill showInTimeline={false} style={{ opacity: 1 }}>",
    );
    expect(code).toContain('<Picture showInTimeline={false} src="a.png" />');
    expect(code).toContain("<Card />");
  });
});

/**
 * An Element's starter files are copied into the project at install and read
 * with `staticFile()`, so a value holding one is written as that call, and the
 * payload declares every one it finds, however deep.
 */
describe("assets", () => {
  const photo = {
    staticFile: "card-rail/photo-1.webp",
    url: "https://x/1.webp",
  };
  it("writes an asset as staticFile() and anything else as JSON", () => {
    expect(code({ title: "A", image: photo, tags: [1, photo] })).toBe(
      '{ "title": "A", "image": staticFile("card-rail/photo-1.webp"), "tags": [1, staticFile("card-rail/photo-1.webp")] }',
    );
    expect(code(undefined)).toBe("undefined");
  });
  it("finds every asset, nested ones included", () => {
    expect(staticAssets([{ a: photo }, [photo], "x"])).toEqual([photo, photo]);
  });
});
