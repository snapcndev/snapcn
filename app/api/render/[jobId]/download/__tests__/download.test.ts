/**
 * Unit tests for app/api/render/[jobId]/download/route.ts
 *
 * Run with:  pnpm vitest run "app/api/render/[jobId]/download/__tests__"
 *
 * The point of this file is one bug: the route used to schedule the MP4's
 * deletion on the read stream's `close` event, which Node emits on *any*
 * teardown — a completed read and an aborted one alike. A user whose download
 * dropped halfway lost the file, and the retry 404'd.
 *
 * `node:fs` is mocked so the "stream" is an EventEmitter we drive by hand: emit
 * `end` then `close` for a completed read, `close` alone for an abort.
 */

import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/paths", () => ({
  RENDER_WORK_DIR: "/work/renders",
  AUDIO_WORK_DIR: "/work/audio",
}));

const deleteJobFile = vi.fn();
vi.mock("@/lib/server/cleanup", () => ({
  deleteJobFile: (id: string) => deleteJobFile(id),
  ensureCleanupSweep: vi.fn(),
}));

const getJob = vi.fn();
vi.mock("@/lib/server/render-queue", () => ({
  getJob: (id: string) => getJob(id),
}));

/** The fake read stream the route attaches its listener to. */
let stream: EventEmitter;
vi.mock("node:fs", () => ({
  createReadStream: () => stream,
}));

vi.mock("node:fs/promises", () => ({
  stat: vi.fn().mockResolvedValue({ size: 1234 }),
}));

// `Readable.toWeb` is handed our EventEmitter, which is not a real Readable.
vi.spyOn(Readable, "toWeb").mockReturnValue(new ReadableStream() as never);

import { GET } from "@/app/api/render/[jobId]/download/route";

const JOB_ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

const call = (jobId = JOB_ID) =>
  GET(new Request("http://localhost/x"), {
    params: Promise.resolve({ jobId }),
  });

beforeEach(() => {
  stream = new EventEmitter();
  deleteJobFile.mockReset();
  getJob.mockReset();
  getJob.mockReturnValue({ status: "done", fileName: "snapcn-video.mp4" });
});

describe("download — the file survives an aborted transfer", () => {
  it("does NOT delete the MP4 when the stream is torn down without finishing", async () => {
    await call();

    // What an abort looks like: the consumer cancels, the stream is destroyed,
    // `close` fires and `end` never does.
    stream.emit("close");

    expect(deleteJobFile).not.toHaveBeenCalled();
  });

  it("deletes the MP4 once the read actually completes", async () => {
    await call();

    stream.emit("end");
    stream.emit("close"); // always follows `end` — must not double-delete

    expect(deleteJobFile).toHaveBeenCalledTimes(1);
    expect(deleteJobFile).toHaveBeenCalledWith(JOB_ID);
  });

  it("still 404s an id that is not a UUID, before any lookup", async () => {
    const res = await call("../../etc/passwd");
    expect(res.status).toBe(404);
    expect(getJob).not.toHaveBeenCalled();
  });

  it("410s a job that has not finished rendering", async () => {
    getJob.mockReturnValue({ status: "rendering", fileName: "x.mp4" });
    expect((await call()).status).toBe(410);
  });
});
