import { DocsBody, DocsDescription, DocsTitle } from "fumadocs-ui/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsNewsletterCta } from "@/components/docs/newsletter-cta";
import { RelatedComponents } from "@/components/docs/related-components";
import { renderedDemoPoster, renderedDemoSrc } from "@/lib/demo-urls";
import { galleryItemByHref } from "@/lib/gallery-data";
import { collectDocsPages } from "@/lib/llms";
import { componentFaq } from "@/lib/structured-data";
import { getMDXComponents } from "@/mdx-components";
import { source } from "@/source";

const SITE_URL = "https://snapcn.dev";

/**
 * Every component has its own page again.
 *
 * These routes used to 307 into `/docs/components?item=<slug>`, which put 22
 * documents — one per component, each answering a different query — on a single
 * URL whose title was "Components" whatever you had asked for. A query
 * parameter is not a page: it cannot carry its own title, description, canonical
 * or schema, so twenty-two long-tail intents competed for one result.
 *
 * The gallery overlay is unchanged and is still how the gallery is browsed. It
 * simply is no longer the *only* place a component's documentation exists.
 */

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const data = page.data as any;
  const MDX = data.body;

  // Docs > Category > Page trail derived from the URL segments. Answer
  // engines and Google both consume this for breadcrumb rich results.
  const crumbs = [
    { name: "Docs", path: "/docs" },
    ...page.slugs.map((_, i) => ({
      name: i === page.slugs.length - 1 ? data.title : page.slugs[i],
      path: `/docs/${page.slugs.slice(0, i + 1).join("/")}`,
    })),
  ];

  // The two facts a component page can state that a prose page cannot: the day
  // it shipped, and the mp4 of it. Both are real — `added` is the date of the
  // commit that introduced the component, and the video is the file the page
  // itself plays. Neither is emitted for a page that has no component behind it.
  const item = galleryItemByHref(page.url);
  const slug = page.slugs[page.slugs.length - 1] ?? "";
  const demoSrc = renderedDemoSrc(slug);
  const demoPoster = renderedDemoPoster(slug);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: data.title,
        description: data.description,
        url: `${SITE_URL}${page.url}`,
        image: `${SITE_URL}/og/${page.slugs.join("/")}`,
        author: {
          "@type": "Person",
          name: "Sri Nath",
          url: "https://x.com/SriNath693",
        },
        publisher: { "@type": "Organization", name: "snapcn", url: SITE_URL },
        ...(item?.added
          ? { datePublished: item.added, dateModified: item.added }
          : {}),
      },
      ...(item && demoSrc
        ? [
            {
              "@type": "VideoObject",
              name: `${item.name} — snapcn component demo`,
              description: item.description,
              contentUrl: `${SITE_URL}${demoSrc}`,
              thumbnailUrl: `${SITE_URL}${demoPoster}`,
              // `contentUrl` only. `embedUrl` names a *player* page, and there
              // is none — the demo is an inert <video> inside the docs.
              ...(item.added ? { uploadDate: item.added } : {}),
              isFamilyFriendly: true,
              license: "https://opensource.org/license/mit",
            },
          ]
        : []),
      // Only for a page with a component behind it: a prose page has no install
      // command to answer with, and a FAQ invented for one would be the drift
      // this helper exists to avoid.
      ...(item && slug
        ? [componentFaq(slug, item.name, item.description, page.url)]
        : []),
      ...howToGraph(page.url, data),
      {
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.name,
          item: `${SITE_URL}${c.path}`,
        })),
      },
    ],
  };

  // Rendered directly inside the gallery chrome's content column (see
  // `app/docs/(docs)/layout.tsx`) — no fumadocs `DocsPage`, so there's no TOC
  // rail or breadcrumb, matching the Components page. The prose is centred in a
  // readable, roomy-enough column for the inline component previews.
  return (
    <article className="mx-auto w-full max-w-4xl pt-4 pb-16 md:pt-6 md:pb-20">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD built from page frontmatter
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DocsTitle
        style={{ fontFamily: "var(--font-display)" }}
        className="text-4xl font-semibold tracking-tight text-balance md:text-5xl lg:text-6xl"
      >
        {data.title}
      </DocsTitle>
      <DocsDescription className="mt-3 mb-0 max-w-3xl text-balance text-lg text-muted-foreground md:text-xl">
        {data.description}
      </DocsDescription>
      <DocsBody className="mt-8">
        <MDX components={getMDXComponents()} />
      </DocsBody>
      {/* Renders nothing on a page that is not a component. */}
      <RelatedComponents slug={page.slugs.at(-1) ?? ""} />
      {/* Every docs page, not just component ones — a guide reader is as good
          an address as a component reader, and this is the only ask on them. */}
      <DocsNewsletterCta />
    </article>
  );
}

export function generateStaticParams() {
  // The `components` and `showcase` slugs are served by bespoke `(gallery)`
  // routes, not this catch-all. Neither has an MDX file, so the loader doesn't
  // yield them — this filter is belt-and-braces against any future re-add.
  const RESERVED = new Set([
    "components",
    "showcase",
    "video-editor",
    "templates",
    "marketplace",
    "roadmap",
    "changelog",
  ]);
  return source
    .generateParams()
    .filter((p) => !(p.slug?.length === 1 && RESERVED.has(p.slug[0])));
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();
  const data = page.data as any;
  const ogImage = `/og/${page.slugs.join("/")}`;

  return {
    title: data.title,
    description: data.description,
    alternates: { canonical: page.url },
    openGraph: {
      type: "article",
      url: page.url,
      title: data.title,
      description: data.description,
      siteName: "snapcn",
      images: [{ url: ogImage, width: 1200, height: 630, alt: data.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: data.title,
      description: data.description,
      images: [ogImage],
    },
  };
}

/**
 * `HowTo` for the one page that is genuinely a procedure.
 *
 * Steps are the page's own numbered `##` headings, read from the same plain
 * markdown `/llms-full.txt` is built from — so a step can only exist in the
 * schema if it exists on the page, and editing the MDX rewrites both. Google
 * retired HowTo rich results in 2023; this is here for the answer engines that
 * still parse schema, on the one page an agent actually needs to follow.
 *
 * No step URLs: fumadocs slugs its own heading anchors, and a guessed `#anchor`
 * that misses is worse than an omitted optional field.
 */
const INSTALL_URL = "/docs/getting-started/installation";

function howToGraph(
  url: string,
  data: { title: string; description?: string },
): Record<string, unknown>[] {
  if (url !== INSTALL_URL) return [];

  const body = collectDocsPages().find((p) => p.url === INSTALL_URL)?.body;
  if (!body) return [];

  // "## 1. Teach your project the `@/` alias" — the number is the reader's step
  // counter and `position` carries it in schema, so it is stripped from `name`
  // rather than read twice. Backticks are markdown, not part of the step.
  const steps = [...body.matchAll(/^##\s+\d+\.\s+(.+)$/gm)].map(
    (match, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: match[1].replace(/`/g, "").trim(),
    }),
  );

  if (steps.length === 0) return [];

  return [
    {
      "@type": "HowTo",
      name: data.title,
      description: data.description,
      step: steps,
    },
  ];
}
