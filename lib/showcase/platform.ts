/**
 * Shared (client- and server-safe) helpers for classifying a submitted post
 * URL — by social platform, and by whether we host the video ourselves. Kept
 * free of any server-only imports so the cards, the submit form and the server
 * query layer can all use it.
 */

/** Public path a video we host is played from. */
export const showcaseVideoUrl = (jobId: string) =>
  `/api/showcase/video/${jobId}`;

/**
 * True for a submission whose video lives on our origin rather than someone
 * else's post.
 *
 * The distinction is carried by `post_url` itself rather than a column: a
 * hosted entry stores its own relative path there, which keeps the NOT NULL
 * constraint satisfied and cost the feature no migration.
 */
export const isHostedVideo = (postUrl: string) =>
  postUrl.startsWith("/api/showcase/video/");

export const PLATFORMS = [
  "x",
  "facebook",
  "linkedin",
  "youtube",
  "instagram",
  "tiktok",
  "other",
] as const;

export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  x: "X",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  other: "Link",
};

/** Best-effort platform detection from a post URL's hostname. */
export function detectPlatform(url: string): Platform {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "other";
  }
  if (
    host === "x.com" ||
    host.endsWith(".x.com") ||
    host.endsWith("twitter.com")
  )
    return "x";
  if (
    host.endsWith("facebook.com") ||
    host === "fb.com" ||
    host.endsWith("fb.watch")
  )
    return "facebook";
  if (host.endsWith("linkedin.com")) return "linkedin";
  if (host.endsWith("youtube.com") || host === "youtu.be") return "youtube";
  if (host.endsWith("instagram.com")) return "instagram";
  if (host.endsWith("tiktok.com")) return "tiktok";
  return "other";
}
