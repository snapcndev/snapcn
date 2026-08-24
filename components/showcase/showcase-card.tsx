import { ArrowUpRight, Play } from "lucide-react";
import type { ShowcaseItem } from "@/lib/server/showcase";
import { isHostedVideo, PLATFORM_LABELS } from "@/lib/showcase/platform";

/**
 * A single showcase entry.
 *
 * Two kinds, one card. A *link* entry is the whole card wrapped in an `<a>` out
 * to the creator's social post, fronted by a scraped og:image. A *hosted* entry
 * is a video we rendered ourselves, so it plays inline — and cannot be wrapped
 * in an anchor, because a `<video controls>` inside a link is a control the
 * reader cannot use. Everything below the media is identical.
 *
 * Mirrors the components gallery card — a flat `bg-gallery-card` mat with
 * a platform badge + open-in-new arrow chip — but carries a thumbnail (scraped
 * og:image, when available) and a title/author footer. External thumbnails and
 * avatars come from arbitrary hosts, so plain `<img>` is used rather than
 * `next/image` (which would need per-host remote-pattern config).
 */
const SHELL =
  "group/card relative mb-5 block break-inside-avoid overflow-hidden bg-gallery-card outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

export function ShowcaseCard({ item }: { item: ShowcaseItem }) {
  const hosted = isHostedVideo(item.postUrl);

  const media = hosted ? (
    <div className="relative aspect-video w-full overflow-hidden">
      {/* biome-ignore lint/a11y/useMediaCaption: user-submitted video, no transcript to ship */}
      <video
        src={item.postUrl}
        controls
        playsInline
        // `metadata`, not `auto`: the gallery is a wall of these, and pulling
        // every file in full on load is the mistake `/docs/components` was
        // already making. The reader presses play on the one they want.
        preload="metadata"
        className="size-full object-cover"
      />
    </div>
  ) : (
    <div className="relative aspect-video w-full overflow-hidden">
      {item.thumbnailUrl ? (
        // biome-ignore lint/performance/noImgElement: scraped og:image from an arbitrary host — next/image can't whitelist unknown domains
        <img
          src={item.thumbnailUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover/card:scale-[1.03]"
        />
      ) : (
        <div className="flex size-full items-center justify-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-gallery-chip backdrop-blur-md">
            <Play className="size-5 text-foreground/80" />
          </span>
        </div>
      )}

      <span className="absolute top-3 left-3 rounded-full bg-gallery-chip px-2.5 py-1 text-xs font-medium text-foreground/80 backdrop-blur-md">
        {PLATFORM_LABELS[item.platform]}
      </span>

      <span className="absolute right-3 bottom-3 flex size-9 items-center justify-center rounded-full bg-gallery-chip backdrop-blur-md transition-colors duration-150 group-hover/card:bg-foreground">
        <ArrowUpRight className="size-4 text-foreground transition-colors duration-150 group-hover/card:text-background" />
      </span>
    </div>
  );

  const footer = (
    <div className="p-4">
      <h3 className="line-clamp-1 text-sm font-medium text-foreground">
        {item.title}
      </h3>
      {item.description ? (
        <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">
          {item.description}
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        {item.authorImage ? (
          // biome-ignore lint/performance/noImgElement: OAuth-provider avatar from an arbitrary host
          <img
            src={item.authorImage}
            alt=""
            loading="lazy"
            className="size-5 rounded-full object-cover"
          />
        ) : (
          <span className="size-5 rounded-full bg-muted" aria-hidden="true" />
        )}
        <span className="truncate text-[13px] text-muted-foreground">
          {item.authorName ?? "Anonymous"}
        </span>
      </div>
    </div>
  );

  if (hosted) {
    return (
      <div className={SHELL}>
        {media}
        {footer}
      </div>
    );
  }

  return (
    <a
      href={item.postUrl}
      target="_blank"
      rel="noreferrer"
      title={item.title}
      className={SHELL}
    >
      {media}
      {footer}
    </a>
  );
}
