import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GALLERY_ITEMS } from "@/lib/gallery-data";
import { getSharedVideo } from "@/lib/server/shared-video";
import { showcaseVideoUrl } from "@/lib/showcase/platform";
import { SITE_URL } from "@/lib/structured-data";
import { CANVAS } from "@/lib/video-editor/types";

/**
 * `/v/<id>` — a video somebody exported, at a permanent URL.
 *
 * ## What this page is for
 *
 * It is the only page on the site whose traffic does not depend on us. An
 * export used to be an MP4 attached to a Slack message, and that view happened
 * on Slack's servers; a link means every person who watches it arrives here
 * instead. 87% of this site's traffic is already pasted links (`t.co` plus
 * direct) — the difference is that those are our posts, and these are everyone
 * else's, permanently, at no marginal cost.
 *
 * So the page is built for the *viewer*, who has never heard of snapcn: the
 * video first at full width, then exactly one thing to do. It sits inside the
 * `(home)` group so it inherits the site header and footer — that header is the
 * conversion surface, and re-deciding what a share page's chrome should be
 * would be a second answer to a question already answered.
 *
 * ## Why it is `noindex`
 *
 * Hundreds of pages holding a video, a title and no prose is thin content, and
 * a domain that publishes it at volume gets treated accordingly — which would
 * put the component docs at risk to chase traffic this page does not get from
 * search anyway. It is `follow` rather than `noindex, nofollow` so the links
 * out of it still count.
 */
export const dynamic = "force-dynamic";

/** Slug → the gallery entry, so "built with" can link to real docs pages. */
function galleryItemBySlug(slug: string) {
  return GALLERY_ITEMS.find((item) => item.href.endsWith(`/${slug}`));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const video = await getSharedVideo(id);
  if (!video) return { title: "Video not found", robots: { index: false } };

  const title = video.title;
  const description = video.authorName
    ? `A video ${video.authorName} made with snapcn — Remotion components for product demo videos.`
    : "Made with snapcn — Remotion components for product demo videos.";
  const videoUrl = `${SITE_URL}${showcaseVideoUrl(video.jobId)}`;

  return {
    title,
    description,
    alternates: { canonical: `/v/${id}` },
    // Crawlable, deliberately not indexable — see the note on the component.
    robots: { index: false, follow: true },
    openGraph: {
      // `video.other` rather than `website`: it is what makes X and Slack
      // inline a player instead of a link preview, which is the difference
      // between a shared link being watched and being scrolled past.
      type: "video.other",
      url: `/v/${id}`,
      title,
      description,
      siteName: "snapcn",
      images: [{ url: "/og", width: 1200, height: 630, alt: title }],
      videos: [
        {
          url: videoUrl,
          type: "video/mp4",
          width: CANVAS.width,
          height: CANVAS.height,
        },
      ],
    },
    twitter: {
      card: "player",
      title,
      description,
      images: ["/og"],
      players: [
        {
          playerUrl: videoUrl,
          streamUrl: videoUrl,
          width: CANVAS.width,
          height: CANVAS.height,
        },
      ],
    },
  };
}

export default async function SharedVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const video = await getSharedVideo(id);
  if (!video) notFound();

  const used = (video.componentsUsed ?? [])
    .map((slug) => ({ slug, item: galleryItemBySlug(slug) }))
    .filter((entry) => entry.item);

  return (
    <div className="section py-10 sm:py-14">
      <div className="mx-auto max-w-3xl">
        {/* The video is the page. It leads, at the aspect it was rendered at,
            with nothing above it to scroll past. `controls` only — autoplay on
            a page someone arrived at from a link is how you get muted playback
            they never notice started. */}
        <div
          className="overflow-hidden rounded-xl border border-border bg-black"
          style={{ aspectRatio: `${CANVAS.width} / ${CANVAS.height}` }}
        >
          {/* biome-ignore lint/a11y/useMediaCaption: user-generated video with no caption track to offer */}
          <video
            className="h-full w-full"
            src={showcaseVideoUrl(video.jobId)}
            controls
            playsInline
            preload="metadata"
          />
        </div>

        <h1 className="mt-6 text-pretty font-sans text-2xl font-normal tracking-[-0.02em] text-foreground sm:text-3xl">
          {video.title}
        </h1>

        <p className="mt-2 text-sm text-current/60">
          {video.authorName
            ? `Made by ${video.authorName} with `
            : "Made with "}
          <Link href="/" className="underline underline-offset-2">
            snapcn
          </Link>
          {" · "}
          <time dateTime={video.createdAt.toISOString()}>
            {video.createdAt.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        </p>

        {/* The components are the product, named. A viewer who wants the thing
            they just watched gets sent to the one that made it, not to a
            gallery of thirty-two to search through. */}
        {used.length > 0 && (
          <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-current/60">
            <span>Built with</span>
            {used.map(({ slug, item }) => (
              <Link
                key={slug}
                href={item?.href ?? "/docs/components"}
                className="rounded-md border border-border px-2 py-0.5 font-mono text-xs text-foreground transition-colors hover:bg-muted"
              >
                {item?.name ?? slug}
              </Link>
            ))}
          </p>
        )}

        {/* One action. The viewer's question after watching is "how", and the
            editor answers it without an install, a signup or a Remotion
            project — which is why it is the ask rather than the registry. */}
        <div className="mt-8 flex flex-col items-start gap-3 border-t border-border pt-8 sm:flex-row sm:items-center">
          <Button
            size="lg"
            className="h-11 px-6 text-sm"
            nativeButton={false}
            render={<Link href="/docs/video-editor" />}
          >
            Make one like this
          </Button>
          <p className="text-sm text-current/60">
            Free, in your browser. No install, no Remotion project.
          </p>
        </div>
      </div>
    </div>
  );
}
