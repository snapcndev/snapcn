import manifest from "./pro-demo-manifest.json";

/**
 * Where the pro demos are served from.
 *
 * Not `public/demos` like the free ones, and that is forced: `registry/snap-cn-pro`
 * is gitignored, so a public checkout cannot carry its demos and a build cannot
 * emit them. They are rendered by `scripts/pro-demos.mts`, uploaded to R2 by
 * `scripts/pro-upload.mts`, and played from that origin — the video is the
 * advertisement, exactly like the title and description `PRO_ITEMS` already
 * publishes, and none of it is the source.
 *
 * Unset means there is no CDN yet, and the gallery then lists no pro cards at
 * all (see `PRO_GALLERY_ITEMS`) rather than fourteen grey boxes. Set it to the
 * bucket's public origin — no trailing slash.
 */
export const PRO_DEMO_BASE = (
  process.env.NEXT_PUBLIC_PRO_DEMO_BASE ?? ""
).replace(/\/$/, "");

/** Byte hash of each demo, for `?v=` — same contract as `lib/demo-manifest.json`. */
const version = (slug: string): string | undefined =>
  (manifest as Record<string, string>)[slug];

/**
 * The mp4 for a pro slug, or null when there is no CDN configured or no file.
 *
 * The `?v=` is the file's own hash: every demo ships to the same key forever, so
 * without it a browser keeps replaying the copy it already has long after the
 * file underneath was re-rendered. <video> caches hardest of all.
 */
export function proDemoSrc(slug: string): string | null {
  const v = version(slug);
  if (!PRO_DEMO_BASE || !v) return null;
  return `${PRO_DEMO_BASE}/${slug}.mp4?v=${v}`;
}
