import Link from "next/link";
import { FOOTER_COLUMNS } from "@/config/site";
import {
  CATALOGUE_COUNT,
  CATALOGUE_ITEMS,
  GALLERY_CATEGORIES,
  GALLERY_COUNT,
} from "@/lib/gallery-data";
import { cn } from "@/lib/utils";

/**
 * Sitemap footer: one column per group, each headed by a mono eyebrow.
 *
 * It replaced a single row of two links, which left the bottom of a full-bleed
 * page looking unfinished and gave a reader who reached the end nowhere to go.
 * Columns come from `FOOTER_COLUMNS` so the links cannot drift from the routes.
 */

/**
 * The hover from ruixen.com's `AnimatedLink` (registry/ruixenui/animated-link).
 *
 * The detail that makes it read as a wipe rather than a stretch is the origin
 * *flipping*: at rest the underline is scaled to nothing about its right edge, and
 * on hover the origin becomes the left edge before it scales up — so it sweeps in
 * from one side instead of growing out of the middle. Scaling a pseudo-element
 * also keeps the whole thing on the compositor; no layout is touched.
 */
const LINK = cn(
  "group relative inline-flex w-fit items-center text-sm text-foreground/75",
  "transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none",
  "before:pointer-events-none before:absolute before:left-0 before:top-[1.5em] before:h-[0.05em] before:w-full before:bg-current before:content-['']",
  "before:origin-right before:scale-x-0 before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)]",
  "hover:before:origin-left hover:before:scale-x-100",
  "motion-reduce:before:transition-none",
);

/** The diagonal that draws itself in on hover, from the same component. */
function DrawArrow() {
  return (
    <svg
      className="ml-[0.3em] size-[0.55em]"
      fill="none"
      viewBox="0 0 10 10"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M1.004 9.166 9.337.833m0 0v8.333m0-8.333H1.004"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="[stroke-dasharray:32] [stroke-dashoffset:32] transition-[stroke-dashoffset] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:[stroke-dashoffset:0] motion-reduce:transition-none"
      />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="section pt-14 pb-12 sm:pt-16">
        {/* Every component by name, under its category.
            CSS columns rather than a grid: the categories run from 2 entries to
            22, and a grid of seven blocks with those heights leaves a column of
            white space beside Captions. `break-inside-avoid` keeps a category
            whole. Derived from CATALOGUE_ITEMS, so a component cannot ship and
            be missing from here. */}
        <div className="columns-1 gap-x-8 sm:columns-2 lg:columns-3 xl:columns-4">
          {GALLERY_CATEGORIES.map((category) => {
            const items = CATALOGUE_ITEMS.filter(
              (item) => item.category === category.id,
            );
            if (items.length === 0) return null;
            return (
              <div key={category.id} className="mb-10 break-inside-avoid">
                <Link
                  href={`/docs/${category.id}`}
                  className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {category.label}
                </Link>
                <ul className="mt-4 flex flex-col gap-3">
                  {items.map((item) => (
                    <li key={item.href}>
                      {/* Paid ones too: each has its own page now, and this is
                          the one link to it on every page of the site. */}
                      <Link href={item.href} className={LINK}>
                        {item.name}
                      </Link>
                      {item.pro ? (
                        <span className="ml-1.5 align-middle font-mono text-[0.625rem] uppercase tracking-[0.1em] text-muted-foreground">
                          Pro
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-10 border-t border-border pt-12 sm:grid-cols-3">
          {FOOTER_COLUMNS.map(({ title, links }) => (
            <div key={title}>
              <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {title}
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                {links.map(({ href, label }) => {
                  // Anything off-site opens in a new tab and says so, rather
                  // than silently navigating away from the docs.
                  const external = href.startsWith("http");
                  return (
                    <li key={href}>
                      {external ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className={LINK}
                        >
                          {label}
                          <DrawArrow />
                        </a>
                      ) : (
                        <Link href={href} className={LINK}>
                          {label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <p
          className="mt-14 text-sm text-muted-foreground sm:mt-16"
          suppressHydrationWarning
        >
          {/* Not a bare "MIT licensed" any more: the grid this page sends
              people to is 46% paid, and a licence line that covers half of it
              is the kind of small untruth a reader notices later. */}
          © {new Date().getFullYear()} snapcn — {GALLERY_COUNT} components MIT
          licensed, {CATALOGUE_COUNT - GALLERY_COUNT} Pro
        </p>
      </div>
    </footer>
  );
}
