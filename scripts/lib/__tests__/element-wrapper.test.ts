import { describe, expect, it } from "vitest";
import { hideLayers } from "../element-wrapper.mts";

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
