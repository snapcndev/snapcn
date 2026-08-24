"use client";

import { Player } from "@remotion/player";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { type MouseEvent, useMemo, useRef } from "react";
import { AbsoluteFill, Img } from "remotion";
import {
  CATEGORY_ICONS,
  type GalleryItem,
  resolveTile,
  slugFromHref,
  TILE_RATIOS,
} from "@/lib/gallery-data";
import { resolvePreview } from "@/lib/gallery-preview";
import {
  RenderedDemo,
  renderedDemoPoster,
  renderedDemoSrc,
} from "@/lib/rendered-demos";
import { useLazyPlayer } from "../use-lazy-player";
import { cardAttr, morphFromCard } from "./shared-media-transition";

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

  const preview = useMemo(() => resolvePreview(slug), [slug]);
  // Cards only ever show the default scene, so a rendered demo is always the
  // right picture for the slugs that have one. See lib/rendered-demos.tsx.
  const demoSrc = renderedDemoSrc(slug);
  const demoPoster = renderedDemoPoster(slug);

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

  // Blocks paint their own full-bleed backdrop fill, exactly like PreviewStage
  // — memoized so the Player's `component` identity stays stable across renders
  // (a changing identity would remount the Player and restart playback).
  const Composition = useMemo(() => {
    if (!preview) return null;
    if (!preview.previewBackdrop) return preview.Component;
    const backdrop = preview.previewBackdrop;
    const Inner = preview.Component;
    const Wrapped = (props: Record<string, unknown>) => (
      <AbsoluteFill>
        {backdrop.type === "image" ? (
          <AbsoluteFill>
            <Img
              src={backdrop.src}
              style={{
                width: "100%",
                height: "100%",
                objectFit: backdrop.fit ?? "cover",
              }}
            />
          </AbsoluteFill>
        ) : (
          <AbsoluteFill style={{ background: backdrop.value }} />
        )}
        <Inner {...props} />
      </AbsoluteFill>
    );
    return Wrapped;
  }, [preview]);

  // The card adopts the preview's own aspect ratio so the video fills it edge to
  // edge — no mat, no letterbox. Falls back to the deterministic tile shape only
  // when a card has no live preview.
  const aspectRatio = preview
    ? `${preview.width} / ${preview.height}`
    : TILE_RATIOS[resolveTile(item)];

  const Icon = CATEGORY_ICONS[item.category];

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
        {preview && Composition && mounted ? (
          demoSrc ? (
            <RenderedDemo src={demoSrc} poster={demoPoster ?? undefined} />
          ) : (
            <Player
              ref={playerRef}
              component={Composition}
              inputProps={preview.inputProps}
              durationInFrames={preview.durationInFrames}
              fps={preview.fps}
              compositionWidth={preview.width}
              compositionHeight={preview.height}
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: "transparent",
              }}
              controls={false}
              loop
              // Remotion starts playback itself as soon as the player is ready,
              // with no time limit — so a slow-loading card never gets stranded
              // on its first frame the way the rAF play() poll (which gives up
              // after ~2s under a heavy concurrent mount) can leave it. The
              // useLazyPlayer visibility effect still pauses off-screen cards.
              autoPlay
              acknowledgeRemotionLicense
            />
          )
        ) : null}
      </div>

      {/* Hover footer — hidden until the card is hovered/focused so the resting
          card is pure video. A blur rises from the bottom (mask fades it up) and
          carries the category coin and the open arrow. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-0 transition-opacity duration-200 ease-out group-hover/card:opacity-100 group-focus-visible/card:opacity-100"
      >
        <div className="absolute inset-0 backdrop-blur-md [-webkit-mask-image:linear-gradient(to_top,black_35%,transparent)] [mask-image:linear-gradient(to_top,black_35%,transparent)]" />
        <div className="absolute inset-0 bg-linear-to-t from-black/20 to-transparent" />

        <span className="absolute bottom-3 left-3 flex size-9 items-center justify-center rounded-full bg-gallery-chip backdrop-blur-md">
          <Icon className="size-4 text-foreground/80" />
        </span>

        <span className="absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-full bg-gallery-chip backdrop-blur-md transition-colors duration-150 group-hover/card:bg-foreground">
          <ArrowUpRight className="size-4 text-foreground transition-colors duration-150 group-hover/card:text-background" />
        </span>
      </div>
    </Link>
  );
}
