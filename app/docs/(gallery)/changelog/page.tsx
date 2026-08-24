import type { Metadata } from "next";
import Link from "next/link";
import { DocsTopBar } from "@/components/docs/gallery/docs-top-bar";
import { GalleryFrame } from "@/components/docs/gallery/gallery-frame";
import { DOCS_PAGE_META } from "@/config/site";
import {
  GALLERY_COUNT,
  itemsByReleaseDate,
  slugFromHref,
} from "@/lib/gallery-data";
import {
  docsBreadcrumb,
  JsonLd,
  PUBLISHER,
  SITE_URL,
} from "@/lib/structured-data";

const { title: TITLE, description: DESCRIPTION } = DOCS_PAGE_META["changelog"];
/** Per-page card. `/og` alone is the generic site card. */
const OG_IMAGE = "/og/changelog";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/docs/changelog",
    // Declared so a reader's feed reader — and a crawler — can find it without
    // being told the URL.
    types: { "application/rss+xml": "/docs/changelog/rss.xml" },
  },
  openGraph: {
    type: "website",
    url: "/docs/changelog",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "snapcn",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

/**
 * Long dates, spelled out. `toLocaleDateString` with an explicit UTC timezone —
 * an ISO date string parses as midnight UTC, and rendering it in a timezone
 * behind UTC prints the previous day, so a component added on the 20th shows as
 * the 19th for anyone west of Greenwich. Locale is pinned for the same reason
 * the timezone is: the server and the client must print the same string.
 */
function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ChangelogPage() {
  const releases = itemsByReleaseDate();
  const dated = releases.reduce((n, r) => n + r.items.length, 0);

  /**
   * The list this page renders, as data. Every entry carries the date the
   * component landed — the same `added` its own page publishes — so a crawler
   * or an assistant can answer "what is new in snapcn" without parsing prose.
   */
  const jsonLd = [
    {
      "@type": "CollectionPage",
      "@id": `${SITE_URL}/docs/changelog#page`,
      name: TITLE,
      description: DESCRIPTION,
      url: `${SITE_URL}/docs/changelog`,
      publisher: PUBLISHER,
    },
    {
      "@type": "ItemList",
      name: "Components by release date",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      itemListElement: releases
        .flatMap((release) =>
          release.items.map((item) => ({ date: release.date, item })),
        )
        .map(({ date, item }, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: {
            "@type": "CreativeWork",
            name: item.name,
            description: item.description,
            url: `${SITE_URL}${item.href}`,
            datePublished: date,
          },
        })),
    },
    docsBreadcrumb(TITLE, "/docs/changelog"),
  ];

  return (
    <GalleryFrame>
      <JsonLd graph={jsonLd} />
      <DocsTopBar />

      <div className="mx-auto w-full max-w-3xl py-12 sm:py-16">
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Changelog
        </p>
        <h1 className="mt-3 max-w-[20ch] text-pretty font-sans text-[clamp(1.75rem,3.6vw,2.75rem)] font-normal leading-[1.08] tracking-[-0.03em] text-foreground">
          What shipped, and when
        </h1>
        <p className="mt-4 max-w-lg text-pretty text-body-lg text-current/70">
          {DESCRIPTION} Every entry installs with one command — the source lands
          in your repo and you own it from there.
        </p>

        {/* A count that does not match the registry is the signal that a
            component shipped without an `added` date. Say so on the page rather
            than quietly rendering a short list. */}
        {dated < GALLERY_COUNT && (
          <p className="mt-4 text-sm text-muted-foreground">
            {GALLERY_COUNT - dated} of {GALLERY_COUNT} components are not dated
            yet and are missing from this list.
          </p>
        )}

        <ol className="mt-12 space-y-12">
          {releases.map(({ date, items }) => (
            <li key={date}>
              <div className="flex items-baseline gap-3">
                <h2 className="font-mono text-sm font-medium tabular-nums text-foreground">
                  <time dateTime={date}>{formatDay(date)}</time>
                </h2>
                <span className="text-sm text-muted-foreground">
                  {items.length}{" "}
                  {items.length === 1 ? "component" : "components"}
                </span>
              </div>

              <ul className="mt-5 space-y-4 border-l border-border pl-5">
                {items.map((item) => (
                  <li key={item.href}>
                    {/* Deep-links into the gallery overlay rather than the doc
                        page: the overlay is where a component is actually
                        demonstrated, and it is one back-button from here. */}
                    <Link
                      href={`/docs/components?item=${slugFromHref(item.href)}`}
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-1 max-w-prose text-pretty text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <p className="mt-16 text-sm text-muted-foreground">
          Want these as they ship?{" "}
          <Link
            href="/#newsletter"
            className="text-foreground underline underline-offset-4"
          >
            Join the list
          </Link>{" "}
          — one email a week, never a sponsored one.
        </p>
      </div>
    </GalleryFrame>
  );
}
