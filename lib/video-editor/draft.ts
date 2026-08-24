import {
  type AudioTrack,
  type Clip,
  isHexColor,
  MAX_CLIP_FRAMES,
  MAX_CLIPS,
  MAX_TOTAL_FRAMES,
} from "./types";

/**
 * The editor's work, kept across a page load.
 *
 * This exists because of one flow: the watermark badge's only call to action is
 * `signIn`, OAuth is a full-page redirect, and the timeline lived in `useState`
 * and nowhere else. Signing in — the exact moment someone commits to an account
 * — threw away everything they had built. It also covers the ordinary
 * accidents: a reload, a crashed tab, a closed laptop.
 *
 * It is *not* the storage feature. A draft is this browser's copy of unsaved
 * work; when projects live in Postgres this is what gets migrated into the row
 * on sign-in, which is the only reason that migration has anything to migrate.
 *
 * `removeWatermark` is deliberately not in here. The editor defaults it to
 * false even for a signed-in user because the mark comes off on purpose or not
 * at all, and a value restored from disk is not a purpose.
 */
export interface EditorDraft {
  clips: Clip[];
  audio: AudioTrack | null;
  font: string | null;
}

/** Version is in the key: a schema change orphans old drafts instead of tripping over them. */
const KEY = "snapcn.editor.draft.v1";

/** Reads and writes are wrapped: Safari private mode throws on both. */
function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Persist the draft, or clear it when there is nothing to keep.
 *
 * Writing an empty timeline as `{clips: []}` would mean "restore nothing" and
 * "never saved" are stored differently for no gain — and it would resurrect
 * clips the user had just deleted if the key were left behind.
 */
export function saveDraft(draft: EditorDraft): void {
  const store = storage();
  if (!store) return;
  try {
    if (draft.clips.length === 0 && !draft.audio) {
      store.removeItem(KEY);
      return;
    }
    store.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Over quota (a timeline carrying data-URL images will do it), or storage
    // disabled. Losing the draft is bad; taking the editor down with it is
    // worse, and the in-memory state the user is looking at is untouched.
  }
}

export function clearDraft(): void {
  storage()?.removeItem(KEY);
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

/**
 * Restore a draft, or null if there is nothing usable.
 *
 * Everything here is untrusted: it is user-editable, and it may have been
 * written by an older build. The dangerous case is a clip whose component no
 * longer exists — the timeline chip would render and the composition would not,
 * so the clip half-exists and the export silently loses it. `isKnownSlug` is a
 * parameter rather than a `registry` import so this module stays testable
 * without pulling every scene component into the test run.
 */
export function loadDraft(
  isKnownSlug: (slug: string) => boolean,
): EditorDraft | null {
  const store = storage();
  if (!store) return null;

  let raw: unknown;
  try {
    const text = store.getItem(KEY);
    if (!text) return null;
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  return reviveDraft(raw, isKnownSlug);
}

/**
 * Revive an already-parsed timeline. Shared with saved projects, which store
 * the same shape in Postgres and arrive equally untrusted — a row written by an
 * older build carries the same stale-slug problem as an old `localStorage` key,
 * and must degrade the same way.
 */
export function reviveDraft(
  raw: unknown,
  isKnownSlug: (slug: string) => boolean,
): EditorDraft | null {
  if (!isObject(raw)) return null;

  const clips = reviveClips(raw.clips, isKnownSlug);
  const audio = reviveAudio(raw.audio);
  if (clips.length === 0 && !audio) return null;

  return {
    clips,
    audio,
    font: typeof raw.font === "string" && raw.font ? raw.font : null,
  };
}

function reviveClips(
  raw: unknown,
  isKnownSlug: (slug: string) => boolean,
): Clip[] {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const clips: Clip[] = [];
  let frames = 0;

  for (const entry of raw) {
    if (clips.length >= MAX_CLIPS) break;
    if (!isObject(entry)) continue;

    const { id, slug, props, background } = entry;
    if (typeof id !== "string" || !id || seen.has(id)) continue;
    if (typeof slug !== "string" || !isKnownSlug(slug)) continue;

    // Clamped, not rejected: a bad length is recoverable, and dropping a clip
    // the user can see on their timeline is not.
    const duration = Math.min(
      MAX_CLIP_FRAMES,
      Math.max(1, Math.round(num(entry.durationInFrames, 1))),
    );
    // Stop at the frame budget rather than restoring a timeline the server
    // would refuse to render.
    if (frames + duration > MAX_TOTAL_FRAMES) break;

    seen.add(id);
    frames += duration;
    clips.push({
      id,
      slug,
      props: isObject(props) ? props : {},
      durationInFrames: duration,
      ...(isHexColor(background) ? { background } : {}),
    });
  }

  return clips;
}

/**
 * `src` is an object URL, which is dead the moment the page unloads — so it is
 * rebuilt from the upload instead of restored. A track with no `uploadId` never
 * reached the server and cannot be rebuilt at all; restoring a silent, unusable
 * row is worse than restoring nothing.
 */
function reviveAudio(raw: unknown): AudioTrack | null {
  if (!isObject(raw)) return null;
  const { uploadId, name } = raw;
  if (typeof uploadId !== "string" || !uploadId) return null;

  return {
    src: `/api/audio/${encodeURIComponent(uploadId)}`,
    uploadId,
    name: typeof name === "string" && name ? name : "soundtrack",
    volume: Math.min(1, Math.max(0, num(raw.volume, 1))),
    trimStart: Math.max(0, num(raw.trimStart, 0)),
    durationSeconds: Math.max(0, num(raw.durationSeconds, 0)),
  };
}
