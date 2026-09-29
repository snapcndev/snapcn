import { Suspense } from "react";
import { preload } from "react-dom";
import { ProBanner } from "@/components/pro-banner";
import { PRO_ITEMS } from "@/config/catalogue";
import { renderedDemoPoster } from "@/lib/demo-urls";
import {
  CATALOGUE_ITEMS,
  FIRST_ROW,
  GALLERY_CATEGORIES,
  ITEM_BY_SLUG,
} from "@/lib/gallery-data";
import { formatUpdatedAt, getGitHubUpdatedAt } from "@/lib/github";
import { proDemoPoster } from "@/lib/pro-demos";
import { docBodyFor, slugsWithDocs } from "./doc-bodies";
import { GalleryCard } from "./gallery-card";
import { OpenPanel } from "./gallery-detail-overlay";
import { GalleryExplorer } from "./gallery-explorer";
import { GalleryHeaderRow } from "./gallery-header-row";

/**
 * The Components gallery: header, Pro banner, filter pills, grid and the detail
 * panel. `/docs/components` renders it, and so does every component's own URL
 * (`/docs/<category>/<slug>`) with `open` set — a component is only ever shown
 * one way, as the panel over the grid. Those URLs are what search indexes
 * and what the address bar shows; see `app/docs/(docs)/[[...slug]]/page.tsx`.
 *
 * With `open`, the panel is in the server HTML — documentation included — and
 * not merely opened by the browser afterwards: the page for a query like
 * "remotion text highlight" has to contain the text that answers it.
 */
export async function ComponentsGallery({ open }: { open?: string }) {
  const meta =
    formatUpdatedAt(await getGitHubUpdatedAt()) ??
    "MIT licensed · own your code";

  // Which components have docs, not the docs themselves. The overlay fetches
  // the one it opens (see components/docs/gallery/doc-bodies.tsx) — handing it
  // all 23 rendered bodies was 800KB of this page's payload.
  const docSlugs = slugsWithDocs();
  const body = open ? docBodyFor(open) : null;
  const initialDoc = open && body ? { slug: open, body } : undefined;

  // The open panel's poster is this URL's LCP. A `<video poster>` is fetched
  // at the browser's default priority, behind the page's scripts; this puts it
  // in the <head>, first.
  const poster = open
    ? ITEM_BY_SLUG.get(open)?.pro
      ? proDemoPoster(open)
      : renderedDemoPoster(open)
    : null;
  if (poster) preload(poster, { as: "image", fetchPriority: "high" });

  return (
    <>
      <GalleryHeaderRow meta={meta} />
      <ProBanner count={PRO_ITEMS.length} className="mb-6 rounded-xl" />
      <div className="pb-24">
        {/* GalleryExplorer reads the filter/sort/item from the URL via nuqs
            (useSearchParams), which requires a Suspense boundary on this
            statically-rendered page. The fallback is the default "All"
            masonry, so every card anchor is present in the prerendered HTML
            (SEO) and there's no flash before hydration. */}
        <Suspense
          fallback={
            <>
              <GalleryGridFallback />
              {open ? <OpenPanel slug={open} docBody={body} /> : null}
            </>
          }
        >
          <GalleryExplorer docSlugs={docSlugs} initialDoc={initialDoc} />
        </Suspense>
      </div>
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
        {CATALOGUE_ITEMS.map((item, i) => (
          <GalleryCard key={item.href} item={item} priority={i < FIRST_ROW} />
        ))}
      </div>
    </div>
  );
}
