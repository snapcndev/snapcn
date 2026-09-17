import { GalleryFrame } from "@/components/docs/gallery/gallery-frame";
import { DocsTopBar } from "./docs-top-bar";

/**
 * The page a linked-but-unbuilt `/docs/*` section shows.
 *
 * `DOCS_SECTIONS` lists product categories ahead of their pages existing, which
 * used to mean the sidebar had links that 404'd — a dead end that reads as a
 * broken site rather than as a roadmap. This keeps the whole chrome (rail,
 * section nav, theme toggle) so the reader stays oriented and can carry on.
 *
 * When one of these ships, replace the route's page with the real thing; nothing
 * else needs touching.
 */
export function ComingSoonPage({
  title,
  description,
  eyebrow = "Coming soon",
  children,
}: {
  title: string;
  description: string;
  /** "Coming soon", or a date once there is one. */
  eyebrow?: string;
  /** Under the description — the one thing to do while waiting. */
  children?: React.ReactNode;
}) {
  return (
    <GalleryFrame>
      <DocsTopBar />

      <div className="flex min-h-[55vh] flex-col items-start justify-center">
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="mt-3 max-w-[24ch] text-pretty font-sans text-[clamp(1.75rem,3.6vw,2.75rem)] font-normal leading-[1.08] tracking-[-0.03em] text-foreground">
          {title}
        </h1>
        <p className="mt-4 max-w-md text-pretty text-body-lg text-current/70">
          {description}
        </p>
        {children}
      </div>
    </GalleryFrame>
  );
}
