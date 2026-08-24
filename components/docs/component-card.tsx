"use client";

import { ArrowUpRight } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  RenderedDemo,
  renderedDemoPoster,
  renderedDemoSrc,
} from "@/lib/rendered-demos";
import { cn } from "@/lib/utils";
import { CONFIGS } from "@/registry/__configs__";
import type { CardItem } from "./component-card-grid";
import { useLazyPlayer } from "./use-lazy-player";

/**
 * The Remotion half. A card shows the rendered mp4 whenever there is one — which
 * today is always — so the player, its scene and the registry behind it are
 * fetched only for a component that has no demo yet, instead of being parsed on
 * every docs page that renders a grid.
 */
const CardPlayer = dynamic(() => import("./card-player"), {
  ssr: false,
  loading: () => <PreviewPlaceholder />,
});

function slugFromHref(href?: string) {
  if (!href) return undefined;
  return href.split("/").filter(Boolean).pop();
}

function previewAspectRatio(item: CardItem) {
  const slug = slugFromHref(item.href);
  const config = slug ? CONFIGS[slug] : undefined;

  if (!config) return "16 / 9";

  const { compositionWidth, compositionHeight } = config;
  return `${compositionWidth} / ${compositionHeight}`;
}

function PreviewPlaceholder() {
  return <div className="size-full bg-muted/40" />;
}

/**
 * The gallery holds 100+ cards, so a live Player per card can't mount
 * eagerly — that fires every composition's font/asset loads and render loop
 * at once on page load. The shared `useLazyPlayer` hook mounts a card's Player
 * only once it nears the viewport, then keeps playback paused whenever the card
 * scrolls back out of view so at most a handful of previews render at once.
 */
function CardPreview({ item }: { item: CardItem }) {
  const slug = slugFromHref(item.href);
  const config = slug ? CONFIGS[slug] : undefined;
  const { containerRef, playerRef, mounted } = useLazyPlayer();

  if (!slug || !config) {
    return (
      <div ref={containerRef} className="size-full">
        <PreviewPlaceholder />
      </div>
    );
  }

  // Cards only ever show the default scene, so a rendered demo is always the
  // right picture for the slugs that have one. See lib/rendered-demos.tsx.
  const demoSrc = renderedDemoSrc(slug);
  const demoPoster = renderedDemoPoster(slug);

  return (
    <div ref={containerRef} className="size-full">
      {mounted && demoSrc ? (
        <RenderedDemo
          src={demoSrc}
          poster={demoPoster ?? undefined}
          className="bg-card"
        />
      ) : mounted ? (
        <CardPlayer slug={slug} playerRef={playerRef} />
      ) : (
        <PreviewPlaceholder />
      )}
    </div>
  );
}

/**
 * Pure visual thumbnail — no name/description text on the card face, by
 * design (matches the reference gallery: a grid of images, not image+caption
 * pairs). The name still reaches assistive tech via `aria-label`/`title` on
 * the wrapping `Link`, just never renders as visible text.
 */
function CardFrame({ item }: { item: CardItem }) {
  return (
    <div
      className="w-full overflow-hidden rounded-none border border-border bg-card transition-colors duration-150 ease-out group-hover/card:border-foreground/30 group-focus-visible/card:border-foreground/30"
      style={{ aspectRatio: previewAspectRatio(item) }}
    >
      <CardPreview item={item} />
    </div>
  );
}

export function ComponentCard({ item }: { item: CardItem }) {
  if (item.status === "stable" && item.href) {
    return (
      <Link
        href={item.href}
        title={item.name}
        aria-label={`${item.name}: ${item.description}`}
        className={cn(
          "group/card relative block rounded-none outline-none",
          "focus-visible:ring-2 focus-visible:ring-ring/40",
        )}
      >
        <CardFrame item={item} />
        <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full border border-border bg-background/90 opacity-0 backdrop-blur transition-opacity duration-150 group-hover/card:opacity-100 group-focus-visible/card:opacity-100">
          <ArrowUpRight className="size-3.5 text-foreground" />
        </span>
      </Link>
    );
  }

  return (
    <div className="group/card block rounded-none opacity-60" title={item.name}>
      <CardFrame item={item} />
    </div>
  );
}
