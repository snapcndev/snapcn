import { GalleryFrame } from "@/components/docs/gallery/gallery-frame";

/**
 * Navigation feedback for every `/docs/*` route.
 *
 * Without this file the App Router held the *old* page on screen until the
 * server responded, which on this site is a long time: `/docs/components`
 * ships a 835KB RSC payload (every component's doc body inlined) and
 * `/docs/showcase` and `/docs/video-editor` are dynamic. Session replay showed
 * the consequence — the same nav link clicked seven times in twelve seconds,
 * 0.4s to 3.2s apart, because nothing on screen had changed. Those were 40 of
 * the site's rage clicks, and they were all on links: Components 12, Showcase
 * 8, Marketplace 7, Docs 5, Templates 3, Video Editor 3.
 *
 * It renders `GalleryFrame` because the rail is not in a layout — every page
 * under `/docs` mounts its own. A fallback without it would blank the whole
 * window, which is a worse answer than the wait.
 *
 * The body is deliberately generic: four rows of 16:9 placeholders read as
 * "the grid is coming" on the gallery and as "something is coming" on a prose
 * page, and one file covers both route groups. Per-route skeletons are the
 * upgrade if the generic one ever reads as wrong.
 */
export default function DocsLoading() {
  return (
    <GalleryFrame>
      <div className="pb-24" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading</span>
        {/* Matches the sticky toolbar's height so the real bar lands where this
            one sat, rather than jumping the grid up on arrival. */}
        <div className="sticky top-0 z-30 -mx-6 bg-background/90 px-6 py-3 backdrop-blur lg:-mx-8 lg:px-8">
          <div className="flex items-center gap-2">
            {[64, 48, 80, 72, 56, 68].map((w) => (
              <span
                key={w}
                style={{ width: w }}
                className="h-[34px] shrink-0 animate-pulse rounded-full bg-gallery-card"
              />
            ))}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder list, never reordered
              key={i}
              className="aspect-video animate-pulse rounded-lg bg-gallery-card"
            />
          ))}
        </div>
      </div>
    </GalleryFrame>
  );
}
