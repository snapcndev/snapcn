"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelToggleIcon } from "@/components/icons/panel-toggle";
import { SearchButton } from "@/components/search-button";
import { SnapCnLogo } from "@/components/snapcn-logo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { GITHUB_URL, X_URL } from "@/config/site";
import { DOCS_NAV } from "@/lib/docs-nav";
import { GALLERY_COUNT } from "@/lib/gallery-data";
import { cn } from "@/lib/utils";
import { DOCS_SECTIONS, useSectionActive } from "./section-nav";

/**
 * The gallery's fixed left rail (desktop only), shared by every `/docs/*`
 * route. It owns the logo + derived component count at the top (moved out of a
 * separate top bar), the section links, and a promo block pinned to the bottom.
 * Being `fixed` + full-height, it never scrolls with the page and its bottom is
 * never clipped. The « button collapses it (the frame slides it off-screen and
 * reclaims the width); a floating » button in the frame reopens it. The section
 * links (and which one is active) come from {@link DOCS_SECTIONS} so the rail
 * and the mobile nav stay in sync.
 *
 * Inside the written docs it also opens the page tree ({@link DOCS_NAV}) —
 * Getting Started and every category. Without it the rail listed the six product
 * sections and nothing else, so `/docs/text` showed one category, no route to
 * the other six, and no route back to Installation.
 */

export function GallerySidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const _year = new Date().getFullYear();
  const isActive = useSectionActive();
  const _pathname = usePathname();
  // The written docs are one of the six sections, so their page tree only opens
  // while you are in them — the Components gallery and the Showcase keep the
  // short rail they had. `DOCS_SECTIONS[0]` is the Docs entry, and its
  // `fallback` matching is exactly "a /docs route no other section claims".
  const inDocs = isActive(DOCS_SECTIONS[0]);

  return (
    <aside
      aria-hidden={collapsed}
      className={cn(
        // No border-r: the rail and the grid share one background, and the
        // whitespace between them is the separation. A rule down the full height
        // only chops the page in two.
        "fixed top-0 left-0 z-30 hidden h-screen w-[var(--gallery-sidebar-w-open)] flex-col overflow-y-auto bg-background px-5 py-5 transition-transform duration-300 ease-out lg:flex",
        collapsed && "-translate-x-full",
      )}
    >
      <SidebarBody onToggle={onToggle} inDocs={inDocs} isActive={isActive} />
    </aside>
  );
}

/**
 * Everything inside the rail.
 *
 * Extracted so the mobile drawer can mount the same markup. Below `lg` the
 * fixed rail is hidden, and until now that meant a phone had no route to Docs,
 * Components, Templates or anything else — the nav simply did not exist there.
 */
function SidebarBody({
  onToggle,
  inDocs,
  isActive,
}: {
  onToggle?: () => void;
  inDocs: boolean;
  isActive: (section: (typeof DOCS_SECTIONS)[number]) => boolean;
}) {
  const pathname = usePathname();
  const year = new Date().getFullYear();

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Link href="/" aria-label="snapcn home" className="shrink-0">
          <SnapCnLogo />
        </Link>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <span
              className="size-1.5 rounded-full bg-primary"
              aria-hidden="true"
            />
            {GALLERY_COUNT} components
          </span>
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="flex size-7 shrink-0 items-center justify-center rounded-4xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PanelToggleIcon className="size-[18px]" />
          </button>
        </div>
      </div>

      <SearchButton className="mt-6 text-[13px]" />

      <nav className="mt-8 flex flex-col">
        {DOCS_SECTIONS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              // 13px on a 1.8 leading = a 23.4px pitch, measured off the
              // reference rail (23.5px). The old 15px/leading-loose/py-1 came to
              // 38px, which is why the rail read as oversized.
              className={
                active
                  ? "flex items-center gap-1.5 text-[13px] leading-[1.8] text-foreground"
                  : "flex items-center gap-1.5 text-[13px] leading-[1.8] text-foreground/65 transition-colors hover:text-foreground"
              }
            >
              {item.label}
              {active ? (
                <span
                  className="size-1.5 rounded-full bg-foreground"
                  aria-hidden="true"
                />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {inDocs ? (
        <div className="mt-7 flex flex-col gap-6">
          {DOCS_NAV.map((group) => (
            <div key={group.title}>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {group.title}
              </p>
              <div className="mt-1.5 flex flex-col">
                {group.links.map((link) => {
                  // Exact match: a component's own path redirects into the
                  // gallery overlay, so nothing deeper than these ever renders
                  // here — except the Getting Started pages, which are the leaf.
                  const current = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={current ? "page" : undefined}
                      className={
                        current
                          ? "flex items-center gap-1.5 text-[13px] leading-[1.8] text-foreground"
                          : "flex items-center gap-1.5 text-[13px] leading-[1.8] text-foreground/65 transition-colors hover:text-foreground"
                      }
                    >
                      {link.label}
                      {current ? (
                        <span
                          className="size-1.5 rounded-full bg-foreground"
                          aria-hidden="true"
                        />
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex flex-col gap-3 pt-10">
        <div className="flex size-10 items-center justify-center rounded-full bg-gallery-card">
          <GitHubIcon className="size-5 text-foreground" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-foreground">Star snapcn</p>
          <p className="text-[13px] text-muted-foreground">
            Free, open-source components.
          </p>
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Production-ready Remotion animations, transitions and backgrounds —
          you own the code.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className={PILL}
          >
            Star on GitHub
            <ArrowUpRight className="size-3.5" />
          </a>
          {/* The project account, not a personal one — this is where releases
              and new components get announced. */}
          <a href={X_URL} target="_blank" rel="noreferrer" className={PILL}>
            <XIcon className="size-3.5" />
            Follow
          </a>
        </div>
        {/* Full-width hairline with a short near-black head, as on the
            reference rail — the dark segment is what reads as a rule end-stop;
            a bare 1px line at this width just looks like a gap. */}
        <div className="my-1 h-px w-full bg-border">
          <div className="h-px w-[13px] bg-foreground" />
        </div>
        <p className="text-[13px] text-muted-foreground">
          MIT licensed · own your code.
        </p>
        <p className="text-[13px] text-muted-foreground">© {year} snapcn</p>
      </div>
    </>
  );
}

/**
 * The rail as a drawer, for viewports the fixed one is hidden on.
 *
 * Same `SidebarBody`, so there is one nav and it cannot drift from the desktop
 * one — the alternative was a second list of links that would have to be kept
 * in step by hand.
 */
export function GallerySidebarMobile() {
  const isActive = useSectionActive();
  const inDocs = isActive(DOCS_SECTIONS[0]);

  return (
    <Sheet>
      {/* In the flow of whichever chrome mounts it, not `fixed`. A fixed button
          cannot line up with a bar it is not part of — it sat above the title
          rather than beside it — and it needed a border and a shadow to look
          deliberate floating over the content. In flow it inherits the bar's
          own centring and can be a bare icon like the controls beside it. */}
      <SheetTrigger
        aria-label="Open navigation"
        className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
      >
        <PanelToggleIcon className="size-[18px]" />
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[min(20rem,85vw)] overflow-y-auto bg-background px-5 py-5"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <SidebarBody inDocs={inDocs} isActive={isActive} />
      </SheetContent>
    </Sheet>
  );
}

/** Shared by the two social links in the promo block. */
const PILL =
  "inline-flex items-center gap-1.5 rounded-4xl border border-border px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted";

// lucide-react (as pinned in this repo) ships no brand/logo icons, so the
// GitHub and X glyphs are inlined here.
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      role="img"
      aria-label="GitHub"
    >
      <title>GitHub</title>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.27-.01-1-.02-1.96-3.2.69-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.71 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.44-2.7 5.41-5.27 5.7.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      role="img"
      aria-label="X"
    >
      <title>X</title>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
