import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import pLimit from "p-limit";
import { RENDER_WORK_DIR } from "./paths";
import { renderComposition } from "./render";

/**
 * In-process render orchestration: a global concurrency semaphore plus a job
 * registry so the API can return a `jobId` immediately (202) and let the client
 * poll for progress. Renders are CPU-heavy (native Chromium), so at most
 * `RENDER_MAX_CONCURRENT` run at once; the rest wait in the limiter's queue.
 *
 * State is intentionally in-memory: a single long-lived Node process owns the
 * work dir, and a job only matters until its MP4 is downloaded (then swept).
 * Restarting the process drops in-flight jobs by design — clients re-POST.
 */

export type JobStatus = "queued" | "rendering" | "done" | "error";

export interface JobState {
  status: JobStatus;
  /** Render progress in [0, 1]. */
  progress: number;
  /** Absolute path to the finished MP4 (only once status === "done"). */
  outputPath?: string;
  /** Human-readable failure reason (only once status === "error"). */
  error?: string;
  /** Attachment filename served on download (e.g. "snapcn-video.mp4"). */
  fileName: string;
  createdAt: number;
}

/**
 * A composition-agnostic render request. The API route validates an untrusted
 * body into one of these (video-timeline, …) so the queue and the
 * renderer stay generic.
 */
export interface RenderSpec {
  /** Composition id registered in `src/remotion/Root.tsx`. */
  compositionId: string;
  /** Serializable props passed to the composition. */
  inputProps: Record<string, unknown>;
  /** Output dimensions. */
  width: number;
  height: number;
  /** Attachment filename for the finished MP4. */
  fileName: string;
  /**
   * Total frames the composition will render — the same figure
   * `calculateMetadata` derives in `src/remotion/Root.tsx`.
   *
   * It travels on the spec rather than being dug back out of `inputProps`
   * because the timeout needs the length *before* the render starts, and
   * `inputProps` is deliberately opaque here (the queue is composition-
   * agnostic). The per-account quota will want the same number.
   */
  durationInFrames: number;
}

/** Max simultaneous renders; the rest queue. Sized for the 8-vCPU box. */
function maxConcurrent(): number {
  const parsed = Number(process.env.RENDER_MAX_CONCURRENT);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 2;
}

/** Fixed allowance per render: browser launch, serving the bundle, ffmpeg finalise. */
const RENDER_STARTUP_MS = 60_000;

/**
 * Wall-clock budget per frame. Sized for the worst throughput we expect on a
 * saturated box, not the typical one — this is a stuck-process guard, and a
 * guard that fires on a merely slow render is a bug that only appears under
 * load, which is exactly when it does the most damage.
 */
const RENDER_MS_PER_FRAME = 200;

/**
 * Hard ceiling on a single render before it's aborted as stuck.
 *
 * Scaled by length rather than flat. The guard exists so a wedged Chromium
 * can't hold a semaphore slot forever, and any flat ceiling has to be set for
 * the longest video the editor allows (`MAX_TOTAL_FRAMES`, three minutes) —
 * which then lets a wedged three-second render sit on a slot for that same
 * span. The old flat 120 s failed the other way: it was shorter than a 60 s
 * export takes on an *idle* box, so every long render died as "stuck".
 *
 * `RENDER_TIMEOUT_MS` still overrides absolutely — for tests, and for a box
 * whose throughput doesn't match the constants above.
 */
function renderTimeoutMs(durationInFrames: number): number {
  const parsed = Number(process.env.RENDER_TIMEOUT_MS);
  if (Number.isFinite(parsed) && parsed >= 1000) return Math.floor(parsed);
  return (
    RENDER_STARTUP_MS + Math.max(1, durationInFrames) * RENDER_MS_PER_FRAME
  );
}

const limit = pLimit(maxConcurrent());
const jobs = new Map<string, JobState>();

/**
 * Register a render and kick it off through the concurrency limiter. Returns the
 * `jobId` synchronously — the actual render runs in the background and updates
 * the registry. Never await the returned render work in the request handler.
 */
export function enqueueRender(spec: RenderSpec): string {
  const jobId = randomUUID();
  const outputPath = path.join(RENDER_WORK_DIR, `${jobId}.mp4`);

  const job: JobState = {
    status: "queued",
    progress: 0,
    fileName: spec.fileName,
    createdAt: Date.now(),
  };
  jobs.set(jobId, job);

  // Fire-and-forget: the limiter serializes execution, errors are captured into
  // the job state, and we swallow the promise so it never becomes unhandled.
  void limit(() => runRender(jobId, spec, outputPath)).catch((err) => {
    const current = jobs.get(jobId);
    if (current && current.status !== "done") {
      current.status = "error";
      current.error = err instanceof Error ? err.message : "Render failed";
    }
  });

  return jobId;
}

/** Snapshot of a job's state, or undefined if the id is unknown. */
export function getJob(jobId: string): JobState | undefined {
  return jobs.get(jobId);
}

/** Drop a job from the registry (called after its file is cleaned up). */
export function deleteJob(jobId: string): void {
  jobs.delete(jobId);
}

/** Read-only view of the registry for the TTL sweep. */
export function listJobs(): ReadonlyMap<string, JobState> {
  return jobs;
}

async function runRender(
  jobId: string,
  spec: RenderSpec,
  outputPath: string,
): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return; // deleted before it got a slot

  job.status = "rendering";

  await mkdir(RENDER_WORK_DIR, { recursive: true });

  // Per-render timeout: abort stuck Chromium so a wedged render can't hold a
  // semaphore slot forever.
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    renderTimeoutMs(spec.durationInFrames),
  );

  try {
    await renderComposition({
      compositionId: spec.compositionId,
      inputProps: spec.inputProps,
      width: spec.width,
      height: spec.height,
      outputPath,
      signal: controller.signal,
      onProgress: (progress) => {
        const current = jobs.get(jobId);
        if (current) current.progress = progress;
      },
    });

    job.status = "done";
    job.progress = 1;
    job.outputPath = outputPath;
  } catch (err) {
    job.status = "error";
    job.error = controller.signal.aborted
      ? "Render timed out"
      : err instanceof Error
        ? err.message
        : "Render failed";
  } finally {
    clearTimeout(timeout);
  }
}
