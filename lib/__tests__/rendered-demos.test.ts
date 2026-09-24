/**
 * Unit tests for lib/rendered-demos.tsx — URL construction.
 *
 * Run with:  pnpm vitest run lib/__tests__/rendered-demos.test.ts
 *
 * The bug these pin: the editor's library grid built `/demos/<slug>.mp4` by
 * hand, so it never carried the `?v=` byte-hash the manifest exists to provide
 * and kept replaying a stale demo out of the <video> cache after a re-render.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import demoManifest from "@/lib/demo-manifest.json";
import { MEDIA_BASE } from "@/lib/demo-urls";
import {
  playWhenLoaded,
  RENDERED_DEMOS,
  renderedDemoSrc,
} from "@/lib/rendered-demos";

const manifest = demoManifest as Record<string, string>;

describe("renderedDemoSrc", () => {
  it("appends ?v=<hash> for every demo the manifest knows", () => {
    for (const [slug, version] of Object.entries(manifest)) {
      expect(renderedDemoSrc(slug)).toBe(
        `${MEDIA_BASE}/demos/${slug}.mp4?v=${version}`,
      );
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

/**
 * Playback's readiness gate.
 *
 * The bug this pins: `pageLoaded` was a module-scope snapshot of
 * `document.readyState`, taken while the first page was still loading. If no
 * demo was on that page nothing queued, no `load` listener was ever attached,
 * and the stale `false` outlived the single `load` event the session gets. Every
 * card reached by client-side navigation afterwards waited for an event that had
 * already fired — `/docs/components` played on a hard refresh and was a wall of
 * still posters when you navigated to it.
 */
describe("playWhenLoaded", () => {
  const video = () => {
    const el = { paused: true, play: vi.fn(async () => {}) };
    return el as unknown as HTMLVideoElement & {
      play: ReturnType<typeof vi.fn>;
    };
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("plays at once when the document has finished loading", () => {
    vi.stubGlobal("document", { readyState: "complete" });
    const el = video();
    playWhenLoaded(el);
    expect(el.play).toHaveBeenCalledTimes(1);
  });

  it("waits for `load` while the document is still loading", () => {
    const listeners: (() => void)[] = [];
    vi.stubGlobal("document", { readyState: "loading" });
    vi.stubGlobal("window", {
      addEventListener: (name: string, fn: () => void) => {
        if (name === "load") listeners.push(fn);
      },
    });
    const el = video();
    playWhenLoaded(el);
    expect(el.play).not.toHaveBeenCalled();
    for (const fn of listeners) fn();
    expect(el.play).toHaveBeenCalledTimes(1);
  });

  it("still plays a card mounted after `load` has already gone by", async () => {
    // The regression itself, and it only reproduces if the module is *first
    // evaluated* while the document is loading — which is what happens in a
    // browser and never happens under a plain node import. Hence resetModules
    // and a dynamic import: this is the difference between pinning the bug and
    // pinning nothing.
    vi.stubGlobal("document", { readyState: "loading" });
    vi.stubGlobal("window", { addEventListener: () => {} });
    vi.resetModules();
    const fresh = await import("@/lib/rendered-demos");

    // The first page finishes with no demo on it, so nothing ever queued and no
    // `load` listener was ever attached. Then the reader navigates to
    // /docs/components and a card mounts.
    vi.stubGlobal("document", { readyState: "complete" });
    const el = video();
    fresh.playWhenLoaded(el);
    expect(el.play).toHaveBeenCalledTimes(1);
  });

  it("does not restart a demo that is already running", () => {
    vi.stubGlobal("document", { readyState: "complete" });
    const el = video();
    (el as unknown as { paused: boolean }).paused = false;
    playWhenLoaded(el);
    expect(el.play).not.toHaveBeenCalled();
  });
});
