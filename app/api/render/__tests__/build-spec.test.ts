import { describe, expect, it, vi } from "vitest";
import { ANONYMOUS, PLANS, type PlanLimits } from "@/lib/plans";

// `@/auth` pulls NextAuth + the Drizzle adapter, and `server-only` refuses to
// load outside a server component graph. Neither is under test here: `buildSpec`
// is deliberately pure, and that purity is the property being checked.
vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: async () => null }));

const { buildSpec, quotaMessage } = await import("@/app/api/render/route");
const { QuotaExceededError } = await import("@/lib/server/entitlements");

const clips = [{ slug: "text-reveal", durationInFrames: 30, props: {} }];
const mark = (body: unknown, limits: PlanLimits) =>
  buildSpec(body, { limits }).inputProps.watermark;

describe("buildSpec watermark", () => {
  it("marks the render for an anonymous caller, asking or not", () => {
    expect(mark({ clips }, ANONYMOUS)).toBe(true);
    expect(mark({ clips, removeWatermark: true }, ANONYMOUS)).toBe(true);
  });

  it("marks it for a signed-in caller who has not paid", () => {
    // The change this file exists to pin down. Signing in used to remove the
    // mark, which handed the one paid feature to anyone with a GitHub account;
    // a free plan now gets exactly what a stranger gets.
    expect(mark({ clips }, PLANS.free)).toBe(true);
    expect(mark({ clips, removeWatermark: false }, PLANS.free)).toBe(true);
  });

  it("drops it only on a paid plan, asked for or not", () => {
    // And the mirror of it: paying is sufficient on its own. Nobody should have
    // to find a toggle to get the thing they bought.
    expect(mark({ clips }, PLANS.starter)).toBe(false);
    expect(mark({ clips, removeWatermark: false }, PLANS.starter)).toBe(false);
    expect(mark({ clips }, PLANS.pro)).toBe(false);
  });

  it("never reads the flag from the body, whatever shape it arrives in", () => {
    // A malformed, coerced, or perfectly well-formed `true` must all be worth
    // the same: nothing. The plan is the only input to this decision.
    for (const v of [true, "true", 1, {}, [], "yes", null]) {
      expect(mark({ clips, removeWatermark: v }, PLANS.free)).toBe(true);
      expect(mark({ clips, removeWatermark: v }, PLANS.starter)).toBe(false);
    }
  });

  it("ignores a watermark flag smuggled anywhere else in the body", () => {
    // The grant comes from the plan argument, never from the payload — so no
    // amount of shaping the body reaches `inputProps.watermark` directly.
    const hostile = {
      clips: [{ ...clips[0], watermark: false, removeWatermark: true }],
      watermark: false,
      inputProps: { watermark: false },
    };
    expect(mark(hostile, PLANS.free)).toBe(true);
    expect(mark(hostile, ANONYMOUS)).toBe(true);
  });

  it("does not let the body's extra keys reach the composition at all", () => {
    const spec = buildSpec(
      { clips, compositionId: "something-else" },
      { limits: PLANS.free },
    );
    expect(spec.compositionId).toBe("video-timeline");
    expect(Object.keys(spec.inputProps).sort()).toEqual([
      "audio",
      "clips",
      "font",
      "watermark",
    ]);
  });
});

describe("buildSpec output size", () => {
  it("renders at the plan's ceiling, in the canvas aspect", () => {
    // The second thing being sold. `render.ts` spreads these over the
    // composition, so these two numbers *are* the resolution of the MP4.
    const free = buildSpec({ clips }, { limits: PLANS.free });
    expect([free.width, free.height]).toEqual([1280, 720]);

    for (const paid of [PLANS.starter, PLANS.pro]) {
      const spec = buildSpec({ clips }, { limits: paid });
      expect([spec.width, spec.height]).toEqual([1920, 1080]);
    }
  });

  it("keeps both dimensions even for h.264", () => {
    // An odd dimension is not a slightly smaller video, it is libx264 refusing
    // the job after every frame has been drawn — so a future ceiling that does
    // not divide cleanly must still produce an encodable size.
    for (const maxWidth of [640, 1279, 1366, 1921]) {
      const spec = buildSpec(
        { clips },
        { limits: { ...PLANS.free, maxWidth } },
      );
      expect(spec.width % 2).toBe(0);
      expect(spec.height % 2).toBe(0);
      expect(spec.width).toBeCloseTo(maxWidth, -1);
    }
  });
});

describe("buildSpec input validation", () => {
  it("builds the audio URL from our own origin, never the caller's", () => {
    // The value becomes the `src` of an <Audio> our own headless Chrome
    // fetches. A caller-supplied URL there is a server-side request forgery
    // primitive, so only a uuid crosses the boundary and the URL is assembled
    // on this side.
    const id = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    const spec = buildSpec(
      { clips, audio: { id, volume: 0.5 } },
      { limits: PLANS.free, origin: "https://www.snapcn.dev" },
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
        buildSpec({ clips, audio: hostile }, { limits: PLANS.free }).inputProps
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
        buildSpec({ clips, audio: { id, trimStart } }, { limits: PLANS.free })
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
        buildSpec({ clips, audio: { id, volume } }, { limits: PLANS.free })
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
      buildSpec(body, { limits: PLANS.free }).inputProps.font;

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

describe("quotaMessage", () => {
  const err = (used: number, limit: number) =>
    new QuotaExceededError("x", used, limit);

  it("names the lapsed plan when the count overshot the allowance", () => {
    // Only reachable by running the count up under a bigger plan and then
    // losing it — the meter cannot increment past the number it tests against.
    const msg = quotaMessage(err(212, 50), "free");
    expect(msg).toContain("Your plan ended");
    expect(msg).toContain("212");
  });

  it("calls it fair use when someone simply reaches their ceiling", () => {
    const msg = quotaMessage(err(50, 50), "free");
    expect(msg).toContain("fair-use ceiling");
    expect(msg).not.toContain("Your plan ended");
  });

  it("never tells an anonymous caller their plan ended", () => {
    // They never had one. Reachable the moment the anonymous ceiling is
    // lowered below a count already on disk.
    const msg = quotaMessage(err(9, 5), "anonymous");
    expect(msg).not.toContain("Your plan ended");
    expect(msg).toContain("Signing in raises it");
  });

  it("does not offer sign-in to someone already signed in", () => {
    expect(quotaMessage(err(50, 50), "free")).not.toContain("Signing in");
  });
});
