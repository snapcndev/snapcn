/**
 * Where a video we host is played from — the share-link page (`/v/[id]`) plays
 * it. The route keeps its old `/api/showcase/` path so links already shared
 * keep working; the showcase itself is gone.
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
