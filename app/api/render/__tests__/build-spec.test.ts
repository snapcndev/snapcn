import { describe, expect, it, vi } from "vitest";

// `@/auth` pulls NextAuth + the Drizzle adapter, and `server-only` refuses to
// load outside a server component graph. Neither is under test here: `buildSpec`
// is deliberately pure, and that purity is the property being checked.
vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: async () => null }));

const { buildSpec } = await import("@/app/api/render/route");

const clips = [{ slug: "text-reveal", durationInFrames: 30, props: {} }];
const mark = (body: unknown, signedIn: boolean) =>
  buildSpec(body, { signedIn }).inputProps.watermark;

describe("buildSpec watermark", () => {
  it("marks the render for a signed-out caller, asking or not", () => {
    expect(mark({ clips }, false)).toBe(true);
    expect(mark({ clips, removeWatermark: true }, false)).toBe(true);
  });

  it("marks it for a signed-in caller who did not ask", () => {
    // Signing in offers the choice; it does not make it. A user who never
    // touched the toggle still gets the snapcn mark on their export.
    expect(mark({ clips }, true)).toBe(true);
    expect(mark({ clips, removeWatermark: false }, true)).toBe(true);
  });

  it("drops it only when the caller is signed in AND asked", () => {
    expect(mark({ clips, removeWatermark: true }, true)).toBe(false);
  });

  it("treats anything other than an explicit true as no", () => {
    // A malformed or coerced value must not read as consent to a paid feature.
    for (const v of ["true", 1, {}, [], "yes", null]) {
      expect(mark({ clips, removeWatermark: v }, true)).toBe(true);
    }
  });

  it("ignores a watermark flag smuggled anywhere else in the body", () => {
    // The grant comes from the session argument, never from the payload — so
    // no amount of shaping the body reaches `inputProps.watermark` directly.
    const hostile = {
      clips: [{ ...clips[0], watermark: false, removeWatermark: true }],
      watermark: false,
      inputProps: { watermark: false },
    };
    expect(mark(hostile, false)).toBe(true);
  });

  it("does not let the body's extra keys reach the composition at all", () => {
    const spec = buildSpec(
      { clips, compositionId: "something-else" },
      { signedIn: false },
    );
    expect(spec.compositionId).toBe("video-timeline");
    expect(Object.keys(spec.inputProps).sort()).toEqual([
      "audio",
      "clips",
      "font",
      "watermark",
    ]);
  });

  it("builds the audio URL from our own origin, never the caller's", () => {
    // The value becomes the `src` of an <Audio> our own headless Chrome
    // fetches. A caller-supplied URL there is a server-side request forgery
    // primitive, so only a uuid crosses the boundary and the URL is assembled
    // on this side.
    const id = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    const spec = buildSpec(
      { clips, audio: { id, volume: 0.5 } },
      { signedIn: false, origin: "https://www.snapcn.dev" },
    );
    expect(spec.inputProps.audio).toMatchObject({
      src: `https://www.snapcn.dev/api/audio/${id}`,
      volume: 0.5,
    });

    for (const hostile of [
      { src: "http://169.254.169.254/latest/meta-data" },
      { id: "http://evil.test/x.mp3" },
      { id: "../../etc/passwd" },
      { id: `${id}/../../x` },
      { id: 7 },
      "not-an-object",
      null,
    ]) {
      expect(
        buildSpec({ clips, audio: hostile }, { signedIn: false }).inputProps
          .audio,
      ).toBeNull();
    }
  });

  it("keeps the crop offset finite and non-negative", () => {
    // It becomes a frame offset on <Audio>. A NaN or a negative there is a
    // render that produces no frames at all.
    const id = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    const trim = (trimStart: unknown) =>
      (
        buildSpec({ clips, audio: { id, trimStart } }, { signedIn: false })
          .inputProps.audio as { trimStart: number }
      ).trimStart;
    expect(trim(12.5)).toBe(12.5);
    expect(trim(-9)).toBe(0);
    expect(trim(Number.NaN)).toBe(0);
    expect(trim(Number.POSITIVE_INFINITY)).toBe(0);
    expect(trim("30")).toBe(0);
    expect(trim(999_999)).toBe(3600);
  });

  it("clamps the soundtrack volume into 0..1", () => {
    const id = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    const vol = (volume: unknown) =>
      (
        buildSpec({ clips, audio: { id, volume } }, { signedIn: false })
          .inputProps.audio as { volume: number }
      ).volume;
    expect(vol(-4)).toBe(0);
    expect(vol(9)).toBe(1);
    expect(vol(0.25)).toBe(0.25);
    expect(vol(Number.NaN)).toBe(1);
    expect(vol("loud")).toBe(1);
  });

  it("accepts built-in stacks and real Google families, and nothing else", () => {
    // The value reaches both a `font-family` and a fonts.googleapis.com URL
    // inside a server-side render, so it is an allow-list lookup against the
    // catalogue shipped in @remotion/google-fonts — never the caller's string.
    const font = (body: unknown) =>
      buildSpec(body, { signedIn: false }).inputProps.font;

    for (const ok of ["system", "serif", "mono", "Inter", "Playfair Display"]) {
      expect(font({ clips, font: ok })).toBe(ok);
    }
    for (const bad of [
      "Comic Sans",
      "",
      7,
      null,
      {},
      "Inter; x",
      "Inter&text=x",
      "../../etc",
      "inter",
    ]) {
      expect(font({ clips, font: bad })).toBe("Geist");
    }
  });
});
