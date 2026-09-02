/**
 * Unit tests for lib/video-editor/draft.ts
 *
 * Run with:  pnpm vitest run lib/video-editor/__tests__/draft.test.ts
 *
 * The bug this exists for: the watermark badge's only CTA is `signIn`, OAuth is
 * a full-page redirect, and the timeline lived in `useState` and nowhere else —
 * so signing in threw away everything the user had built, at the exact moment
 * they committed to an account.
 *
 * Everything read back is untrusted (user-editable, possibly written by an
 * older build), so most of these are about surviving a bad draft rather than a
 * good one. `localStorage` does not exist in the node test environment; a
 * minimal stand-in is installed on `globalThis.window`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDraft,
  type EditorDraft,
  loadDraft,
  saveDraft,
} from "@/lib/video-editor/draft";
import {
  type Clip,
  MAX_CLIP_FRAMES,
  MAX_CLIPS,
  MAX_TOTAL_FRAMES,
} from "@/lib/video-editor/types";
import { EMPTY_BRAND } from "../brand";

const KEY = "snapcn.editor.draft.v1";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  };
}

let store: ReturnType<typeof fakeStorage>;

/** Predicate passed to loadDraft: every slug is known unless a test says otherwise. */
const anySlug = (_slug: string) => true;

const clip = (over: Partial<Clip> = {}): Clip => ({
  id: "c1",
  slug: "text-reveal",
  props: { text: "hi" },
  durationInFrames: 90,
  background: "#000000",
  ...over,
});

const draft = (over: Partial<EditorDraft> = {}): EditorDraft => ({
  clips: [clip()],
  audio: null,
  font: "Geist",
  brand: EMPTY_BRAND,
  tempo: 1,
  ...over,
});

/** Write a raw object straight into storage, bypassing saveDraft's validation. */
const put = (value: unknown) => store._map.set(KEY, JSON.stringify(value));

beforeEach(() => {
  store = fakeStorage();
  vi.stubGlobal("window", { localStorage: store });
});

describe("draft — the round trip that keeps a sign-in from erasing the work", () => {
  it("restores the clips it saved", () => {
    saveDraft(draft());
    expect(loadDraft(anySlug)?.clips).toEqual([clip()]);
  });

  it("restores the chosen font", () => {
    saveDraft(draft({ font: "Inter" }));
    expect(loadDraft(anySlug)?.font).toBe("Inter");
  });

  it("returns null when nothing was ever saved", () => {
    expect(loadDraft(anySlug)).toBeNull();
  });

  it("an emptied timeline clears the key rather than storing an empty one", () => {
    saveDraft(draft());
    saveDraft(draft({ clips: [], audio: null }));
    expect(store._map.has(KEY)).toBe(false);
    expect(loadDraft(anySlug)).toBeNull();
  });

  it("clearDraft removes it", () => {
    saveDraft(draft());
    clearDraft();
    expect(loadDraft(anySlug)).toBeNull();
  });
});

describe("draft — a hostile or stale draft cannot break the editor", () => {
  it("drops a clip whose component no longer exists", () => {
    // The half-existing clip: a timeline chip renders, the composition does
    // not, and the export silently loses it.
    put({ clips: [clip({ id: "a", slug: "gone" }), clip({ id: "b" })] });
    const out = loadDraft((s) => s !== "gone");
    expect(out?.clips.map((c) => c.id)).toEqual(["b"]);
  });

  it("drops duplicate ids — they break React keys and the budget maths", () => {
    put({ clips: [clip({ id: "dup" }), clip({ id: "dup" })] });
    expect(loadDraft(anySlug)?.clips).toHaveLength(1);
  });

  it("clamps an absurd duration instead of dropping the clip", () => {
    put({ clips: [clip({ durationInFrames: 999_999 })] });
    expect(loadDraft(anySlug)?.clips[0].durationInFrames).toBe(MAX_CLIP_FRAMES);
  });

  it("clamps a zero or negative duration up to one frame", () => {
    put({ clips: [clip({ durationInFrames: 0 })] });
    expect(loadDraft(anySlug)?.clips[0].durationInFrames).toBe(1);
  });

  it("never restores past the clip cap", () => {
    const many = Array.from({ length: MAX_CLIPS + 20 }, (_, i) =>
      clip({ id: `c${i}`, durationInFrames: 1 }),
    );
    put({ clips: many });
    expect(loadDraft(anySlug)?.clips).toHaveLength(MAX_CLIPS);
  });

  it("never restores past the frame budget the server would refuse", () => {
    // Each clip is clamped to MAX_CLIP_FRAMES *before* it is charged to the
    // budget, so the budget only bites once enough clamped clips accumulate:
    // three at the per-clip ceiling fill the three-minute timeline exactly.
    const perClip = MAX_CLIP_FRAMES;
    const fits = Math.floor(MAX_TOTAL_FRAMES / perClip);
    put({
      clips: Array.from({ length: fits + 2 }, (_, i) =>
        clip({ id: `c${i}`, durationInFrames: perClip }),
      ),
    });

    const out = loadDraft(anySlug);
    const total = out!.clips.reduce((n, c) => n + c.durationInFrames, 0);
    expect(out?.clips).toHaveLength(fits);
    expect(total).toBeLessThanOrEqual(MAX_TOTAL_FRAMES);
  });

  it("drops a non-hex background rather than handing it to a style attribute", () => {
    put({
      clips: [clip({ background: "url(javascript:alert(1))" as string })],
    });
    expect(loadDraft(anySlug)?.clips[0].background).toBeUndefined();
  });

  it("replaces non-object props with an empty object", () => {
    put({ clips: [{ ...clip(), props: "not-an-object" }] });
    expect(loadDraft(anySlug)?.clips[0].props).toEqual({});
  });

  it("survives corrupt JSON", () => {
    store._map.set(KEY, "{ not json");
    expect(loadDraft(anySlug)).toBeNull();
  });

  it("survives a draft that is not an object at all", () => {
    put(["nope"]);
    expect(loadDraft(anySlug)).toBeNull();
  });
});

describe("draft — audio is rebuilt from the upload, not from the dead blob URL", () => {
  const out = (d: EditorDraft | null) => d!.audio!;
  const audio = {
    src: "blob:http://localhost/abc-123",
    uploadId: "upload-1",
    name: "track.mp3",
    volume: 0.5,
    trimStart: 2,
    durationSeconds: 120,
  };

  it("points src at the server copy, which outlives the page", () => {
    saveDraft(draft({ audio }));
    const out = loadDraft(anySlug);
    expect(out?.audio?.src).toBe("/api/audio/upload-1");
    expect(out?.audio?.uploadId).toBe("upload-1");
  });

  it("keeps volume and trim", () => {
    saveDraft(draft({ audio }));
    expect(out(loadDraft(anySlug)).volume).toBe(0.5);
    expect(out(loadDraft(anySlug)).trimStart).toBe(2);
  });

  it("drops a track that never reached the server — it could only be silent", () => {
    saveDraft(draft({ audio: { ...audio, uploadId: null } }));
    expect(loadDraft(anySlug)?.audio).toBeNull();
  });

  it("clamps a volume outside 0–1", () => {
    put({ clips: [clip()], audio: { ...audio, volume: 9 } });
    expect(out(loadDraft(anySlug)).volume).toBe(1);
  });
});

describe("draft — storage that throws must not take the editor with it", () => {
  it("save survives a quota error", () => {
    vi.stubGlobal("window", {
      localStorage: {
        ...store,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
    });
    expect(() => saveDraft(draft())).not.toThrow();
  });

  it("load survives storage being unavailable entirely", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("blocked");
      },
    });
    expect(loadDraft(anySlug)).toBeNull();
  });
});
