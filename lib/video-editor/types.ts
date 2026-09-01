/**
 * Shared, dependency-free types for the video editor — imported by both the
 * client editor UI and the server render validator/pipeline.
 */

/** One clip on the timeline: a registry component + its edited props + length. */
export interface Clip {
  /** Stable id for React keys / reorder. */
  id: string;
  /** Registry slug (key of `registry/__index__.tsx`). */
  slug: string;
  /** Props spread onto the component (seeded from `getDefaults`, then edited). */
  props: Record<string, unknown>;
  /** Frames this clip occupies on the timeline. */
  durationInFrames: number;
  /**
   * Canvas colour behind this clip, as a hex string.
   *
   * Lives on the *clip* rather than on the component, because almost every
   * scene in the registry paints its own foreground onto whatever is behind it
   * and only four of them take a background prop at all. Adding one to the
   * other eighteen would be eighteen breaking changes to shipped components to
   * answer a question the timeline can answer once.
   *
   * Seeded from the component's `previewBackdrop` — the backdrop its author
   * already chose for the docs preview — so a clip looks the way it does in the
   * gallery the moment it is added, and is one colour picker away from not.
   */
  background?: string;
  /**
   * This clip's typeface, overriding the video's.
   *
   * Optional and usually absent: one face for a whole video is the normal case,
   * and writing an explicit value onto every clip would make "the video's font"
   * a control that silently stopped applying. A built-in id or a Google family,
   * validated exactly the way the video font is — see `lib/video-editor/fonts`.
   */
  font?: string;
}

/**
 * A soundtrack laid under the whole timeline.
 *
 * One track, not a per-clip field: music runs *under* a cut, not inside it, and
 * modelling it on the clip would mean restarting the file every time a scene
 * changes. `src` is whatever the browser can play — an object URL while the
 * file is only in the editor, an https URL once it has been uploaded.
 */
export interface AudioTrack {
  /** Playable in *this* browser — an object URL. */
  src: string;
  /**
   * Server-side upload id, once the file has been parked for the renderer.
   *
   * Null while the upload is in flight or has failed, which is exactly when the
   * export has to say the soundtrack will be missing.
   */
  uploadId: string | null;
  /** Shown in the UI; the URL is opaque. */
  name: string;
  /** 0–1. Applied by the renderer, not baked into the file. */
  volume: number;
  /**
   * Seconds to skip at the head of the file — where the soundtrack starts.
   *
   * The *end* is not a separate field: the video's own length decides it, so
   * storing one would be a second source of truth that can disagree with the
   * timeline. Cropping here means choosing which window of the track plays.
   */
  trimStart: number;
  /** Length of the source file, once its metadata has loaded. 0 until then. */
  durationSeconds: number;
}

export const DEFAULT_AUDIO_VOLUME = 0.8;

/** Largest audio file the editor will take. */
export const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

/**
 * Every audio format the editor takes, keyed by the extension it is stored
 * under. One table, because the four things below are four views of it and as
 * separate lists they drift: `audio/x-wav` was once in the extension map and
 * missing from the accept list, so an upload the map said should pass was
 * rejected — and an extension missing from the serve map goes out as
 * `application/octet-stream`, which a renderer will not decode and will not
 * complain about.
 *
 * `serveAs` is the type the file is served back with; `accept` is every MIME a
 * browser might label that format with on the way in.
 */
const AUDIO_FORMATS = {
  mp3: { serveAs: "audio/mpeg", accept: ["audio/mpeg", "audio/mp3"] },
  wav: { serveAs: "audio/wav", accept: ["audio/wav", "audio/x-wav"] },
  aac: { serveAs: "audio/aac", accept: ["audio/aac"] },
  ogg: { serveAs: "audio/ogg", accept: ["audio/ogg"] },
  webm: { serveAs: "audio/webm", accept: ["audio/webm"] },
  m4a: { serveAs: "audio/mp4", accept: ["audio/mp4"] },
} as const satisfies Record<string, { serveAs: string; accept: string[] }>;

/** Every extension an upload can land as — what the disk sweep prunes. */
export const AUDIO_EXTS = Object.keys(AUDIO_FORMATS);

/**
 * Accepted upload type → the extension it is stored under.
 *
 * Never the uploaded filename: that is attacker-controlled, and a file is
 * written as `<uuid>.<ext>` with the extension looked up here, so there is no
 * name a caller can send that escapes the directory.
 */
export const AUDIO_EXT_FOR: Record<string, string> = Object.fromEntries(
  Object.entries(AUDIO_FORMATS).flatMap(([ext, f]) =>
    f.accept.map((mime) => [mime, ext]),
  ),
);

/** What an `<input accept>` and the upload route will take. */
export const AUDIO_MIME = Object.keys(AUDIO_EXT_FOR);

/** Stored extension → the Content-Type it is served back with. */
export const AUDIO_TYPE_FOR: Record<string, string> = Object.fromEntries(
  Object.entries(AUDIO_FORMATS).map(([ext, f]) => [ext, f.serveAs]),
);

/** Canvas colour when a clip has none, and for the empty stage. */
export const DEFAULT_BACKGROUND = "#000000";

/**
 * `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` — nothing else.
 *
 * Shared by the editor and the render validator on purpose: `background` is the
 * one clip field that reaches a `style` attribute inside a server-side render,
 * and the render accepts a body from any client. Restricting it to a literal
 * hex value at the boundary means there is no string a caller can send that is
 * anything other than a colour.
 */
const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

/** Timeline canvas — every clip renders at this size/rate (shared W/H/FPS). */
export const CANVAS = { width: 1280, height: 720, fps: 30 } as const;

/**
 * How many clips a timeline may hold.
 *
 * This is a payload and DOM guard, not a cost guard — a render costs frames,
 * and `MAX_TOTAL_FRAMES` is what bounds those. It was 12, which made *it* the
 * limit everybody actually hit: twelve three-second clips is 38 seconds, and
 * the editor refused a thirteenth while 142 seconds of the frame budget sat
 * unspent. Short clips were being punished for being short.
 *
 * 60 is high enough that for anything three seconds or longer the duration cap
 * binds first, which is the one that reflects real render cost.
 */
export const MAX_CLIPS = 60;

/** Longest a single clip may run. */
export const MAX_CLIP_FRAMES = 1800; // 60s @30fps

/** Longest the whole timeline may run — the cap that reflects render cost. */
export const MAX_TOTAL_FRAMES = 5400; // 3min @30fps

/**
 * Raw sum of clip lengths — what the frame budget is spent from.
 *
 * Kept separate from `totalDuration` because that floors at 1 for a Player's
 * sake, and an empty timeline must read as 0 frames spent, not 1.
 */
function sumFrames(clips: Clip[]): number {
  return clips.reduce(
    (acc, c) => acc + Math.max(1, Math.round(c.durationInFrames || 0)),
    0,
  );
}

/** Sum of clip lengths, floored at 1 (a Player/Composition needs ≥1 frame). */
export function totalDuration(clips: Clip[]): number {
  return Math.max(1, sumFrames(clips));
}

/**
 * Frames left in the budget. Never negative.
 *
 * The editor and `parseVideoTimelineInput` have to agree on this: the server
 * rejects a timeline over `MAX_TOTAL_FRAMES`, and until the editor enforced the
 * same number you could build a five-minute video and only discover it was
 * unexportable after waiting on the export.
 */
export function remainingFrames(clips: Clip[]): number {
  return Math.max(0, MAX_TOTAL_FRAMES - sumFrames(clips));
}

/**
 * The longest `clipId` may become: whatever the budget has left once every
 * *other* clip is paid for, capped by the per-clip ceiling. Floored at 1 so a
 * full timeline still yields a legal duration rather than zero.
 */
export function maxFramesForClip(clips: Clip[], clipId: string): number {
  const others = sumFrames(clips.filter((c) => c.id !== clipId));
  return Math.max(1, Math.min(MAX_CLIP_FRAMES, MAX_TOTAL_FRAMES - others));
}
