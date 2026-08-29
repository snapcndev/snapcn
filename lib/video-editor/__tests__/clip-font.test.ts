import { describe, expect, it } from "vitest";

describe("per-clip fonts survive the round trip", () => {
  it("keeps a valid clip font and drops an invented one", async () => {
    const { reviveDraft } = await import("../draft");
    const draft = reviveDraft(
      {
        clips: [
          {
            id: "a",
            slug: "demo",
            props: {},
            durationInFrames: 30,
            font: "Inter",
          },
          {
            id: "b",
            slug: "demo",
            props: {},
            durationInFrames: 30,
            font: "Not A Font",
          },
          { id: "c", slug: "demo", props: {}, durationInFrames: 30 },
        ],
      },
      () => true,
    );
    // A stale draft naming a family that has left the Google set must lose the
    // typeface, not the clip — and never gain an explicit `undefined`, which is
    // invisible in JS and loud in the JSON that reaches the renderer.
    expect(draft?.clips.map((c) => c.font)).toEqual([
      "Inter",
      undefined,
      undefined,
    ]);
    expect("font" in (draft?.clips[2] ?? {})).toBe(false);
  });
});
