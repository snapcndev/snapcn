import { describe, expect, it } from "vitest";
import { CONFIGS } from "@/registry/__configs__";
import { cursorTrackFrames, DEMO_PATH } from "@/registry/snap-cn/cursor-track";
import {
  DEMO_CAMERA,
  screenRecordingFrames,
} from "@/registry/snap-cn/screen-recording";

/**
 * Both screen components report a `durationInFrames` that is their demo
 * track's length — and every other config in the repo computes that number by
 * calling the component's own frame-count helper, so it cannot drift.
 *
 * Neither can. `registry/__configs__.ts` is imported by the MCP's
 * `scripts/build-manifest.mjs` under plain `node`, and **node cannot load a
 * `.tsx` file at all** — not with type stripping, not with
 * `--experimental-transform-types`, not with any flag; the loader rejects the
 * extension outright. Both of these components are a single `index.tsx`, so
 * a `config.ts` that imports one to compute its duration takes
 * `pnpm run registry:build` down with `ERR_MODULE_NOT_FOUND`. (`type-morph` gets
 * to compute its length only because its timeline lives in a sibling `.ts`.)
 *
 * So the number is written out, and this is the thing that stops it lying.
 * Vitest transforms `.tsx` happily, so the assertion the config could not make
 * is made here instead: change a demo track and this fails with the new number.
 */
describe("screen component demo durations", () => {
  it.each([
    ["screen-recording", () => screenRecordingFrames(DEMO_CAMERA)],
    ["cursor-track", () => cursorTrackFrames(DEMO_PATH)],
  ])("%s reports its own track's length", (name, frames) => {
    expect(
      CONFIGS[name].durationInFrames,
      `${name}/config.ts has a stale durationInFrames — write ${frames()}`,
    ).toBe(frames());
  });
});
