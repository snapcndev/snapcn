"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { NavBadge } from "@/components/nav-badge";
import { DOCS_NAV } from "@/lib/docs-nav";
import { ITEM_BY_HREF } from "@/lib/gallery-data";
import { cn } from "@/lib/utils";

/**
 * The single source of truth for the sidebar's product nav — the top-level
 * categories shared by every `/docs/*` route. Both the gallery sidebar (desktop
 * rail) and {@link DocsSectionNav} (the mobile row) read this list so the two
 * never drift. `match` is the path prefix that marks a link active.
 *
 * Every href here resolves — a linked dead end reads as a broken site, not as a
 * roadmap.
 */
export const DOCS_SECTIONS = [
  // The written documentation — Getting Started, and every component category
  // index (`/docs/text`, `/docs/captions`, …). Those pages had no entry here at
  // all, so a reader who landed on one had no route back to Installation and
  // nothing in the rail was lit.
  //
  // `fallback` rather than a list of eight prefixes: Docs owns any `/docs` route
  // no other section claims, so adding a component category lights it up without
  // anyone remembering to come back here.
  {
    label: "Docs",
    // `/docs` itself, not the Introduction page. The docs root used to 404 —
    // every link into it (including the breadcrumb JSON-LD every docs page
    // emits) pointed at a page that was never written — so the section jumped
    // you three levels in and the docs had no front door.
    href: "/docs",
    match: "/docs",
    fallback: true,
  },
  { label: "Components", href: "/docs/components", match: "/docs/components" },
  { label: "Templates", href: "/docs/templates", match: "/docs/templates" },
  {
    label: "Video Editor",
    href: "/docs/video-editor",
    match: "/docs/video-editor",
    // The editor shipped and nothing on the site said so. **Take the flag off
    // once it stops being news** — a "New" that outlives its release teaches
    // people to stop reading flags. The header's entry in `NAV_LINKS` carries
    // the same one and comes off at the same time.
    badge: "New",
  },
  // The coding-agent route in: Claude Code, Cursor, Codex and the rest. A
  // section rather than a Getting Started page because it is not MDX, and
  // `DOCS_NAV` is checked against the MDX on disk.
  {
    label: "MCP",
    href: "/docs/mcp",
    match: "/docs/mcp",
    // Shipped with @snapcn/mcp. Same rule as the editor's flag: off once it
    // stops being news.
    badge: "New",
  },
  // "Add to Remotion Studio" — the install with no CLI. The button lives on
  // every free component; this is where it explains itself. Same rule as the
  // flags above: off once it stops being news.
  {
    label: "Remotion Studio",
    href: "/docs/remotion-studio",
    match: "/docs/remotion-studio",
    badge: "New",
  },
  { label: "Roadmap", href: "/docs/roadmap", match: "/docs/roadmap" },
  { label: "Changelog", href: "/docs/changelog", match: "/docs/changelog" },
] as const;

export type DocsSection = (typeof DOCS_SECTIONS)[number];

/**
 * The section's flag, if it has one.
 *
 * `DOCS_SECTIONS` is `as const`, so each entry has its own literal type and
 * only the flagged ones have the field at all — hence the probe rather than a
 * plain `section.badge`.
 */
export const sectionBadge = (section: DocsSection): string | undefined =>
  "badge" in section ? section.badge : undefined;

/**
 * A rail link that prefetches when somebody reaches for it, not when it scrolls
 * into view.
 *
 * Next prefetches every visible `<Link>` as soon as the page hydrates. The rail
 * is a dozen links on every docs page, and that was ~40 route requests (one of
 * them 41KB) fired in the first 150ms — racing the page's own content on a
 * phone's connection, and counted in full by Lighthouse's mobile LCP. Hover,
 * focus and touch come a few hundred milliseconds before the click, which is
 * the head start a prefetch is for.
 */
export function NavLink(props: ComponentProps<typeof Link>) {
  const router = useRouter();
  const warm = () => router.prefetch(String(props.href));
  return (
    <Link
      {...props}
      prefetch={false}
      onPointerEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
    />
  );
}

/**
 * The rail's "you are here" dot, pulsing on the link that was just clicked
 * while its page is on the way. Put inside a `<Link>`; renders nothing once the
 * page has arrived, or if it never had to wait.
 *
 * This is the feedback `app/docs/loading.tsx` used to give — a click on a slow
 * link changed nothing on screen, and people clicked it again and again. That
 * file gave it by wrapping every docs page in a Suspense boundary, which ships
 * each page's content *hidden* in its HTML behind a skeleton: 116 of 153 pages
 * showed a crawler that did not run JavaScript nothing but the skeleton. The
 * link is where the click happened, so the feedback goes there instead.
 */
export function PendingDot() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      className="size-1.5 rounded-full bg-foreground/60 motion-safe:animate-pulse"
      aria-hidden="true"
    />
  );
}

/**
 * Returns a predicate that reports whether a section is the active one for the
 * current pathname. Exact match or a child path both count, so
 * `/docs/ui/components/button` lights up the "UI" link.
 *
 * A `fallback` section only wins when nothing else does — otherwise Docs, whose
 * prefix is the bare `/docs`, would be active on every route in the group.
 */
export function useSectionActive() {
  // A component's own URL is the Components gallery with its panel open.
  const path = usePathname();
  const pathname = ITEM_BY_HREF.has(path) ? "/docs/components" : path;
  const hits = (match: string) =>
    pathname === match || pathname.startsWith(`${match}/`);

  return (section: DocsSection) => {
    if (!("fallback" in section && section.fallback))
      return hits(section.match);
    return (
      hits(section.match) &&
      !DOCS_SECTIONS.some(
        (other) =>
          !("fallback" in other && other.fallback) && hits(other.match),
      )
    );
  };
}

/**
 * The mobile section nav: a horizontal row of the same links the sidebar shows,
 * rendered only below `lg` (where the fixed sidebar is hidden). Used at the top
 * of both the Components gallery and the prose docs so no `/docs/*` route is
 * left without navigation on small screens.
 *
 * Inside the written docs it also carries the page tree the rail shows there
 * ({@link DOCS_NAV}) — without it, a phone reader on `/docs/text` could reach
 * the six product sections and not one of the other docs pages.
 */
export function DocsSectionNav({ className }: { className?: string }) {
  const isActive = useSectionActive();
  const pathname = usePathname();
  const inDocs = isActive(DOCS_SECTIONS[0]);

  return (
    <nav className={cn("lg:hidden", className)}>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {DOCS_SECTIONS.map((item) => {
          const active = isActive(item);
          return (
            <NavLink
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 text-sm transition-colors",
                active
                  ? "font-medium text-foreground"
                  : "text-foreground/70 hover:text-foreground",
              )}
            >
              {item.label}
              {sectionBadge(item) ? (
                <NavBadge>{sectionBadge(item) as string}</NavBadge>
              ) : null}
              {active ? null : <PendingDot />}
            </NavLink>
          );
        })}
      </div>

      {inDocs
        ? DOCS_NAV.map((group) => (
            <div
              key={group.title}
              className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1"
            >
              <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {group.title}
              </span>
              {group.links.map((link) => {
                const current = pathname === link.href;
                return (
                  <NavLink
                    key={link.href}
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "text-[13px] transition-colors",
                      current
                        ? "font-medium text-foreground"
                        : "text-foreground/65 hover:text-foreground",
                    )}
                  >
                    {link.label}
                  </NavLink>
                );
              })}
            </div>
          ))
        : null}
    </nav>
  );
}
