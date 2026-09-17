import "server-only";
import { getServeUrl } from "./bundle";

/**
 * Loaded on demand, never at module scope.
 *
 * `@remotion/renderer` ships a native compositor binary. A serverless deploy
 * does not trace those `.node` files into the function, so importing this
 * module at the top level throws at *evaluation* — and because bundlers hoist
 * the whole chunk, that took down every route that merely sat downstream of
 * `render-queue` (`/api/audio`, `/api/showcase`, `/api/projects`), none of
 * which render anything. Behind a function call, only a real render can hit it.
 */
function loadRenderer() {
  return import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */
    "@remotion/renderer"
  );
}

/**
 * Server-side MP4 render of any registered Remotion composition (
 * video-timeline, …). Full native quality on the box — width/height are passed
 * per request and reached with `scale`, never by resizing the composition.
 */

/** Concurrency (Chromium tabs) for a single render; env-tunable, default 4. */
function remotionConcurrency(): number {
  const parsed = Number(process.env.REMOTION_CONCURRENCY);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 4;
}

export interface RenderCompositionOptions {
  /** Composition id registered in `src/remotion/Root.tsx`. */
  compositionId: string;
  /** Serializable props; drive duration (video-timeline) + content. */
  inputProps: Record<string, unknown>;
  /** Output dimensions (override the composition defaults). */
  width: number;
  height: number;
  /** Absolute path the encoded MP4 is written to. */
  outputPath: string;
  /** Render progress in [0, 1]. */
  onProgress?: (progress: number) => void;
  /** Abort the render (client disconnect / timeout) → cancels Chromium. */
  signal?: AbortSignal;
}

/**
 * Render `compositionId` with `inputProps` to `outputPath`. Bridges a standard
 * AbortSignal onto Remotion's CancelSignal so a stuck/abandoned render can be
 * killed. Duration comes from the composition (video-timeline computes it from
 * `clips` via `calculateMetadata`).
 */
export async function renderComposition({
  compositionId,
  inputProps,
  width,
  height,
  outputPath,
  onProgress,
  signal,
}: RenderCompositionOptions): Promise<string> {
  if (signal?.aborted) {
    throw new Error("Render aborted before it started");
  }

  const { makeCancelSignal, renderMedia, selectComposition } =
    await loadRenderer();
  const serveUrl = await getServeUrl();

  const composition = await selectComposition({
    serveUrl,
    id: compositionId,
    inputProps,
  });

  const { cancelSignal, cancel } = makeCancelSignal();
  const onAbort = () => cancel();
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      inputProps,
      outputLocation: outputPath,
      scale: outputScale(composition, width, height),
      concurrency: remotionConcurrency(),
      cancelSignal,
      onProgress: onProgress
        ? ({ progress }) => onProgress(progress)
        : undefined,
    });
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }

  return outputPath;
}

/**
 * The output size, as a scale of the composition — never a bigger viewport.
 *
 * Scenes lay themselves out in px for the canvas they were authored at. Passing
 * 1920×1080 as the composition's own size widened the *page*, so every fixed-px
 * scene rendered at 1280-layout inside a 1920 frame: a paid 1080p export came
 * out with its type at 67% and its margins wrong. `scale` rasterises the same
 * layout at more pixels, which is what "higher resolution" means.
 *
 * Throws on an aspect mismatch rather than scaling from one axis and silently
 * cropping or letterboxing the other.
 */
export function outputScale(
  composition: { width: number; height: number },
  width: number,
  height: number,
): number {
  const scale = width / composition.width;
  if (Math.round(composition.height * scale) !== height) {
    throw new Error(
      `Output ${width}x${height} is not ${composition.width}x${composition.height} scaled`,
    );
  }
  return scale;
}
