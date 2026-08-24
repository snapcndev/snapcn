import type { Metadata } from "next";
import Link from "next/link";
import { DocsTopBar } from "@/components/docs/gallery/docs-top-bar";
import { GalleryFrame } from "@/components/docs/gallery/gallery-frame";
import { DOCS_PAGE_META } from "@/config/site";
import { ROADMAP, STAGE_LABEL, type Stage } from "@/lib/roadmap-data";
import {
  docsBreadcrumb,
  JsonLd,
  PUBLISHER,
  SITE_URL,
} from "@/lib/structured-data";

const { title: TITLE, description: DESCRIPTION } = DOCS_PAGE_META["roadmap"];
/** Per-page card. `/og` alone is the generic site card. */
const OG_IMAGE = "/og/roadmap";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/docs/roadmap" },
  openGraph: {
    type: "website",
    url: "/docs/roadmap",
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

const ORDER: Stage[] = ["shipped", "building", "next", "exploring"];

/**
 * Only what has shipped is listed.
 *
 * The rest of this page is a plan, and a plan asserted as structured data is a
 * claim about software that does not exist. The page says "exploring" in words
 * where the schema would have to say "item"; the honest graph is the finished
 * work plus the page itself.
 */
const jsonLd = [
  {
    "@type": "WebPage",
    "@id": `${SITE_URL}/docs/roadmap#page`,
    name: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/docs/roadmap`,
    publisher: PUBLISHER,
  },
  {
    "@type": "ItemList",
    name: "Shipped",
    itemListElement: ROADMAP.filter((entry) => entry.stage === "shipped").map(
      (entry, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: entry.title,
        ...(entry.href ? { url: `${SITE_URL}${entry.href}` } : {}),
      }),
    ),
  },
  docsBreadcrumb(TITLE, "/docs/roadmap"),
];

/**
 * "26 Aug". Pinned to UTC and to one locale: an ISO date parses as midnight
 * UTC, so rendering it in a timezone behind UTC prints the day before — and the
 * server and the client have to agree on the string or React rehydrates over it.
 */
function formatDue(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  });
}

export default function RoadmapPage() {
  return (
    <GalleryFrame>
      <JsonLd graph={jsonLd} />
      <DocsTopBar />

      <div className="mx-auto w-full max-w-3xl py-12 sm:py-16">
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Roadmap
        </p>
        <h1 className="mt-3 max-w-[20ch] text-pretty font-sans text-[clamp(1.75rem,3.6vw,2.75rem)] font-normal leading-[1.08] tracking-[-0.03em] text-foreground">
          Where this is going
        </h1>
        <p className="mt-4 max-w-lg text-pretty text-body-lg text-current/70">
          Dates are given only for what is already being built. Everything below
          that is ordered, not scheduled — a date we miss costs more than the
          date is worth.
        </p>

        <div className="mt-12 space-y-12">
          {ORDER.map((stage) => {
            const entries = ROADMAP.filter((r) => r.stage === stage);
            if (entries.length === 0) return null;

            return (
              <section key={stage}>
                <h2 className="font-mono text-sm font-medium text-foreground">
                  {STAGE_LABEL[stage]}
                </h2>

                <ul className="mt-5 space-y-6 border-l border-border pl-5">
                  {entries.map((entry) => (
                    <li key={entry.title}>
                      {entry.due && (
                        <span className="mr-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 align-middle font-mono text-[0.6875rem] font-medium tabular-nums text-primary">
                          <time dateTime={entry.due}>
                            {formatDue(entry.due)}
                          </time>
                        </span>
                      )}
                      {entry.href ? (
                        <Link
                          href={entry.href}
                          className="font-medium text-foreground underline-offset-4 hover:underline"
                        >
                          {entry.title}
                        </Link>
                      ) : (
                        <span className="font-medium text-foreground">
                          {entry.title}
                        </span>
                      )}
                      <p className="mt-1 max-w-prose text-pretty text-sm text-muted-foreground">
                        {entry.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="mt-16 text-sm text-muted-foreground">
          Want to know the day one of these moves?{" "}
          <Link
            href="/#newsletter"
            className="text-foreground underline underline-offset-4"
          >
            Join the list
          </Link>
          , or watch the{" "}
          <Link
            href="/docs/changelog"
            className="text-foreground underline underline-offset-4"
          >
            changelog
          </Link>
          .
        </p>
      </div>
    </GalleryFrame>
  );
}
