import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  makeCancelSignal,
  renderFrames,
  selectComposition,
} from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { tsconfigWebpackAlias } from "../../scripts/tsconfig-webpack-alias.mts";
import type { Frame } from "./measure.ts";
import { decodePng, toGray } from "./png.ts";

/**
 * The ONLY module in `lib/motion-check` that imports `@remotion/renderer`.
 * `measure.ts` sees rasters and nothing else, which is what lets every check be
 * tested on synthetic frames with no browser (see `synthetic.ts`).
 *
 * Frames arrive as encoded PNG buffers in memory — `outputDir: null` +
 * `onFrameBuffer` — and are hashed and reduced to one luma byte per pixel in the
 * callback, then released. No disk, no ffmpeg, no mp4:
 *
 *   h264 yuv420p subsamples chroma and quantises luma, which destroys exactly
 *   the antialiasing `alpha = (pixel - bg) / (fg - bg)` reads. A 0.01px centroid
 *   off a DCT-quantised frame is a fabricated number.
 *
 * `renderStill()` per frame is the other obvious route and costs a browser
 * launch and a navigation per frame; `renderFrames` pays that once for the clip.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");

export interface CaptureOptions {
  /** Registry slug = composition id in src/remotion/dev-root.tsx. */
  slug: string;
  /** Merged over the config defaults. Needs the dev-root `defaultProps` edit. */
  inputProps?: Record<string, unknown>;
  /** Inclusive. Defaults to the whole composition. */
  frameRange?: [number, number];
  /**
   * Render PAST the composition's declared length. A stress copy can need more
   * frames than the component's author allowed, and "how many frames does this
   * copy actually need" is exactly the number a planner has to bill — it cannot
   * be measured inside a window that ends first.
   */
  durationInFrames?: number;
  /** Chromium tabs. Default Number(process.env.REMOTION_CONCURRENCY) || 4. */
  concurrency?: number;
  /** Pass one serveUrl across the whole registry — bundling is the fixed cost. */
  serveUrl?: string;
  signal?: AbortSignal;
}

export interface Capture {
  slug: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  /** Sorted by index — renderFrames delivers out of order under concurrency. */
  frames: Frame[];
}

let serveUrlPromise: Promise<string> | null = null;

/**
 * `bundle()` once per process, cached like `lib/server/bundle.ts`'s
 * `getServeUrl()` — which this deliberately does not reuse: that one is
 * `server-only` (it throws outside an RSC graph) and bundles the *site* root,
 * which registers the demo scenes rather than one composition per registry slug.
 *
 * Same webpack dance as `scripts/dev/render-one.mts`, and for the same reasons:
 * webpack does not read tsconfig `paths`, Tailwind classes are inert without
 * `enableTailwind`, and the pro barrel is gitignored in most checkouts.
 */
export function motionCheckServeUrl(): Promise<string> {
  if (serveUrlPromise) return serveUrlPromise;
  serveUrlPromise = (async () => {
    const proBarrel = path.join(
      root,
      "registry",
      "snap-cn-pro",
      "__index__.tsx",
    );
    const tsAliases = tsconfigWebpackAlias(root);
    await ensureBrowser();
    return await bundle({
      entryPoint: path.join(root, "src", "remotion", "dev-entry.ts"),
      ignoreRegisterRootWarning: true,
      webpackOverride: (raw) => {
        const config = enableTailwind(raw);
        const existing = Object.entries(config.resolve?.alias ?? {}).map(
          ([name, alias]) => ({
            name: name.replace(/\$$/, ""),
            alias: alias as string,
            onlyModule: name.endsWith("$"),
          }),
        );
        return {
          ...config,
          resolve: {
            ...config.resolve,
            alias: [
              {
                name: "@/registry/snap-cn-pro/__index__",
                alias: existsSync(proBarrel)
                  ? proBarrel
                  : path.join(root, "src", "remotion", "no-pro.ts"),
                onlyModule: true,
              },
              ...existing,
              ...tsAliases,
            ],
          },
        };
      },
    });
  })().catch((err) => {
    // Don't poison the cache on failure — the next call retries the bundle.
    serveUrlPromise = null;
    throw err;
  });
  return serveUrlPromise;
}

export async function captureFrames(opts: CaptureOptions): Promise<Capture> {
  const serveUrl = opts.serveUrl ?? (await motionCheckServeUrl());
  const inputProps = opts.inputProps ?? {};

  const selected = await selectComposition({
    serveUrl,
    id: opts.slug,
    inputProps,
  });
  const composition = opts.durationInFrames
    ? { ...selected, durationInFrames: opts.durationInFrames }
    : selected;

  const frames: Frame[] = [];
  // `makeCancelSignal` is Remotion's own; bridge an AbortSignal onto it so a
  // caller can stop a registry run without knowing about Remotion.
  const { cancelSignal, cancel } = makeCancelSignal();
  const onAbort = () => cancel();
  opts.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    await renderFrames({
      serveUrl,
      composition,
      inputProps,
      imageFormat: "png",
      // No disk. The buffer is the raster; it is reduced and dropped here.
      outputDir: null,
      onFrameBuffer: (buffer, frame) => {
        frames.push({
          index: frame,
          gray: toGray(decodePng(buffer)),
          hash: createHash("sha1").update(buffer).digest("hex"),
        });
      },
      // Sub-pixel checks need real device pixels; Remotion's per-frame cost is
      // page-eval plus screenshot, not pixel count, so scaling down buys little.
      scale: 1,
      frameRange: opts.frameRange ?? null,
      concurrency:
        opts.concurrency ?? (Number(process.env.REMOTION_CONCURRENCY) || 4),
      cancelSignal,
      onStart: () => {},
      onFrameUpdate: () => {},
    });
  } finally {
    opts.signal?.removeEventListener("abort", onAbort);
  }

  frames.sort((a, b) => a.index - b.index);
  return {
    slug: opts.slug,
    width: composition.width,
    height: composition.height,
    fps: composition.fps,
    durationInFrames: composition.durationInFrames,
    frames,
  };
}
