import { escapeXml, rfc822 } from "@/lib/rss";
import { blogPosts } from "@/source";

export const dynamic = "force-static";

const SITE_URL = "https://snapcn.dev";
const FEED_URL = `${SITE_URL}/blog/rss.xml`;

/**
 * The blog as a feed.
 *
 * Sibling to the changelog feed, and worth having for the same reason: the
 * newsletters this site is trying to land in — JavaScript Weekly, React Status,
 * Bytes — read feeds, and so do the answer-engine crawlers. It is the one
 * discovery channel a blog gets for free from dates it already has.
 */
export function GET() {
  const posts = blogPosts();

  const body = posts
    .map((post) => {
      const url = `${SITE_URL}${post.url}`;
      return `    <item>
      <title>${escapeXml(post.data.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${rfc822(post.data.date)}</pubDate>
      <description>${escapeXml(post.data.description ?? "")}</description>
    </item>`;
    })
    .join("\n");

  const latest = posts[0]?.data.date;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>snapcn — blog</title>
    <link>${SITE_URL}/blog</link>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />
    <description>Making product demo videos in React with Remotion.</description>
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
