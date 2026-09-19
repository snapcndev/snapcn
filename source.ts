import { loader } from "fumadocs-core/source";
import { blog as blogCollection, docs } from "@/.source/server";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});

export const blogSource = loader({
  baseUrl: "/blog",
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
