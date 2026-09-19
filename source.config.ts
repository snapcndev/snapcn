import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { z } from "zod";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

/**
 * The blog, as a second collection rather than a folder under `content/docs`.
 *
 * Both are MDX and both render through the same `getMDXComponents()`, so the
 * split is not technical — it is that a docs page and a post are different
 * things to a crawler and to a reader. A post is dated, ordered by that date,
 * carries `BlogPosting` rather than breadcrumbs, and must never appear in the
 * docs sidebar tree. Sharing `content/docs` would have put every post in
 * `source.getPages()`, which is what builds the sidebar AND the docs half of
 * the sitemap.
 *
 * `defineDocs` rather than `defineCollections` only because `loader()` wants a
 * `toFumadocsSource()`; the meta collection it also creates stays empty, since
 * a flat dated list needs no `meta.json` ordering.
 */
export const blog = defineDocs({
  dir: "content/blog",
  docs: {
    // `date` is required and not optional-with-a-default: a post whose date is
    // the build date sorts to the top of the index forever and dates itself
    // wrongly in the feed. Better to fail the build than to publish that.
    schema: pageSchema.extend({
      date: z.coerce.date(),
      /** Overrides the `<title>` where the H1 is written for the reader. */
      seoTitle: z.string().optional(),
      tags: z.array(z.string()).default([]),
    }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {},
});
