/**
 * Unit tests for lib/rendered-demos.tsx — URL construction.
 *
 * Run with:  pnpm vitest run lib/__tests__/rendered-demos.test.ts
 *
 * The bug these pin: the editor's library grid built `/demos/<slug>.mp4` by
 * hand, so it never carried the `?v=` byte-hash the manifest exists to provide
 * and kept replaying a stale demo out of the <video> cache after a re-render.
 */

import { describe, expect, it } from "vitest";
import demoManifest from "@/lib/demo-manifest.json";
import { RENDERED_DEMOS, renderedDemoSrc } from "@/lib/rendered-demos";

const manifest = demoManifest as Record<string, string>;

describe("renderedDemoSrc", () => {
  it("appends ?v=<hash> for every demo the manifest knows", () => {
    for (const [slug, version] of Object.entries(manifest)) {
      expect(renderedDemoSrc(slug)).toBe(`/demos/${slug}.mp4?v=${version}`);
    }
  });

  it("returns null for a slug that ships no rendered demo", () => {
    expect(renderedDemoSrc("not-a-demo")).toBeNull();
  });

  it("covers every slug in RENDERED_DEMOS — no entry silently loses its hash", () => {
    expect(RENDERED_DEMOS.length).toBeGreaterThan(0);
    for (const slug of RENDERED_DEMOS) {
      expect(renderedDemoSrc(slug)).toContain("?v=");
    }
  });

  it("manifest and RENDERED_DEMOS agree, so no demo is reachable un-hashed", () => {
    // Drift here is the failure mode: a demo on disk that RENDERED_DEMOS omits
    // can only be reached by hand-building its path, which is the bug above.
    expect([...RENDERED_DEMOS].sort()).toEqual(Object.keys(manifest).sort());
  });
});
