import { CATALOGUE_ITEMS, type GalleryItem } from "@/lib/gallery-data";

/**
 * Curated cross-cuts through the catalogue, each one a page for a search the
 * categories cannot answer.
 *
 * The categories are the taxonomy — every component has exactly one, and that
 * is what the sidebar and the gallery filter run on. But `screens` alone holds
 * device frames, a terminal and a cursor, and those are three different things
 * to search for: "remotion iphone mockup" returns Placeit and Rotato, "remotion
 * terminal animation" returns no remotion.dev result at all, and "remotion
 * cursor animation" misfires to After Effects plugins. One category page
 * carrying one phrase cannot win three.
 *
 * So a collection is additive and nothing else: no component changes category,
 * the gallery filter is untouched, and a component may appear in several. What
 * a collection owns is a query and an order.
 *
 * Membership is by component NAME, resolved against the live catalogue at
 * render time. A paid component is absent whenever `PRO_DEMO_BASE` is unset
 * (see `PRO_GALLERY_ITEMS`), so the list here is an intent and the resolver
 * below is what is true — a collection quietly shows fewer cards rather than
 * rendering a hole. `collections.test.ts` is what stops a typo doing the same
 * thing silently.
 */
export interface Collection {
  slug: string;
  /** The phrase this page exists to answer, as someone would type it. */
  query: string;
  /** Component names, in the order they should read. */
  names: string[];
}

export const COLLECTIONS: Collection[] = [
  {
    slug: "device-mockups",
    query: "Remotion device mockup",
    names: [
      "phone-frame",
      "laptop-frame",
      "phone-pitch",
      "laptop-open",
      "screen-wall",
      "tap-through",
      "checkout-push",
    ],
  },
  {
    slug: "terminal-animations",
    query: "Remotion terminal animation",
    names: ["terminal-simulator", "string-hero", "lcd-type", "render-wall"],
  },
  {
    slug: "cursor-animations",
    query: "Remotion cursor animation",
    names: ["cursor-track", "roster-grant", "tap-through"],
  },
  {
    slug: "image-galleries",
    query: "Remotion image gallery animation",
    names: [
      "orbit-gallery",
      "moodboard-reveal",
      "reel-collage",
      "card-rail",
      "gallery-push",
      "word-montage",
      "showcase-drift",
    ],
  },
];

export function collectionBySlug(slug: string): Collection | undefined {
  return COLLECTIONS.find((c) => c.slug === slug);
}

/** A collection's cards, in its own order, skipping anything not published. */
export function collectionItems(collection: Collection): GalleryItem[] {
  const byName = new Map(
    CATALOGUE_ITEMS.map((item) => [item.href.split("/").pop() as string, item]),
  );
  return collection.names
    .map((name) => byName.get(name))
    .filter((item): item is GalleryItem => item !== undefined);
}
