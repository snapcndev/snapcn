"use client";

import { Plus, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  type CategoryId,
  GALLERY_CATEGORIES,
  GALLERY_ITEMS,
  slugFromHref,
} from "@/lib/gallery-data";
import { renderedDemoSrc } from "@/lib/rendered-demos";
import { cn } from "@/lib/utils";
import registry from "@/registry/__index__";

type LibItem = {
  slug: string;
  name: string;
  category: CategoryId;
  /** How much of the timeline's frame budget adding this would spend. */
  durationInFrames: number;
};

// Curated gallery items that actually have a renderable registry composition.
// The duration is read here, once, rather than per render: it is a property of
// the component, and the tiles need it to know what still fits.
const ADDABLE: LibItem[] = GALLERY_ITEMS.map((it) => ({
  slug: slugFromHref(it.href),
  name: it.name,
  category: it.category,
}))
  .filter((it) => Boolean(registry[it.slug]))
  .map((it) => ({
    ...it,
    durationInFrames: registry[it.slug].config.durationInFrames,
  }));

/**
 * One library tile: the component's rendered demo, playing on hover.
 *
 * The name is hidden until hover. A permanent caption bar over every tile means
 * a wall of gradients competing with the previews they sit on — and the preview
 * is the thing being chosen between. Names appear on the one tile being
 * considered; `focus-within` brings them back for keyboard users, who get no
 * hover at all.
 *
 * The mp4s in `public/demos/` already exist — they are what the gallery ships
 * as previews — so a picker of *moving* thumbnails costs an `<video>` tag, not
 * a thumbnailing pipeline.
 *
 * They loop on their own, but only while on screen. Twenty-two simultaneous
 * decoders in a rail is a space heater and showed up as blocking time in
 * Lighthouse; an `IntersectionObserver` plays the two or three a reader can
 * actually see and pauses the rest. That is what "autoplay" has to mean here —
 * not a compromise on it.
 */
function LibraryTile({
  item,
  fits,
  onAdd,
  observer,
}: {
  /** Whether the timeline has room for this clip. */
  fits: boolean;
  item: LibItem;
  onAdd: (slug: string) => void;
  observer: IntersectionObserver | null;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !observer) return;
    observer.observe(el);
    return () => observer.unobserve(el);
  }, [observer]);

  return (
    <button
      type="button"
      onClick={() => onAdd(item.slug)}
      title={
        fits
          ? `Add ${item.name}`
          : `${item.name} — no room left on the timeline`
      }
      // Dimmed, not `disabled`. A disabled button cannot be clicked, so it can
      // never say *why* it is unavailable, and its tooltip does not exist on a
      // touch screen. Clicking this one raises the toast that names the limit.
      aria-disabled={!fits}
      className={cn(
        "group relative aspect-video overflow-hidden rounded-xl border border-border bg-gallery-card text-left transition-[border-color,opacity,transform] duration-150 hover:border-primary focus-visible:border-primary",
        !fits && "opacity-40",
      )}
    >
      {/* No caption track: the preview is decorative and silent, and the
          accessible name is on the button that wraps it.

          `renderedDemoSrc`, not a hand-built `/demos/<slug>.mp4`: the path
          carries a hash of the file's bytes, and without it this grid keeps
          replaying whatever it cached before the demo was last re-rendered. It
          returns null for a registry entry that ships no demo, which used to be
          a 404 per tile. */}
      <video
        ref={videoRef}
        src={renderedDemoSrc(item.slug) ?? undefined}
        muted
        loop
        playsInline
        // `metadata`, not `auto`: the observer starts playback when the tile
        // scrolls in, and the browser fetches what it needs then. Preloading
        // all 22 up front is the same space heater by another route.
        preload="metadata"
        className="size-full object-cover"
      />

      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-7 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="block truncate text-xs font-medium text-white">
          {item.name}
        </span>
      </span>

      <span className="pointer-events-none absolute top-2 right-2 grid size-7 place-items-center rounded-full bg-background/90 opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        <Plus className="size-4 text-foreground" />
      </span>
    </button>
  );
}

export function LibraryPanel({
  onAdd,
  budgetFrames,
}: {
  onAdd: (slug: string) => void;
  /**
   * Frames a *new* clip may occupy — 0 when nothing more can be added at all.
   * Anything longer is dimmed. Which limit produced a 0 is `addClip`'s to say;
   * from here they are the same fact: it will not fit.
   */
  budgetFrames: number;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [observer, setObserver] = useState<IntersectionObserver | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // One observer for the whole list rather than one per tile, and `root` is the
  // scrolling panel — with the default (the viewport) every tile in an
  // overflowing rail reads as visible and they would all play at once.
  const attachScroll = useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            // `catch`: a browser may refuse autoplay, and an unhandled
            // rejection here would be noise, not information.
            void video.play().catch(() => {});
          } else {
            video.pause();
            video.currentTime = 0;
          }
        }
      },
      { root: node, rootMargin: "120px 0px", threshold: 0.15 },
    );
    setObserver(io);
  }, []);

  useEffect(() => () => observer?.disconnect(), [observer]);

  const items = useMemo(() => {
    const query = q.trim().toLowerCase();
    return ADDABLE.filter(
      (it) =>
        (!category || it.category === category) &&
        (!query || it.name.toLowerCase().includes(query)),
    );
  }, [q, category]);

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2.5 border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search components"
            className="pl-9"
          />
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [&::-webkit-scrollbar]:hidden">
          <FilterPill
            active={category === null}
            onClick={() => setCategory(null)}
          >
            All
          </FilterPill>
          {GALLERY_CATEGORIES.map((c) => (
            <FilterPill
              key={c.id}
              active={category === c.id}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </FilterPill>
          ))}
        </div>
      </div>

      <div ref={attachScroll} className="min-h-0 flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="pt-6 text-center text-sm text-muted-foreground">
            Nothing matches “{q}”.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 sm:gap-2.5">
            {items.map((it) => (
              <LibraryTile
                key={it.slug}
                item={it}
                fits={it.durationInFrames <= budgetFrames}
                onAdd={onAdd}
                observer={observer}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
