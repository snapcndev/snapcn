"use client";

import {
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
  useQueryStates,
} from "nuqs";
import { type ReactNode, useCallback, useEffect, useMemo } from "react";
import { useTrackEvent } from "@/lib/analytics";
import {
  GALLERY_CATEGORIES,
  GALLERY_ITEMS,
  type GalleryFilter,
  getFilteredItems,
  ITEM_BY_SLUG,
  slugFromHref,
} from "@/lib/gallery-data";
import { cn } from "@/lib/utils";
import { GalleryCard } from "./gallery-card";
import { GalleryDetailOverlay } from "./gallery-detail-overlay";

// "new" leads the bar: the shelf a returning visitor checks first, and the only
// one that changes between visits. It is a filter, not a category — see
// `GalleryFilter` in gallery-data.
const FILTER_IDS: GalleryFilter[] = [
  "new",
  ...GALLERY_CATEGORIES.map((c) => c.id),
];

/**
 * The double chevron on the "New" pill.
 *
 * Both arrows run the same `chevron-glow` loop; the lower one is offset by a
 * *negative* delay so it is already a beat into the cycle on first paint. That
 * phase difference is the whole effect — the eye reads a light moving up the
 * pair, not two icons blinking. `motion-reduce` drops the animation entirely,
 * which leaves both arrows at their natural full opacity.
 *
 * The glow is a drop-shadow in `currentColor`, dark mode only: a halo around a
 * dark blue on a light surface reads as a smudge, not as light.
 */
function NewChevrons() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      fill="none"
      className="size-5 shrink-0 dark:drop-shadow-[0_0_3px_currentColor]"
    >
      <path
        d="M5.2168 11.2812L8.3418 8.15625L11.4668 11.2812"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-chevron-glow [animation-delay:-0.28s] motion-reduce:animate-none"
      />
      <path
        d="M5.2168 6.90625L8.3418 3.78125L11.4668 6.90625"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-chevron-glow motion-reduce:animate-none"
      />
    </svg>
  );
}

function pillClassName(active: boolean) {
  return cn(
    "shrink-0 cursor-default rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150",
    active
      ? "bg-foreground text-background"
      : "bg-gallery-card text-foreground/70 hover:text-foreground",
  );
}

/**
 * The gallery's client toolbar + masonry + detail overlay. Category pills
 * genuinely filter the grid (in the URL via nuqs `?category=`,
 * `history: "replace"`). Clicking a card opens the
 * in-place detail overlay via `?item=<slug>` (`history: "push"`, so Back closes
 * it); prev/next walk the on-screen list.
 */
export function GalleryExplorer({
  docSlugs,
}: {
  /** Slugs that have documentation; the bodies load when the overlay opens. */
  docSlugs?: string[];
}) {
  const [{ category }, setState] = useQueryStates(
    { category: parseAsStringLiteral(FILTER_IDS) },
    { history: "replace" },
  );

  const [activeSlug, setActiveSlug] = useQueryState(
    "item",
    parseAsString.withOptions({ history: "push", shallow: true }),
  );

  const trackEvent = useTrackEvent();
  // Which shelf people shop. A category nobody ever filters to is either badly
  // named or badly stocked, and this is the only way to tell which.
  const setFilter = useCallback(
    (next: { category?: GalleryFilter | null }) => {
      void setState(next);
      trackEvent("gallery_filtered", {
        category: next.category !== undefined ? next.category : category,
      });
    },
    [setState, trackEvent, category],
  );

  // Legacy deep links used a `#<category>` hash (the old scroll-anchor pills).
  // Convert those into the equivalent filter on mount so shared/bookmarked URLs
  // keep working, then strip the hash.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash && (FILTER_IDS as string[]).includes(hash)) {
      void setState({ category: hash as GalleryFilter });
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, [setState]);

  const items = useMemo(() => getFilteredItems(category), [category]);

  const activeItem = activeSlug ? (ITEM_BY_SLUG.get(activeSlug) ?? null) : null;

  // Prev/next wrap around the on-screen list when the open item is in it,
  // else over the full curated list (e.g. a deep link outside the filter).
  const step = useCallback(
    (dir: 1 | -1) => {
      void setActiveSlug((current) => {
        if (!current) return current;
        const inList = items.some((i) => slugFromHref(i.href) === current);
        const list = inList ? items : GALLERY_ITEMS;
        const idx = list.findIndex((i) => slugFromHref(i.href) === current);
        if (idx === -1) return current;
        return slugFromHref(list[(idx + dir + list.length) % list.length].href);
      });
    },
    [items, setActiveSlug],
  );

  return (
    <div className="not-prose">
      {/* No border-b. The bar is sticky and already separates itself when it
          overlaps the grid — the blurred background is the affordance. */}
      <div className="sticky top-0 z-30 -mx-6 bg-background/90 px-6 py-3 backdrop-blur lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-2">
          <div
            className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
          >
            <button
              type="button"
              aria-pressed={category === null}
              onClick={() => setFilter({ category: null })}
              className={pillClassName(category === null)}
            >
              All
            </button>
            <button
              type="button"
              aria-pressed={category === "new"}
              onClick={() => setFilter({ category: "new" })}
              className={cn(
                pillClassName(category === "new"),
                "inline-flex items-center gap-0.5 pr-2.5",
                // Only when unselected: the blue is what pulls the click. Once
                // selected the pill takes the same inverted treatment as every
                // other one, where sky on `bg-foreground` would fail contrast.
                // sky-700/sky-400 rather than one sky-500 — 500 measures 2.35:1
                // on the light gallery mat and 6.45:1 on the dark one.
                category !== "new" && "text-sky-700 dark:text-sky-400",
              )}
            >
              New
              <NewChevrons />
            </button>
            {GALLERY_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={category === c.id}
                onClick={() => setFilter({ category: c.id })}
                className={pillClassName(category === c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* A grid, not `columns-*`. Every card is 16:9 (every config is 1280x720),
          so there was never anything for a masonry to stagger — and CSS multicol
          fills greedily: it picks the shortest height that holds the set, then
          packs each column to it. 21 cards across four columns is 6/6/6/3, which
          left the fourth column empty for half the page and the right quarter of
          the screen dead. A grid lays the same cards out row-major, so the only
          hole is the tail of the last row. `items-start` keeps a card at its own
          aspect ratio instead of being stretched to its row. */}
      <div className="mt-6 grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <GalleryCard
            key={item.href}
            item={item}
            onOpen={(slug) => void setActiveSlug(slug)}
          />
        ))}
      </div>

      <GalleryDetailOverlay
        item={activeItem}
        docSlugs={docSlugs}
        onClose={() => void setActiveSlug(null)}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
      />
    </div>
  );
}
