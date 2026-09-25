import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd, PUBLISHER, SITE_URL } from "@/lib/structured-data";
import { blogPosts } from "@/source";

const TITLE = "Blog";
const DESCRIPTION =
  "Guides to building product demo videos in React with Remotion — one technique per post, each with the component that does it.";
const OG_IMAGE = "/og";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/blogs",
    types: { "application/rss+xml": "/blogs/rss.xml" },
  },
  openGraph: {
    type: "website",
    url: "/blogs",
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

/** A post's date, written the way the feed and the schema write it: UTC. */
const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default function BlogIndexPage() {
  const posts = blogPosts();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-12 pb-20 md:pt-16 md:pb-28">
      <JsonLd
        graph={[
          {
            "@type": "Blog",
            name: `snapcn — ${TITLE}`,
            description: DESCRIPTION,
            url: `${SITE_URL}/blogs`,
            publisher: PUBLISHER,
          },
        ]}
      />
      <h1
        style={{ fontFamily: "var(--font-display)" }}
        className="text-4xl font-semibold tracking-tight text-balance md:text-5xl"
      >
        {TITLE}
      </h1>
      <p className="mt-3 max-w-2xl text-balance text-lg text-muted-foreground">
        {DESCRIPTION}
      </p>

      {posts.length === 0 ? (
        <p className="mt-12 text-muted-foreground">Nothing published yet.</p>
      ) : (
        <ul className="mt-12 flex flex-col gap-px overflow-hidden rounded-lg border bg-border">
          {posts.map((post) => (
            <li key={post.url} className="bg-background">
              <Link
                href={post.url}
                className="group flex flex-col gap-1 p-5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
              >
                <time
                  dateTime={post.data.date.toISOString()}
                  className="text-xs text-muted-foreground tabular-nums"
                >
                  {DATE.format(post.data.date)}
                </time>
                <h2 className="text-lg font-medium tracking-tight group-hover:underline">
                  {post.data.title}
                </h2>
                {post.data.description ? (
                  <p className="text-sm text-muted-foreground">
                    {post.data.description}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
