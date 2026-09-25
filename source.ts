import { loader } from "fumadocs-core/source";
import { blog as blogCollection, docs } from "@/.source/server";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});

// Posts live at the root (`/<slug>`), the index at `/blogs`. A post's slug
// must not match a static top-level route (`pro`, `docs`, `account`…): the
// static route wins and the post becomes unreachable.
export const blogSource = loader({
  baseUrl: "/",
  source: blogCollection.toFumadocsSource(),
});

export type BlogPost = ReturnType<typeof blogSource.getPages>[number];

/**
 * Posts newest first — the only order a blog index is ever read in.
 *
 * Centralised because three callers need the same order (the index, the feed
 * and the sitemap) and a feed that disagrees with the page it mirrors is the
 * kind of bug nobody reports.
 */
export function blogPosts(): BlogPost[] {
  return blogSource
    .getPages()
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}
