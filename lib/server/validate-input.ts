import "server-only";
import { normalizeFont } from "@/lib/video-editor/fonts";
import {
  type Clip,
  DEFAULT_BACKGROUND,
  isHexColor,
  MAX_CLIP_FRAMES,
  MAX_CLIPS,
  MAX_TOTAL_FRAMES,
} from "@/lib/video-editor/types";

/**
 * Strict server-side validation of the render payload. Renders cost real CPU on
 * the box, so this is the gate that stops a crafted/oversized request from
 * blowing up Chromium: caps the stargazer count + string sizes, enums the
 * orientation/theme, clamps the numbers, and only lets http(s) avatar URLs
 * through (avatars are fetched by the headless browser → http(s)-only narrows
 * the SSRF surface). Throws a typed 400 error on anything outside the rules.
 */

export type Orientation = "horizontal" | "vertical";
export type Theme = "light" | "dark";

export interface RenderStargazer {
  login: string;
  avatarUrl: string;
  /** ISO date string, e.g. "2021-03-04" */
  starredAt: string;
}

export type RenderInput = {
  repo: string;
  totalStars: number;
  stargazers: RenderStargazer[];
  orientation: Orientation;
  accentColor: string;
  speed: number;
  theme: Theme;
};

/** Thrown on invalid input; carries the HTTP status the API route should map to. */
export class RenderInputError extends Error {
  readonly status = 400 as const;
  constructor(message: string) {
    super(message);
    this.name = "RenderInputError";
  }
}

// --- Limits ----------------------------------------------------------------
const MAX_STARGAZERS = 60; // matches the composition's own downsample cap
const MAX_REPO_LEN = 200;
const MAX_LOGIN_LEN = 100;
const MAX_AVATAR_URL_LEN = 512;
const MAX_STARRED_AT_LEN = 40;
const MAX_TOTAL_STARS = 100_000_000;
const MIN_SPEED = 1;
const MAX_SPEED = 4;

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const HTTP_URL = /^https?:\/\//i;

const DEFAULT_ACCENT = "#ffbb00";
const DEFAULT_SPEED = 1;
const DEFAULT_THEME: Theme = "light";

// --- Field helpers (pure) --------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function requireString(value: unknown, field: string, maxLen: number): string {
  if (typeof value !== "string") {
    throw new RenderInputError(`"${field}" must be a string`);
  }
  if (value.length === 0) {
    throw new RenderInputError(`"${field}" must not be empty`);
  }
  if (value.length > maxLen) {
    throw new RenderInputError(`"${field}" exceeds ${maxLen} characters`);
  }
  return value;
}

function requireFiniteNumber(value: unknown, field: string): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new RenderInputError(`"${field}" must be a finite number`);
  }
  return n;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function parseStargazer(value: unknown, index: number): RenderStargazer {
  if (!isPlainObject(value)) {
    throw new RenderInputError(`stargazers[${index}] must be an object`);
  }
  const login = requireString(
    value.login,
    `stargazers[${index}].login`,
    MAX_LOGIN_LEN,
  );
  const avatarUrl = requireString(
    value.avatarUrl,
    `stargazers[${index}].avatarUrl`,
    MAX_AVATAR_URL_LEN,
  );
  if (!HTTP_URL.test(avatarUrl)) {
    throw new RenderInputError(
      `stargazers[${index}].avatarUrl must be an http(s) URL`,
    );
  }
  const starredAt = requireString(
    value.starredAt,
    `stargazers[${index}].starredAt`,
    MAX_STARRED_AT_LEN,
  );
  return { login, avatarUrl, starredAt };
}

// --- Public entrypoint -----------------------------------------------------

/**
 * Validate + normalize an untrusted request body into render-ready props.
 * Cosmetic fields (accentColor, speed, theme) default when omitted; data fields
 * (repo, totalStars, stargazers, orientation) are required.
 */
export function parseRenderInput(body: unknown): RenderInput {
  if (!isPlainObject(body)) {
    throw new RenderInputError("request body must be a JSON object");
  }

  const repo = requireString(body.repo, "repo", MAX_REPO_LEN);

  const totalStars = Math.floor(
    clamp(
      requireFiniteNumber(body.totalStars, "totalStars"),
      0,
      MAX_TOTAL_STARS,
    ),
  );

  if (!Array.isArray(body.stargazers)) {
    throw new RenderInputError(`"stargazers" must be an array`);
  }
  if (body.stargazers.length > MAX_STARGAZERS) {
    throw new RenderInputError(
      `"stargazers" exceeds the ${MAX_STARGAZERS}-item limit`,
    );
  }
  const stargazers = body.stargazers.map(parseStargazer);

  if (body.orientation !== "horizontal" && body.orientation !== "vertical") {
    throw new RenderInputError(
      `"orientation" must be "horizontal" or "vertical"`,
    );
  }
  const orientation: Orientation = body.orientation;

  let accentColor = DEFAULT_ACCENT;
  if (body.accentColor !== undefined) {
    accentColor = requireString(body.accentColor, "accentColor", 32);
    if (!HEX_COLOR.test(accentColor)) {
      throw new RenderInputError(
        `"accentColor" must be a hex color (e.g. #ffbb00)`,
      );
    }
  }

  let speed = DEFAULT_SPEED;
  if (body.speed !== undefined) {
    speed = clamp(
      requireFiniteNumber(body.speed, "speed"),
      MIN_SPEED,
      MAX_SPEED,
    );
  }

  let theme: Theme = DEFAULT_THEME;
  if (body.theme !== undefined) {
    if (body.theme !== "light" && body.theme !== "dark") {
      throw new RenderInputError(`"theme" must be "light" or "dark"`);
    }
    theme = body.theme;
  }

  return {
    repo,
    totalStars,
    stargazers,
    orientation,
    accentColor,
    speed,
    theme,
  };
}

// --- Video-timeline validation ---------------------------------------------

const MAX_SLUG_LEN = 100;
const MAX_CLIP_ID_LEN = 64;
/** Upload ids are `crypto.randomUUID()`s — accept only that exact shape. */
const AUDIO_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Component ids are kebab-case registry keys — reject anything else so a slug
// can only ever be a plain registry lookup / React key, never a path or script.
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
// Per-clip props budget. Generous enough for one uploaded image as a data URL,
// small enough to stop a request from ballooning the payload / render memory.
const MAX_CLIP_PROPS_BYTES = 4_000_000;

/**
 * Validate an untrusted `{ type: "video-timeline", clips }` body into the clip
 * list the `video-timeline` composition renders. Unknown slugs aren't rejected
 * here (the composition filters them) — this gate caps the clip count, per-clip
 * + total duration, and props size, and enforces the slug shape. Props are
 * passed through as-is (they're only ever React props inside the render).
 */
export function parseVideoTimelineInput(body: unknown): {
  clips: Clip[];
  removeWatermark: boolean;
  font: string;
  audio: { id: string; volume: number; trimStart: number } | null;
} {
  if (!isPlainObject(body)) {
    throw new RenderInputError("request body must be a JSON object");
  }
  if (!Array.isArray(body.clips)) {
    throw new RenderInputError(`"clips" must be an array`);
  }
  if (body.clips.length === 0) {
    throw new RenderInputError("add at least one clip before exporting");
  }
  if (body.clips.length > MAX_CLIPS) {
    throw new RenderInputError(`"clips" exceeds the ${MAX_CLIPS}-item limit`);
  }

  let totalFrames = 0;
  const clips = body.clips.map((raw, index): Clip => {
    if (!isPlainObject(raw)) {
      throw new RenderInputError(`clips[${index}] must be an object`);
    }

    const slug = requireString(raw.slug, `clips[${index}].slug`, MAX_SLUG_LEN);
    if (!SLUG_RE.test(slug)) {
      throw new RenderInputError(
        `clips[${index}].slug is not a valid component id`,
      );
    }

    const durationInFrames = Math.floor(
      clamp(
        requireFiniteNumber(
          raw.durationInFrames,
          `clips[${index}].durationInFrames`,
        ),
        1,
        MAX_CLIP_FRAMES,
      ),
    );
    totalFrames += durationInFrames;

    const props = isPlainObject(raw.props) ? raw.props : {};
    if (JSON.stringify(props).length > MAX_CLIP_PROPS_BYTES) {
      throw new RenderInputError(`clips[${index}].props is too large`);
    }

    const id =
      typeof raw.id === "string" &&
      raw.id.length > 0 &&
      raw.id.length <= MAX_CLIP_ID_LEN
        ? raw.id
        : `clip-${index}`;

    // Rejected rather than defaulted: `background` reaches a `style` attribute
    // inside the render, and a body that carries a colour we do not recognise
    // is a client bug or an attempt — either way, silently swapping in black
    // would hide it. Absent is fine; present-and-wrong is not.
    if (raw.background !== undefined && !isHexColor(raw.background)) {
      throw new RenderInputError(
        `clips[${index}].background must be a hex colour`,
      );
    }
    const background = isHexColor(raw.background)
      ? raw.background
      : DEFAULT_BACKGROUND;

    return { id, slug, props, durationInFrames, background };
  });

  // A *request* to drop the watermark, honoured only if the caller turns out to
  // be signed in — see `/api/render`. Anything other than an explicit `true` is
  // read as "no", so a malformed or missing value keeps the mark.
  const removeWatermark = isPlainObject(body) && body.removeWatermark === true;

  // Allow-list, not a free string: the value reaches both a `font-family` and a
  // fonts.googleapis.com URL inside a server-side render. `normalizeFont`
  // checks it against the 1821 families shipped in `@remotion/google-fonts`
  // plus the built-in stacks, and returns the default for anything else.
  const font = normalizeFont(isPlainObject(body) ? body.font : undefined);

  // An upload id and a volume — never a URL. Whatever lands here becomes the
  // `src` of an <Audio> that our own renderer fetches, so accepting a caller's
  // URL would let anyone aim that request at any host they liked. The render
  // route turns this id into a URL on its own origin.
  const rawAudio = isPlainObject(body) ? body.audio : undefined;
  const audio =
    isPlainObject(rawAudio) &&
    typeof rawAudio.id === "string" &&
    AUDIO_ID_RE.test(rawAudio.id)
      ? {
          id: rawAudio.id,
          volume:
            typeof rawAudio.volume === "number" &&
            Number.isFinite(rawAudio.volume)
              ? Math.min(1, Math.max(0, rawAudio.volume))
              : 1,
          // Clamped and finite: this becomes a frame offset, and a NaN or a
          // negative there is a render that never produces a frame.
          trimStart:
            typeof rawAudio.trimStart === "number" &&
            Number.isFinite(rawAudio.trimStart)
              ? Math.max(0, Math.min(rawAudio.trimStart, 3600))
              : 0,
        }
      : null;

  if (totalFrames > MAX_TOTAL_FRAMES) {
    throw new RenderInputError("timeline exceeds the maximum total duration");
  }

  return { clips, removeWatermark, font, audio };
}
