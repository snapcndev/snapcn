import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { blogPosting, faqPage, JsonLd, SITE_URL } from "@/lib/structured-data";
import { getMDXComponents } from "@/mdx-components";
import { blogSource } from "@/source";

/**
 * One post.
 *
 * The body renders through the same `getMDXComponents()` the docs use, so a
 * post can drop a `<ComponentPreview>` in and show the thing it is describing
 * actually moving. That is the whole reason the blog is MDX and not a list of
 * markdown files: the evidence for "here is how you animate a terminal" is the
 * terminal animating, and a screenshot of one is not it.
 */
export default async function BlogPostPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const page = blogSource.getPage([slug]);
  if (!page) notFound();

  const MDX = page.data.body;
  const { faq } = page.data;

  return (
    <article className="mx-auto w-full max-w-3xl px-4 pt-12 pb-20 md:pt-16 md:pb-28">
      <JsonLd
        graph={[
          blogPosting({
            title: page.data.title,
            description: page.data.description,
            date: page.data.date,
            url: page.url,
          }),
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Blog",
                item: `${SITE_URL}/blogs`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: page.data.title,
                item: `${SITE_URL}${page.url}`,
              },
            ],
          },
          ...(faq.length ? [faqPage(page.url, faq)] : []),
        ]}
      />
      <Link
        href="/blogs"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Blog
      </Link>
      <time
        dateTime={page.data.date.toISOString()}
        className="mt-8 block text-xs text-muted-foreground tabular-nums"
      >
        {new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }).format(page.data.date)}
      </time>
      <h1
        style={{ fontFamily: "var(--font-display)" }}
        className="mt-2 text-4xl font-semibold tracking-tight text-balance md:text-5xl"
      >
        {page.data.title}
      </h1>
      {page.data.description ? (
        <p className="mt-3 text-balance text-lg text-muted-foreground">
          {page.data.description}
        </p>
      ) : null}
      <div className="prose mt-10">
        <MDX components={getMDXComponents()} />
        {faq.length ? (
          <>
            <h2 id="faq">FAQ</h2>
            {faq.map(({ question, answer }) => (
              <div key={question}>
                <h3>{question}</h3>
                <p>{answer}</p>
              </div>
            ))}
          </>
        ) : null}
      </div>
    </article>
  );
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const page = blogSource.getPage([slug]);
  if (!page) notFound();

  // `seoTitle` where the H1 is written for the reader and the query is not in
  // it. Falls back to the H1, which is the right default: a post whose title
  // already carries the query needs no second one.
  const title = page.data.seoTitle ?? page.data.title;
  const description = page.data.description ?? "";
  const url = page.url;
  // The card carries the post's own title, not the site's. `/og` mirrors the
  // page path, so this needs no second slug map to drift out of date.
  const ogImage = `/og${url}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      // `article`, not `website` — it is what makes a share card show a date.
      type: "article",
      url,
      title,
      description,
      siteName: "snapcn",
      publishedTime: page.data.date.toISOString(),
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export function generateStaticParams() {
  return blogSource.getPages().map((page) => ({ slug: page.slugs[0] }));
}

export const dynamicParams = false;
