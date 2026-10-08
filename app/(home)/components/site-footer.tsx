import Link from "next/link";
import { FOOTER_COLUMNS } from "@/config/site";
import {
  CATALOGUE_COUNT,
  CATALOGUE_ITEMS,
  GALLERY_CATEGORIES,
  GALLERY_COUNT,
} from "@/lib/gallery-data";
import { cn } from "@/lib/utils";
import { HeaderLogo } from "./header-parts";

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
  "group relative inline-flex w-fit items-center text-[0.9375rem] text-foreground",
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

const EYEBROW = "text-sm text-muted-foreground";

type Group = {
  title: string;
  href?: string;
  links: { href: string; label: string; pro?: boolean }[];
};

const GROUPS: Group[] = [
  ...GALLERY_CATEGORIES.map((category) => ({
    title: category.label,
    href: `/docs/${category.id}`,
    links: CATALOGUE_ITEMS.filter((item) => item.category === category.id).map(
      (item) => ({ href: item.href, label: item.name, pro: item.pro }),
    ),
  })).filter((group) => group.links.length > 0),
  ...FOOTER_COLUMNS,
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="section pt-14 pb-12 sm:pt-16">
        {/* Every component by name under its category, then the site links —
            one flow, no divider. CSS columns rather than a grid: the groups run
            from 2 entries to 22, and a grid of blocks with those heights leaves
            holes. `break-inside-avoid` keeps a group whole. Derived from
            CATALOGUE_ITEMS, so a component cannot ship and be missing here. */}
        {/* Logo and licence on the left, the link groups in three columns on
            the right — ElevenLabs' footer layout. */}
        <div className="grid gap-12 lg:grid-cols-[1fr_3fr]">
          <div className="flex flex-col gap-4">
            <HeaderLogo />
            {/* Not a bare "MIT licensed": half the catalogue is paid, and a
                licence line that covers half of it is a small untruth. */}
            <p
              className="max-w-[16rem] text-sm text-muted-foreground"
              suppressHydrationWarning
            >
              © {new Date().getFullYear()} snapcn — {GALLERY_COUNT} components
              MIT licensed, {CATALOGUE_COUNT - GALLERY_COUNT} Pro
            </p>
          </div>
          <div className="columns-2 gap-x-8 md:columns-3">
            {GROUPS.map(({ title, href, links }) => (
              <div key={title} className="mb-10 break-inside-avoid">
                {href ? (
                  <Link
                    href={href}
                    className={cn(
                      EYEBROW,
                      "transition-colors hover:text-foreground",
                    )}
                  >
                    {title}
                  </Link>
                ) : (
                  <p className={EYEBROW}>{title}</p>
                )}
                <ul className="mt-4 flex flex-col gap-2.5">
                  {links.map(({ href, label, pro }) => (
                    <li key={href}>
                      {/* Anything off-site opens in a new tab and says so. */}
                      {href.startsWith("http") ? (
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
                      {pro ? (
                        <span className="ml-1.5 align-middle font-mono text-[0.625rem] uppercase tracking-[0.1em] text-muted-foreground">
                          Pro
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
