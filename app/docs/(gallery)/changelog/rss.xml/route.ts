import { GALLERY_ITEMS } from "@/lib/gallery-data";

export const dynamic = "force-static";

const SITE_URL = "https://snapcn.dev";
const FEED_URL = `${SITE_URL}/docs/changelog/rss.xml`;

/**
 * The changelog as a feed.
 *
 * One item per component rather than one per release day: the item then links
 * to a page that exists, with that component's own demo and docs on it, instead
 * of to a dated anchor. `pubDate` is `added` — the date of the commit that
 * introduced the component, the same date the changelog page prints.
 *
 * Aggregators and answer-engine crawlers both consume this; it is the one
 * discovery channel a docs site gets for free from dates it already has.
 */
export function GET() {
  const items = GALLERY_ITEMS.filter((item) => item.added).sort((a, b) =>
    (b.added ?? "").localeCompare(a.added ?? ""),
  );

  const latest = items[0]?.added;

  const body = items
    .map((item) => {
      const url = `${SITE_URL}${item.href}`;
      return `    <item>
      <title>${escapeXml(item.name)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${rfc822(item.added as string)}</pubDate>
      <description>${escapeXml(item.description)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>snapcn — new components</title>
    <link>${SITE_URL}/docs/changelog</link>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />
    <description>Every component added to snapcn, newest first.</description>
    <language>en</language>${
      latest ? `\n    <lastBuildDate>${rfc822(latest)}</lastBuildDate>` : ""
    }
${body}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}

/** An ISO day, as the RFC 822 date RSS requires. Midnight UTC, like the page. */
function rfc822(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toUTCString();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
