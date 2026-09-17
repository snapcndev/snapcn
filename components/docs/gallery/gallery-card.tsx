"use client";

import { ArrowUpRight } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { type MouseEvent, useRef } from "react";
import {
  type GalleryItem,
  resolveTile,
  slugFromHref,
  TILE_RATIOS,
} from "@/lib/gallery-data";
import { CATALOGUE_PRICE } from "@/lib/plans";
import { previewMeta } from "@/lib/preview-meta";
import { proDemoSrc } from "@/lib/pro-demos";
import {
  RenderedDemo,
  renderedDemoPoster,
  renderedDemoSrc,
} from "@/lib/rendered-demos";
import { useLazyPlayer } from "../use-lazy-player";
import { cardAttr, morphFromCard } from "./shared-media-transition";

/**
 * Remotion, only if a card has no rendered demo — see `live-preview.tsx`. None
 * do today, so this chunk is never fetched and the gallery ships no player.
 */
const LivePreview = dynamic(() => import("./live-preview"), { ssr: false });

/**
 * A single reference-style gallery card: a live Remotion preview that fills the
 * whole card edge to edge — the card adopts the preview's own aspect ratio, so
 * there is never a letterbox mat around the video. On hover (or keyboard focus)
 * a soft blur rises from the bottom and reveals a category coin (left) and an
 * open-in-new arrow (right); at rest the card is nothing but the video. The card
 * is a real `next/link` to the component's doc page (SEO, right-click,
 * cmd/ctrl-open in a new tab), but a plain left-click is intercepted via `onOpen`
 * to open the in-place detail overlay instead of navigating. Name/description
 * reach assistive tech via `title`/`aria-label`, never as visible text.
 */
export function GalleryCard({
  item,
  onOpen,
}: {
  item: GalleryItem;
  /** When provided, a plain click opens the overlay instead of navigating.
   *  May return the state-commit promise so the morph can wait for it. */
  onOpen?: (slug: string) => unknown;
}) {
  const slug = slugFromHref(item.href);
  const { containerRef, playerRef, mounted } = useLazyPlayer();
  const cardRef = useRef<HTMLAnchorElement>(null);

  // Shape and length only — never the component. A paid component has no
  // registry entry at all (the pro barrel is gitignored and never enters the
  // client bundle, which is the point), and a free one does not need its source
  // here either: the card is a video.
  const meta = item.pro ? null : previewMeta(slug);
  // Cards only ever show the default scene, so a rendered demo is always the
  // right picture for the slugs that have one. See lib/rendered-demos.tsx.
  const demoSrc = item.pro ? proDemoSrc(slug) : renderedDemoSrc(slug);
  // No poster for a paid card: it autoplays the moment it is on screen and a
  // still in front of it is a frame of the video shown as a photograph.
  const demoPoster = item.pro ? null : renderedDemoPoster(slug);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // No handler (e.g. the pre-hydration server fallback) → navigate normally.
    // Let modified / non-primary clicks fall through so "open in new tab" works.
    if (!onOpen) return;
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }
    event.preventDefault();
    // The card flies into the overlay's preview slot rather than the overlay
    // appearing as a second copy of it. Falls back to a plain open where the
    // browser has no view transitions or the user asked for less motion.
    morphFromCard(cardRef.current, () => onOpen(slug));
  };

  // The card adopts the preview's own aspect ratio so the video fills it edge to
  // edge — no mat, no letterbox. Falls back to the deterministic tile shape only
  // when a card has no live preview.
  const aspectRatio = meta
    ? `${meta.width} / ${meta.height}`
    : item.pro
      ? "16 / 9"
      : TILE_RATIOS[resolveTile(item)];

  return (
    <Link
      ref={cardRef}
      {...cardAttr(slug)}
      href={item.href}
      onClick={handleClick}
      title={item.name}
      aria-label={`${item.name}: ${item.description}`}
      // `rounded-2xl` is 1.8 × --radius ≈ 8px — softened corners, still reading
      // as a rectangle of video rather than a pill. `overflow-hidden` clips the
      // player/mp4 to it (verified: the corner really does cut the video, not
      // just the mat behind it).
      //
      // A ring, NOT a border — the difference is load-bearing.
      //
      // `aspectRatio` below applies to the *border* box, but the preview is an
      // `absolute inset-0` child and so fills the *content* box. A 1px border
      // makes those two ratios differ (on a 314px 16:9 card: 1.77778 vs
      // 1.78669), `object-contain` then fits the video by height, and 0.78px of
      // `bg-gallery-card` is left down each side — a mat on the left and right
      // and none top or bottom, which reads as the edge being thicker on the
      // sides. A ring is a box-shadow: same hairline, no box changed, so the
      // video fills the card exactly and all four edges measure the same.
      //
      // Weight: `/30` sits deliberately below a control's edge. This is a ~300px
      // picture, not a 40px input, so the token is dialled *down* rather than up
      // (design-system rule 3b, run in the other direction) — it is only here to
      // stop a near-white preview bleeding into the page.
      //
      // No `mb-*` and no `break-inside-avoid`: the grid's `gap-3` makes both
      // gutters now. Left in, the margin stacked on top of the row gap and the
      // vertical gutter came out at twice the horizontal one.
      className="group/card relative block overflow-hidden rounded-2xl bg-gallery-card outline-none ring-1 ring-border/30 focus-visible:ring-2 focus-visible:ring-ring/40"
      style={{ aspectRatio }}
    >
      <div ref={containerRef} className="absolute inset-0">
        {mounted && demoSrc ? (
          <RenderedDemo src={demoSrc} poster={demoPoster ?? undefined} />
        ) : mounted && !item.pro ? (
          <LivePreview slug={slug} name={item.name} playerRef={playerRef} />
        ) : null}
      </div>

      {/* The price, at rest rather than on hover.
          47 people had reached a price page in this site's entire history, and
          2,436 a month reach this grid — so the number has to be ON the card,
          not one click behind a badge that says "Pro" and nothing else. A badge
          that only appears under the pointer is one they meet after deciding.
          Same chip as the hover arrow, so it reads as card furniture rather
          than a sticker on the video.

          "all for" is load-bearing and is not padding. A bare `Pro · $99` on a
          tile showing ONE animation reads as the price OF that animation, which
          is an absurd price for one and hides the only offer there is — there
          is no per-component sale, the catalogue is sold whole. Naming the unit
          turns the same number from a deterrent into the value statement. */}
      {item.pro ? (
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-gallery-chip px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur-md">
          Pro · all for {CATALOGUE_PRICE.annual}/yr
        </span>
      ) : null}

      {/* Hover footer — hidden until the card is hovered/focused so the resting
          card is pure video. A blur rises from the bottom (mask fades it up) and
          carries the open arrow. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-0 transition-opacity duration-200 ease-out group-hover/card:opacity-100 group-focus-visible/card:opacity-100"
      >
        <div className="absolute inset-0 backdrop-blur-md [-webkit-mask-image:linear-gradient(to_top,black_35%,transparent)] [mask-image:linear-gradient(to_top,black_35%,transparent)]" />
        <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent" />

        {/* The arrow, and nothing else. There was a category coin on the left
            too — the same icon the filter bar above already shows, on a card
            the reader has just hovered inside a category they picked. It named
            what they were looking at instead of telling them what happens if
            they click. */}
        <span className="absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-full bg-gallery-chip backdrop-blur-md transition-colors duration-150 group-hover/card:bg-foreground">
          <ArrowUpRight className="size-4 text-foreground transition-colors duration-150 group-hover/card:text-background" />
        </span>
      </div>
    </Link>
  );
}
