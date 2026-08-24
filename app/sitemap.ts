import type { MetadataRoute } from "next";
import { GALLERY_ITEMS, galleryItemByHref } from "@/lib/gallery-data";
import { source } from "@/source";

const SITE_URL = "https://snapcn.dev";

/**
 * Every indexable URL, and only real dates.
 *
 * `lastModified` used to be `new Date()` on every entry, which told crawlers the
 * whole site changed on every deploy — a signal that is worse than none, because
 * it is spent on pages that did not change. It is now emitted only where a true
 * date exists: `added` is the day a component shipped, taken from the commit
 * that introduced it. Pages whose change date we do not track omit the field,
 * which the sitemap protocol allows.
 */

/** The newest component date — the real "last changed" for the list pages. */
function latestReleaseDate(): Date | undefined {
  const dates = GALLERY_ITEMS.map((item) => item.added).filter(
    (d): d is string => Boolean(d),
  );
  if (dates.length === 0) return undefined;
  return new Date(`${dates.sort().at(-1)}T00:00:00Z`);
}

export default function sitemap(): MetadataRoute.Sitemap {
  const latest = latestReleaseDate();

  /**
   * The bespoke `(gallery)` routes. None of these has an MDX file, so
   * `source.getPages()` cannot see them and every one of them was missing —
   * including `/docs/video-editor`, a free tool and the highest-intent page on
   * the site.
   */
  // `/docs/templates` and `/docs/marketplace` are deliberately absent: both are
  // `ComingSoonPage`s, thirty words of placeholder each, and a sitemap is a
  // request to index. They stay crawlable from the rail; they are just not
  // something to ask for a ranking on until they exist.
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: latest,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/docs/components`,
      lastModified: latest,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/docs/video-editor`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/docs/showcase`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/docs/changelog`,
      lastModified: latest,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/docs/roadmap`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  // Every MDX page, components included — they have their own routes again, so
  // there is nothing left to filter out.
  const docRoutes: MetadataRoute.Sitemap = source.getPages().map((page) => {
    const added = galleryItemByHref(page.url)?.added;
    return {
      url: `${SITE_URL}${page.url}`,
      ...(added ? { lastModified: new Date(`${added}T00:00:00Z`) } : {}),
      changeFrequency: "monthly" as const,
      // A component page answers a specific query and is the reason someone
      // installs; a category index mostly links to them.
      priority: added ? 0.8 : 0.6,
    };
  });

  return [...staticRoutes, ...docRoutes];
}
