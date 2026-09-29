import type { MetadataRoute } from "next";
import { collectionBySlug, collectionItems } from "@/lib/collections";
import {
  CATALOGUE_ITEMS,
  GALLERY_ITEMS,
  galleryItemByHref,
  PRO_GALLERY_ITEMS,
} from "@/lib/gallery-data";
import PAGE_DATES from "@/lib/page-dates.json";
import { blogPosts, source } from "@/source";

const SITE_URL = "https://snapcn.dev";

/**
 * Every indexable URL, and only real dates.
 *
 * `lastModified` used to be `new Date()` on every entry, which told crawlers the
 * whole site changed on every deploy — a signal that is worse than none, because
 * it is spent on pages that did not change. It is now emitted only where a true
 * date exists: `added` is the day a component shipped, taken from the commit
 * that introduced it — and every page's source file is dated by the last commit
 * that touched it (`lib/page-dates.json`, written by `pnpm run sitemap:dates`
 * from git, because the production build has no `.git`). A page is as new as
 * the newest of those that apply to it: a category page changes when a
 * component joins it, not only when its own MDX does.
 */

const day = (d: string) => new Date(`${d}T00:00:00Z`);

/** The newest of the dates given, skipping the missing ones. */
function newest(...dates: (string | undefined)[]): Date | undefined {
  const known = dates.filter((d): d is string => Boolean(d)).sort();
  return known.length > 0 ? day(known[known.length - 1]) : undefined;
}

/** When a source file last changed — see `scripts/page-dates.mts`. */
function fileDate(file: string): string | undefined {
  return (PAGE_DATES as Record<string, string>)[file];
}

/** A collection page lists its components; it is as new as the newest. */
function collectionDate(slug: string | undefined): string | undefined {
  const collection = slug ? collectionBySlug(slug) : undefined;
  return collection ? latestRelease(collectionItems(collection)) : undefined;
}

const gallery = (route: string) =>
  fileDate(`app/docs/(gallery)/${route}/page.tsx`);

/** The newest component date — the real "last changed" for the list pages. */
function latestRelease(items = CATALOGUE_ITEMS): string | undefined {
  return items
    .map((item) => item.added)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);
}

export default function sitemap(): MetadataRoute.Sitemap {
  const latest = latestRelease(GALLERY_ITEMS);
  const posts = blogPosts();

  /**
   * The bespoke `(gallery)` routes. None of these has an MDX file, so
   * `source.getPages()` cannot see them and every one of them was missing —
   * including `/docs/video-editor`, a free tool and the highest-intent page on
   * the site.
   */
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: newest(latest),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/docs/components`,
      lastModified: newest(latestRelease(), gallery("components")),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/docs/video-editor`,
      lastModified: newest(gallery("video-editor")),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/docs/templates`,
      lastModified: newest(gallery("templates")),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/docs/mcp`,
      lastModified: newest(gallery("mcp")),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/docs/remotion-studio`,
      lastModified: newest(gallery("remotion-studio")),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/docs/changelog`,
      lastModified: newest(latestRelease(), gallery("changelog")),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/docs/roadmap`,
      lastModified: newest(gallery("roadmap")),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    // It was missing: indexable, canonical, and the page every Pro link lands on.
    {
      url: `${SITE_URL}/docs/pricing`,
      lastModified: newest(gallery("pricing")),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/blogs`,
      lastModified: posts[0]?.data.date,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  // Posts carry a real `lastModified` because a post has a real date — the one
  // in its frontmatter, which is also what the feed and the schema publish.
  const blogRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}${post.url}`,
    lastModified: post.data.date,
    changeFrequency: "yearly" as const,
    priority: 0.7,
  }));

  // Every MDX page, components included — they have their own routes again, so
  // there is nothing left to filter out.
  const docRoutes: MetadataRoute.Sitemap = source.getPages().map((page) => {
    const added = galleryItemByHref(page.url)?.added;
    const [first, second] = page.slugs;
    // What the page lists, when it is a list: a category index, a collection,
    // or the docs home — each is as new as the newest component on it.
    const listed =
      page.slugs.length === 0
        ? latestRelease()
        : page.slugs.length === 1
          ? latestRelease(CATALOGUE_ITEMS.filter((i) => i.category === first))
          : first === "collections"
            ? collectionDate(second)
            : undefined;
    return {
      url: `${SITE_URL}${page.url}`,
      lastModified: newest(
        added,
        listed,
        fileDate(`content/docs/${page.path}`),
      ),
      changeFrequency: "monthly" as const,
      // A component page answers a specific query and is the reason someone
      // installs; a category index mostly links to them.
      priority: added ? 0.8 : 0.6,
    };
  });

  // The paid components' pages, which have no MDX for `source` to find. Dated
  // the day each one went into the catalogue, same as the changelog.
  const proRoutes: MetadataRoute.Sitemap = PRO_GALLERY_ITEMS.map((item) => ({
    url: `${SITE_URL}${item.href}`,
    ...(item.added
      ? { lastModified: new Date(`${item.added}T00:00:00Z`) }
      : {}),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...docRoutes, ...proRoutes, ...blogRoutes];
}
