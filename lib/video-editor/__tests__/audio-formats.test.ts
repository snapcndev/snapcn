/**
 * Unit tests for the audio format table in lib/video-editor/types.ts
 *
 * Run with:  pnpm vitest run lib/video-editor/__tests__/audio-formats.test.ts
 *
 * These were three hand-maintained maps — accept list, extension map, serve
 * map — and they had already drifted: `audio/x-wav` was in the extension map
 * and missing from the accept list, so an upload the map said should pass was
 * rejected. A missing serve entry is worse and quieter: the file goes out as
 * `application/octet-stream`, the renderer declines to decode it, and the
 * export comes out silent with no error anywhere.
 */

import { describe, expect, it } from "vitest";
import {
  AUDIO_EXT_FOR,
  AUDIO_EXTS,
  AUDIO_MIME,
  AUDIO_TYPE_FOR,
} from "@/lib/video-editor/types";

describe("audio formats — the views cannot disagree", () => {
  it("every accepted MIME maps to an extension we can store", () => {
    for (const mime of AUDIO_MIME) {
      expect(AUDIO_EXTS).toContain(AUDIO_EXT_FOR[mime]);
    }
  });

  it("every storable extension has a Content-Type to serve it back with", () => {
    // The silent failure: no entry here means octet-stream, which a renderer
    // will not decode and will not complain about.
    for (const ext of AUDIO_EXTS) {
      expect(AUDIO_TYPE_FOR[ext]).toMatch(/^audio\//);
    }
  });

  it("every extension is reachable from at least one accepted MIME", () => {
    const reachable = new Set(Object.values(AUDIO_EXT_FOR));
    for (const ext of AUDIO_EXTS) expect(reachable).toContain(ext);
  });

  it("keeps the wav alias that the old split maps dropped", () => {
    expect(AUDIO_EXT_FOR["audio/x-wav"]).toBe("wav");
    expect(AUDIO_MIME).toContain("audio/x-wav");
  });

  it("no extension can escape a path — they are bare word characters", () => {
    // The serve route builds `<uuid>.<ext>` from this list, not from the URL.
    for (const ext of AUDIO_EXTS) expect(ext).toMatch(/^[a-z0-9]+$/);
  });
});
