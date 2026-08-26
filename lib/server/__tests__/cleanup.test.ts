/**
 * Unit tests for lib/server/cleanup.ts
 *
 * Run with:  pnpm vitest run lib/server/__tests__/cleanup.test.ts
 *
 * node:fs/promises is mocked so no real files are read or removed, and
 * `lib/server/paths.ts` is mocked outright: it resolves both dirs into consts at
 * module load, so setting RENDER_WORK_DIR/AUDIO_WORK_DIR from a test body — which
 * runs *after* the imports are evaluated — has no effect on it.
 *
 * --- Seam note ---
 * `sweepOnce` is exported for test (same convention as `buildSpec` in
 * app/api/render/route.ts). Reaching it through `ensureCleanupSweep` instead
 * would mean a `setInterval` guarded by a module-level boolean that only the
 * first test in the process could install.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/paths", () => ({
  RENDER_WORK_DIR: "/work/renders",
  AUDIO_WORK_DIR: "/work/audio",
}));

const readdir = vi.fn();
const stat = vi.fn();
const rm = vi.fn().mockResolvedValue(undefined);

vi.mock("node:fs/promises", () => ({
  readdir: (...a: unknown[]) => readdir(...a),
  stat: (...a: unknown[]) => stat(...a),
  rm: (...a: unknown[]) => rm(...a),
}));

const deleteJob = vi.fn();
vi.mock("@/lib/server/render-queue", () => ({
  deleteJob: (id: string) => deleteJob(id),
}));

// What a saved project still points at. Mocked because the real one reaches
// Postgres, and the behaviour under test is what the sweep does with the
// answer — including what it does when there isn't one.
const referencedAudioIds = vi.fn(async () => new Set<string>());
vi.mock("@/lib/server/audio-refs", () => ({
  referencedAudioIds: () => referencedAudioIds(),
}));

import { sweepOnce } from "@/lib/server/cleanup";

const NOW = 1_800_000_000_000;

/** Files in each dir, by the path the sweep will readdir. */
function withFiles(
  byDir: Record<string, string[]>,
  ageMs: Record<string, number>,
) {
  readdir.mockImplementation(async (dir: string) => byDir[dir] ?? []);
  stat.mockImplementation(async (filePath: string) => {
    const name = filePath.split("/").pop() as string;
    return { mtimeMs: NOW - (ageMs[name] ?? 0) };
  });
}

const removed = () => rm.mock.calls.map((c) => c[0] as string);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  readdir.mockReset();
  stat.mockReset();
  rm.mockClear();
  deleteJob.mockReset();
  referencedAudioIds.mockReset();
  referencedAudioIds.mockResolvedValue(new Set<string>());
  delete process.env.RENDER_FILE_TTL_MS;
  delete process.env.AUDIO_FILE_TTL_MS;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cleanup — the audio dir is swept at all", () => {
  it("reclaims an expired soundtrack, not just expired MP4s", async () => {
    const SEVEN_HOURS = 7 * 60 * 60_000;
    withFiles(
      { "/work/renders": ["a.mp4"], "/work/audio": ["old.mp3"] },
      { "a.mp4": SEVEN_HOURS, "old.mp3": SEVEN_HOURS },
    );

    await sweepOnce();

    expect(removed()).toContain("/work/audio/old.mp3");
    expect(removed()).toContain("/work/renders/a.mp4");
  });

  it("sweeps every extension an upload can land as", async () => {
    const OLD = 7 * 60 * 60_000;
    const names = ["a.mp3", "b.wav", "c.aac", "d.ogg", "e.webm", "f.m4a"];
    withFiles(
      { "/work/audio": names },
      Object.fromEntries(names.map((n) => [n, OLD])),
    );

    await sweepOnce();

    expect(removed().sort()).toEqual(
      names.map((n) => `/work/audio/${n}`).sort(),
    );
  });

  it("gives audio a longer life than a render — the editing session outlives the export", async () => {
    // 30 minutes: past the 10-minute render TTL, far inside the 6-hour audio one.
    const THIRTY_MIN = 30 * 60_000;
    withFiles(
      { "/work/renders": ["done.mp4"], "/work/audio": ["track.mp3"] },
      { "done.mp4": THIRTY_MIN, "track.mp3": THIRTY_MIN },
    );

    await sweepOnce();

    expect(removed()).toEqual(["/work/renders/done.mp4"]);
  });

  it("drops the job from the registry for a render, and has no registry to touch for audio", async () => {
    const OLD = 7 * 60 * 60_000;
    withFiles(
      { "/work/renders": ["job-1.mp4"], "/work/audio": ["t.mp3"] },
      { "job-1.mp4": OLD, "t.mp3": OLD },
    );

    await sweepOnce();

    expect(deleteJob).toHaveBeenCalledTimes(1);
    expect(deleteJob).toHaveBeenCalledWith("job-1");
  });

  it("leaves a foreign file in the audio dir alone", async () => {
    withFiles(
      { "/work/audio": ["notes.txt", "track.mp3"] },
      { "notes.txt": 7 * 60 * 60_000, "track.mp3": 7 * 60 * 60_000 },
    );

    await sweepOnce();

    expect(removed()).toEqual(["/work/audio/track.mp3"]);
  });

  it("survives a dir that does not exist yet", async () => {
    readdir.mockImplementation(async (dir: string) => {
      if (dir === "/work/audio") throw new Error("ENOENT");
      return ["a.mp4"];
    });
    stat.mockResolvedValue({ mtimeMs: NOW - 7 * 60 * 60_000 });

    await expect(sweepOnce()).resolves.toBeUndefined();
    expect(removed()).toEqual(["/work/renders/a.mp4"]);
  });
});

describe("cleanup — an upload a project still points at is not scratch", () => {
  const OLD = 12 * 60 * 60_000;

  it("keeps a referenced soundtrack however old it is", async () => {
    // The bug this is here for: a project is a Postgres row with no expiry and
    // the file it names had a six-hour TTL, so every saved project with audio
    // was guaranteed to lose it. The clock is not the thing that decides any
    // more — ownership is.
    referencedAudioIds.mockResolvedValue(new Set(["kept"]));
    withFiles(
      { "/work/audio": ["kept.mp3", "orphan.mp3"] },
      { "kept.mp3": OLD, "orphan.mp3": OLD },
    );

    await sweepOnce();

    expect(removed()).not.toContain("/work/audio/kept.mp3");
    expect(removed()).toContain("/work/audio/orphan.mp3");
  });

  it("still reclaims an orphan that never reached a project", async () => {
    // `/api/audio` needs no account, so uploads nobody ever used cannot sit on
    // the disk forever. The TTL is right; it was only ever applied too widely.
    referencedAudioIds.mockResolvedValue(new Set());
    withFiles({ "/work/audio": ["nobody.mp3"] }, { "nobody.mp3": OLD });

    await sweepOnce();

    expect(removed()).toContain("/work/audio/nobody.mp3");
  });

  it("skips the audio sweep entirely when it cannot tell what is referenced", async () => {
    // The two failure costs are not symmetrical. Skipping leaks disk until the
    // next pass; deleting anyway destroys a soundtrack nobody can get back. So
    // a database that is down must never be read as "nothing is referenced".
    referencedAudioIds.mockRejectedValue(new Error("db down"));
    withFiles(
      { "/work/renders": ["a.mp4"], "/work/audio": ["old.mp3"] },
      { "a.mp4": OLD, "old.mp3": OLD },
    );

    await sweepOnce();

    expect(removed()).not.toContain("/work/audio/old.mp3");
    // …and the renders dir, which does not depend on the answer, is untouched
    // by that decision.
    expect(removed()).toContain("/work/renders/a.mp4");
  });
});
