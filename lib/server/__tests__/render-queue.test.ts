/**
 * Unit tests for lib/server/render-queue.ts
 *
 * Run with:  pnpm vitest run lib/server/__tests__/render-queue.test.ts
 *
 * renderComposition (real Chromium) is mocked via vi.mock so nothing real runs.
 * node:fs/promises (mkdir) is also mocked — no real filesystem side-effects.
 *
 * --- Seam note ---
 * render-queue.ts imports renderComposition from "./render" at module load time,
 * then calls it inside runRender(). vi.mock("@/lib/server/render") replaces that
 * module before the queue module is imported, so the mock is in effect for all
 * enqueueRender() calls below.  The module-level `limit` and `jobs` singletons
 * are reset between tests by re-importing the module inside a vi.isolateModules
 * block — see the "resetQueue" helper.  If the queue ever needs a cleaner
 * injection point (e.g. an exported `_setRenderFn` for testing), that would
 * remove the need for vi.isolateModules, but the current mock approach is
 * sufficient.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import type { RenderSpec } from "@/lib/server/render-queue";

// ---------------------------------------------------------------------------
// Mock the render module (real Chromium → deferred promise under test control)
// ---------------------------------------------------------------------------

vi.mock("@/lib/server/render", () => ({
  renderComposition: vi.fn(),
}));

// Mock mkdir so no real fs ops happen.
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

// Mock server-only so it doesn't blow up in vitest.
vi.mock("server-only", () => ({}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A valid RenderSpec (the queue is composition-agnostic — content is opaque). */
function makeSpec(
  fileName = "owner-repo-stars.mp4",
  durationInFrames = 300,
): RenderSpec {
  return {
    compositionId: "github-stars",
    inputProps: { repo: "owner/repo", totalStars: 100 },
    width: 1280,
    height: 720,
    fileName,
    durationInFrames,
  };
}

/**
 * A render that never finishes on its own and rejects the moment it's aborted —
 * i.e. a stuck Chromium that honours the cancel signal.
 */
function wedgedRender() {
  return ({ signal }: { signal?: AbortSignal }) =>
    new Promise<string>((_, reject) => {
      signal?.addEventListener("abort", () =>
        reject(new Error("Render aborted")),
      );
    });
}

/**
 * Returns a { resolve, reject, promise } triple: the promise stays pending
 * until resolve/reject is called, simulating a long-running render.
 */
function deferred<T = string>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { resolve, reject, promise };
}

/**
 * Let queued promises settle. Fake timers are active in every test, so a
 * `setTimeout`-based tick would never fire; instead advance the (fake) clock by
 * 0 ms to run any due timers, then flush several microtask turns so p-limit's
 * dispatch chain (enqueue → dequeue → runRender → awaited mocks) completes.
 */
const tick = async () => {
  await vi.advanceTimersByTimeAsync(0);
  for (let i = 0; i < 25; i++) {
    await Promise.resolve();
  }
};

// ---------------------------------------------------------------------------
// Import queue + mock render fn after all vi.mock() calls are hoisted.
// ---------------------------------------------------------------------------

import { renderComposition } from "@/lib/server/render";
import { enqueueRender, getJob } from "@/lib/server/render-queue";

const mockRender = renderComposition as unknown as MockInstance<
  typeof renderComposition
>;

// ---------------------------------------------------------------------------
// Reset mock state between tests (the module singleton is shared across the
// file because vitest re-uses the same module instance within a test file).
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  mockRender.mockReset();
  delete process.env.RENDER_TIMEOUT_MS;
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Status transitions: queued → rendering → done
// ---------------------------------------------------------------------------

describe("render-queue — status transitions", () => {
  it("newly enqueued job starts as 'queued'", () => {
    const d = deferred();
    mockRender.mockReturnValueOnce(d.promise);

    const jobId = enqueueRender(makeSpec());
    const job = getJob(jobId);

    // Synchronously the job is registered.
    expect(job).toBeDefined();
    expect(job!.status).toBe("queued");
    expect(job!.progress).toBe(0);

    // Clean up: let it resolve so the limiter slot is freed.
    d.resolve("/tmp/out.mp4");
  });

  it("transitions to 'rendering' once the slot is acquired", async () => {
    const d = deferred();
    mockRender.mockReturnValueOnce(d.promise);

    const jobId = enqueueRender(makeSpec());

    // Allow the microtask queue to run so the limiter picks up the task.
    await tick();

    const job = getJob(jobId);
    expect(job!.status).toBe("rendering");

    d.resolve("/tmp/out.mp4");
    await tick();
  });

  it("transitions to 'done' with progress=1 after renderComposition resolves", async () => {
    const d = deferred();
    mockRender.mockReturnValueOnce(d.promise);

    const jobId = enqueueRender(makeSpec());
    await tick();

    d.resolve("/tmp/out.mp4");
    await tick();

    const job = getJob(jobId);
    expect(job!.status).toBe("done");
    expect(job!.progress).toBe(1);
    expect(job!.outputPath).toBeDefined();
  });

  it("stores the download fileName on the job", () => {
    mockRender.mockResolvedValueOnce("/tmp/x.mp4");
    const jobId = enqueueRender(makeSpec("my-org-my-repo-stars.mp4"));
    expect(getJob(jobId)!.fileName).toBe("my-org-my-repo-stars.mp4");
  });

  it("returns a string jobId that differs between two calls", () => {
    mockRender.mockResolvedValue("/tmp/x.mp4");
    const id1 = enqueueRender(makeSpec());
    const id2 = enqueueRender(makeSpec());
    expect(typeof id1).toBe("string");
    expect(id1).not.toBe(id2);
  });
});

// ---------------------------------------------------------------------------
// Error path: renderComposition rejects → job.status = "error"
// ---------------------------------------------------------------------------

describe("render-queue — error path", () => {
  it("sets status to 'error' when renderComposition rejects", async () => {
    mockRender.mockRejectedValueOnce(new Error("Chromium crashed"));

    const jobId = enqueueRender(makeSpec());
    await tick();
    await tick(); // extra tick for rejection propagation

    const job = getJob(jobId);
    expect(job!.status).toBe("error");
    expect(job!.error).toContain("Chromium crashed");
  });

  it("captures a generic (non-Error) rejection as a fallback string", async () => {
    mockRender.mockRejectedValueOnce("raw string failure");

    const jobId = enqueueRender(makeSpec());
    await tick();
    await tick();

    const job = getJob(jobId);
    expect(job!.status).toBe("error");
    expect(typeof job!.error).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Concurrency cap — at most RENDER_MAX_CONCURRENT renders in flight at once
// ---------------------------------------------------------------------------

describe("render-queue — concurrency semaphore", () => {
  it("runs at most RENDER_MAX_CONCURRENT renders simultaneously (default 2)", async () => {
    // Each deferred keeps its render slot occupied until resolved.
    const deferreds = Array.from({ length: 4 }, () => deferred());
    let callCount = 0;

    mockRender.mockImplementation(() => {
      callCount++;
      return deferreds[callCount - 1].promise;
    });

    // Enqueue 4 jobs.
    const ids = Array.from({ length: 4 }, () => enqueueRender(makeSpec()));

    // Let the event loop run so the limiter can dispatch.
    await tick();
    await tick();

    // Only 2 should be rendering (default RENDER_MAX_CONCURRENT = 2).
    const statuses = ids.map((id) => getJob(id)!.status);
    const renderingCount = statuses.filter((s) => s === "rendering").length;
    const queuedCount = statuses.filter((s) => s === "queued").length;

    expect(renderingCount).toBe(2);
    expect(queuedCount).toBe(2);

    // Resolve the first two; the next two should start.
    deferreds[0].resolve("/tmp/a.mp4");
    deferreds[1].resolve("/tmp/b.mp4");
    await tick();
    await tick();

    const newStatuses = ids.map((id) => getJob(id)!.status);
    // ids[0] and ids[1] should now be done.
    expect(newStatuses[0]).toBe("done");
    expect(newStatuses[1]).toBe("done");
    // ids[2] or ids[3] should have started rendering.
    const nowRendering = newStatuses.filter((s) => s === "rendering").length;
    expect(nowRendering).toBeGreaterThanOrEqual(1);

    // Clean up remaining.
    deferreds[2].resolve("/tmp/c.mp4");
    deferreds[3].resolve("/tmp/d.mp4");
    await tick();
  });
});

// ---------------------------------------------------------------------------
// Timeout path — AbortController fires → job.status = "error" with "timed out"
// ---------------------------------------------------------------------------

describe("render-queue — render timeout", () => {
  it("sets status to 'error' containing 'timed out' when RENDER_TIMEOUT_MS elapses", async () => {
    // Set a very short timeout via env so we don't wait 120 s.
    process.env.RENDER_TIMEOUT_MS = "1000";

    // renderComposition never resolves — simulates a stuck Chromium.
    // The real runRender() uses an AbortController; when the timeout fires it
    // calls controller.abort(). renderComposition must honor the signal and
    // throw. We simulate that by rejecting once the abort callback fires.
    let abortCallback: (() => void) | undefined;
    mockRender.mockImplementation(({ signal }: { signal?: AbortSignal }) => {
      return new Promise<string>((_, reject) => {
        if (signal) {
          signal.addEventListener("abort", () => {
            abortCallback = () => reject(new Error("Render aborted"));
            abortCallback();
          });
        }
      });
    });

    const jobId = enqueueRender(makeSpec());
    await tick();

    // Advance fake timers past the timeout.
    vi.advanceTimersByTime(1100);
    await tick();
    await tick();

    const job = getJob(jobId);
    expect(job!.status).toBe("error");
    // The queue sets job.error to "Render timed out" when signal.aborted is true.
    expect(job!.error).toMatch(/timed out/i);

    delete process.env.RENDER_TIMEOUT_MS;
  });
});

// ---------------------------------------------------------------------------
// Timeout scales with length — the guard must not fire on a merely long render,
// and must still fire promptly on a short one.
// ---------------------------------------------------------------------------

describe("render-queue — timeout scales with duration", () => {
  it("does not abort a 60 s render at the old flat 120 s ceiling", async () => {
    mockRender.mockImplementation(wedgedRender());

    // 1800 frames @30fps = 60 s of video → 60 s startup + 1800 × 200 ms = 420 s.
    const jobId = enqueueRender(makeSpec("long.mp4", 1800));
    await tick();

    vi.advanceTimersByTime(130_000); // well past the ceiling that used to kill it
    await tick();
    await tick();

    expect(getJob(jobId)!.status).toBe("rendering");

    // Let it abort so the limiter slot doesn't leak into the next test.
    vi.advanceTimersByTime(400_000);
    await tick();
    await tick();
  });

  it("keeps a short render on a short leash", async () => {
    mockRender.mockImplementation(wedgedRender());

    // 90 frames = 3 s of video → 60 s + 90 × 200 ms = 78 s, not 420 s.
    const jobId = enqueueRender(makeSpec("short.mp4", 90));
    await tick();

    vi.advanceTimersByTime(77_000);
    await tick();
    expect(getJob(jobId)!.status).toBe("rendering");

    vi.advanceTimersByTime(2_000);
    await tick();
    await tick();

    const job = getJob(jobId);
    expect(job!.status).toBe("error");
    expect(job!.error).toMatch(/timed out/i);
  });

  it("RENDER_TIMEOUT_MS still overrides the scaled budget absolutely", async () => {
    process.env.RENDER_TIMEOUT_MS = "1000";
    mockRender.mockImplementation(wedgedRender());

    // A three-minute timeline would otherwise get ~19 minutes.
    const jobId = enqueueRender(makeSpec("max.mp4", 5400));
    await tick();

    vi.advanceTimersByTime(1_100);
    await tick();
    await tick();

    expect(getJob(jobId)!.status).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// getJob — unknown id returns undefined
// ---------------------------------------------------------------------------

describe("render-queue — getJob", () => {
  it("returns undefined for an unknown jobId", () => {
    expect(getJob("00000000-0000-0000-0000-000000000000")).toBeUndefined();
  });
});
