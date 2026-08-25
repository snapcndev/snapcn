import { DocsBody } from "fumadocs-ui/page";
import type { ReactNode } from "react";
import { GALLERY_ITEMS, slugFromHref } from "@/lib/gallery-data";
import { getMDXComponents } from "@/mdx-components";
import { source } from "@/source";

// The overlay renders the live preview itself (top of the right column), so the
// in-body hero preview widgets are suppressed — otherwise every doc would mount
// a second, redundant Remotion player. These three are the only preview widgets
// the docs use; there are no inline <ComponentExample> demos to preserve.
const NULL_PREVIEW = () => null;
const OVERLAY_MDX = getMDXComponents({
  ComponentPreview: NULL_PREVIEW,
  UiComponentPreview: NULL_PREVIEW,
  BlockPreview: NULL_PREVIEW,
});

/** The fumadocs page for a gallery slug, or null if it has no MDX. */
function pageForSlug(slug: string) {
  const item = GALLERY_ITEMS.find((i) => slugFromHref(i.href) === slug);
  if (!item) return null;
  return source.getPage(item.href.replace(/^\/docs\//, "").split("/")) ?? null;
}

/**
 * One component's documentation body, rendered from its MDX.
 *
 * This used to be `getDocBodies()`, which returned *every* component's body in
 * one record so the gallery page could hand the whole set to the overlay. That
 * put 23 rendered documents into the payload of a page that shows at most one
 * of them: `/docs/components` served 1.03MB of HTML and an 835KB RSC payload on
 * every client-side navigation, of which 800KB was documents nobody had asked
 * to read yet. Measured with and without: 835KB → 37KB.
 *
 * The MDX under `content/docs/**` is still the single source of truth, and it
 * is still what `/docs/<category>/<slug>` renders — this is the same body,
 * fetched when the overlay actually opens.
 */
export function docBodyFor(slug: string): ReactNode | null {
  const page = pageForSlug(slug);
  if (!page) return null;
  // biome-ignore lint/suspicious/noExplicitAny: fumadocs page.data.body is loosely typed, matching app/docs/(docs)/[[...slug]]/page.tsx
  const MDX = (page.data as any).body;
  return (
    <DocsBody>
      <MDX components={OVERLAY_MDX} />
    </DocsBody>
  );
}

/**
 * Which slugs have documentation at all.
 *
 * A list of strings, not documents — small enough to ship with the page, which
 * is the point: the overlay has to choose between its two layouts (docs column
 * vs centred preview) on the first frame it opens, and waiting for a fetch to
 * find out would land the user on the wrong one and then reflow it.
 */
export function slugsWithDocs(): string[] {
  return GALLERY_ITEMS.map((item) => slugFromHref(item.href)).filter((slug) =>
    Boolean(pageForSlug(slug)),
  );
}
