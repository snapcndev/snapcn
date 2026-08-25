import type { Metadata } from "next";
import { Suspense } from "react";
import { getDocBodies } from "@/components/docs/gallery/doc-bodies";
import { GalleryCard } from "@/components/docs/gallery/gallery-card";
import { GalleryExplorer } from "@/components/docs/gallery/gallery-explorer";
import { GalleryFrame } from "@/components/docs/gallery/gallery-frame";
import { GalleryHeaderRow } from "@/components/docs/gallery/gallery-header-row";
import { GALLERY_CATEGORIES, GALLERY_ITEMS } from "@/lib/gallery-data";
import { formatUpdatedAt, getGitHubUpdatedAt } from "@/lib/github";

const SITE_URL = "https://snapcn.dev";
const TITLE = "Components";
const DESCRIPTION = "Every component in snapcn, grouped by category";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/docs/components" },
  openGraph: {
    type: "article",
    url: "/docs/components",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "snapcn",
    images: [{ url: "/og/components", width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og/components"],
  },
};

// The card faces carry no visible text (name/description live in aria-labels),
// so an ItemList keeps every component name + URL machine-readable on this URL,
// alongside the TechArticle + breadcrumb graph the catch-all used to emit.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TechArticle",
      headline: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}/docs/components`,
      image: `${SITE_URL}/og/components`,
      author: {
        "@type": "Person",
        name: "Sri Nath",
        url: "https://x.com/SriNath693",
      },
      publisher: { "@type": "Organization", name: "snapcn", url: SITE_URL },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Docs",
          item: `${SITE_URL}/docs`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: TITLE,
          item: `${SITE_URL}/docs/components`,
        },
      ],
    },
    {
      "@type": "ItemList",
      itemListElement: GALLERY_ITEMS.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        url: `${SITE_URL}${item.href}`,
      })),
    },
  ],
};

export default async function ComponentsGalleryPage() {
  const meta =
    formatUpdatedAt(await getGitHubUpdatedAt()) ??
    "MIT licensed · own your code";

  // Full documentation for every component, rendered on the server and handed to
  // the client overlay — no component has a standalone docs page anymore; the
  // docs are read inline here.
  const docBodies = getDocBodies();

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD built from gallery data
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <GalleryFrame>
        <GalleryHeaderRow meta={meta} />
        <div className="pb-24">
          {/* GalleryExplorer reads the filter/sort/item from the URL via nuqs
              (useSearchParams), which requires a Suspense boundary on this
              statically-rendered page. The fallback is the default "All"
              masonry, so every card anchor is present in the prerendered HTML
              (SEO) and there's no flash before hydration. */}
          <Suspense fallback={<GalleryGridFallback />}>
            <GalleryExplorer docBodies={docBodies} />
          </Suspense>
        </div>
      </GalleryFrame>
    </>
  );
}

/**
 * Server-rendered default view (All) shown while the interactive explorer
 * hydrates. Its pills are static, non-interactive placeholders; the grid is
 * the full component set in curated order so the initial HTML
 * carries all {@link GALLERY_ITEMS.length} card links. Structure mirrors the
 * explorer's sticky toolbar so hydration causes no layout shift.
 */
function GalleryGridFallback() {
  return (
    <div className="not-prose">
      {/* Matches GalleryExplorer's bar exactly — no border-b, or the fallback
          flashes a rule that the real bar does not have. */}
      <div className="sticky top-0 z-30 -mx-6 bg-background/90 px-6 py-3 backdrop-blur lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
            <span className="shrink-0 rounded-full bg-foreground px-3.5 py-1.5 text-sm font-medium text-background">
              All
            </span>
            {GALLERY_CATEGORIES.map((c) => (
              <span
                key={c.id}
                className="shrink-0 rounded-full bg-gallery-card px-3.5 py-1.5 text-sm font-medium text-foreground/70"
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* Keep in step with GalleryExplorer's grid. */}
      <div className="mt-6 grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {GALLERY_ITEMS.map((item) => (
          <GalleryCard key={item.href} item={item} />
        ))}
      </div>
    </div>
  );
}
