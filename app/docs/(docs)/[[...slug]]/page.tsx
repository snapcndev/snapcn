import { DocsBody, DocsDescription, DocsTitle } from "fumadocs-ui/page";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { notFound, permanentRedirect } from "next/navigation";
import { FaqSection } from "@/components/docs/faq-section";
import { DocsTopBar } from "@/components/docs/gallery/docs-top-bar";
import { DocsNewsletterCta } from "@/components/docs/newsletter-cta";
import { collectionBySlug, collectionItems } from "@/lib/collections";
import { renderedDemoPoster, renderedDemoSrc } from "@/lib/demo-urls";
import {
  CATALOGUE_ITEMS,
  GALLERY_CATEGORIES,
  type GalleryItem,
  galleryItemByHref,
  PRO_GALLERY_ITEMS,
  proItemBySlugs,
  slugFromHref,
} from "@/lib/gallery-data";
import { collectDocsPages } from "@/lib/llms";
import { metaDescription, metaTitle } from "@/lib/meta";
import { PageJsonLd } from "@/lib/page-json-ld";
import { proDemoSrc } from "@/lib/pro-demos";
import {
  categoryItemList,
  categoryQuestions,
  collectionQuestions,
  componentQuestions,
  faqPage,
  firstSentence,
  isCategoryIndex,
  itemList,
  PUBLISHER,
  searchMeta,
} from "@/lib/structured-data";
import { getMDXComponents } from "@/mdx-components";
import { source } from "@/source";

const SITE_URL = "https://snapcn.dev";

/**
 * Only a component URL renders the gallery. Imported statically, its explorer,
 * panel and cards were in the client bundle of every prose page in this route
 * too — see `mdx-components.tsx` for why an import is enough.
 */
const ComponentsGallery = dynamic(() =>
  import("@/components/docs/gallery/components-gallery").then(
    (m) => m.ComponentsGallery,
  ),
);

const AUTHOR = {
  "@type": "Person",
  name: "Sri Nath",
  url: "https://x.com/SriNath693",
};

/**
 * Every component has its own page again.
 *
 * These routes used to 307 into `/docs/components?item=<slug>`, which put 22
 * documents — one per component, each answering a different query — on a single
 * URL whose title was "Components" whatever you had asked for. A query
 * parameter is not a page: it cannot carry its own title, description, canonical
 * or schema, so twenty-two long-tail intents competed for one result.
 *
 * So the URL, its title, description, canonical and schema stay. What it
 * *shows* is the gallery with that component's panel open — the one way a
 * component is presented anywhere on the site (see `ComponentsGallery`). It
 * used to be a separate article page, which meant every component looked two
 * different ways depending on how you arrived at it.
 */

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) {
    const pro = proItemBySlugs(params.slug);
    if (!pro) notFound();
    // Buyers' CLIs print the pro registry's `docs` link, which may name the
    // category a component was filed under before they were sorted.
    if (pro.href !== `/docs/${params.slug?.join("/")}`) {
      permanentRedirect(pro.href);
    }
    return <ProComponent item={pro} />;
  }

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
  // A category index can answer a real question: it is a hub for a whole query
  // ("remotion text animations"), and it shipped with nothing quotable on it.
  const category = isCategoryIndex(page.slugs) ? page.slugs[0] : undefined;
  const categoryItems = category
    ? CATALOGUE_ITEMS.filter((i) => i.category === category)
    : [];
  // A collection page is the other hub shape: same job as a category index,
  // but for a query the taxonomy cannot carry (see `lib/collections.ts`).
  const collection =
    page.slugs[0] === "collections" && page.slugs.length === 2
      ? collectionBySlug(page.slugs[1])
      : undefined;
  const collectionCards = collection ? collectionItems(collection) : [];
  // A component's are rendered in its panel, under the docs (`docBodyFor`).
  const questions =
    item && slug
      ? componentQuestions(slug, item)
      : category
        ? categoryQuestions(category, categoryItems)
        : collection && collectionCards.length > 0
          ? collectionQuestions(collection.query, collectionCards)
          : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TechArticle",
        headline: data.title,
        description: data.description,
        url: `${SITE_URL}${page.url}`,
        image: `${SITE_URL}/og/${page.slugs.join("/")}`,
        author: AUTHOR,
        publisher: PUBLISHER,
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
      ...(questions.length > 0 ? [faqPage(page.url, questions)] : []),
      // The grid on a category page is this list; without the schema the page
      // competes for its query while describing itself as a generic article.
      ...(category ? [categoryItemList(category, categoryItems)] : []),
      ...(collection && collectionCards.length > 0
        ? [itemList(`${collection.query}s`, collectionCards)]
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
  if (item) {
    return (
      <>
        <PageJsonLd graph={jsonLd["@graph"]} path={page.url} />
        <ComponentsGallery open={slug} />
      </>
    );
  }

  // The layout is only the frame: a component URL renders the gallery, which
  // brings its own top bar (`GalleryHeaderRow`), so the prose page brings this one.
  return (
    <>
      <DocsTopBar />
      <article className="mx-auto w-full max-w-4xl pt-4 pb-16 md:pt-6 md:pb-20">
        <PageJsonLd graph={jsonLd["@graph"]} path={page.url} />
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
          <FaqSection questions={questions} />
        </DocsBody>
        {/* Every docs page, not just component ones — a guide reader is as good
          an address as a component reader, and this is the only ask on them. */}
        <DocsNewsletterCta />
      </article>
    </>
  );
}

export function generateStaticParams() {
  // The `components` and `video-editor` slugs are served by bespoke `(gallery)`
  // routes, not this catch-all. Neither has an MDX file, so the loader doesn't
  // yield them — this filter is belt-and-braces against any future re-add.
  const RESERVED = new Set([
    "components",
    "video-editor",
    "templates",
    "roadmap",
    "changelog",
  ]);
  return [
    ...source
      .generateParams()
      .filter((p) => !(p.slug?.length === 1 && RESERVED.has(p.slug[0]))),
    // `/docs/<category>/<slug>` for every paid component.
    ...PRO_GALLERY_ITEMS.map((item) => ({
      slug: item.href.split("/").slice(2),
    })),
  ];
}

export async function generateMetadata(props: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  const pro = page ? null : proItemBySlugs(params.slug);
  // A pro page has no frontmatter: its name and the first sentence of its
  // description stand in for one.
  const data = page
    ? {
        url: page.url,
        slugs: page.slugs,
        name: page.data.seoTitle ?? page.data.title,
        summary: page.data.description ?? "",
        category: galleryItemByHref(page.url)?.category,
      }
    : pro
      ? {
          url: pro.href,
          slugs: pro.href.split("/").slice(2),
          name: pro.name,
          summary: firstSentence(pro.description),
          category: pro.category,
        }
      : notFound();
  const ogImage = `/og${data.url.slice("/docs".length)}`;
  // The search title carries the query; the social card keeps the plain
  // description, which is written to be read rather than matched.
  const { title, description } = searchMeta(
    data.slugs,
    { title: data.name, description: data.summary },
    data.category,
  );

  return {
    title: metaTitle(title),
    description: metaDescription(description),
    alternates: { canonical: data.url },
    openGraph: {
      type: "article",
      url: data.url,
      title,
      description: data.summary,
      siteName: "snapcn",
      images: [{ url: ogImage, width: 1200, height: 630, alt: data.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: data.summary,
      images: [ogImage],
    },
  };
}

/**
 * A paid component's URL: its schema, and the gallery with its panel open.
 *
 * It used to have no page at all — the card linked to a redirect — so the
 * forty-four pro components could not be found by searching for what they do,
 * and "Charts & Stats", which is all pro, was a gallery tab and nothing a
 * search engine could land on. There is no MDX behind it (the source is
 * private), so everything here is the catalogue entry the card already shows.
 */
function ProComponent({ item }: { item: GalleryItem }) {
  const slug = slugFromHref(item.href);
  const url = `${SITE_URL}${item.href}`;
  // The OG card doubles as the video's thumbnail: the pro demos have no poster
  // on the CDN, and a VideoObject without a thumbnail is not eligible for
  // video results.
  const ogImage = `${SITE_URL}/og${item.href.slice("/docs".length)}`;
  const demoSrc = proDemoSrc(slug);
  const lead = firstSentence(item.description);
  const category = GALLERY_CATEGORIES.find((c) => c.id === item.category);
  const dated = item.added
    ? { datePublished: item.added, dateModified: item.added }
    : {};
  // Rendered in the panel, under the video — see `docBodyFor`.
  const questions = componentQuestions(slug, item);

  const graph = [
    {
      "@type": "TechArticle",
      headline: item.name,
      description: lead,
      url,
      image: ogImage,
      author: AUTHOR,
      publisher: PUBLISHER,
      ...dated,
    },
    ...(demoSrc
      ? [
          {
            "@type": "VideoObject",
            name: `${item.name} — snapcn Pro component demo`,
            description: lead,
            contentUrl: demoSrc,
            thumbnailUrl: ogImage,
            ...(item.added ? { uploadDate: item.added } : {}),
            isFamilyFriendly: true,
          },
        ]
      : []),
    faqPage(item.href, questions),
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { name: "Docs", path: "/docs" },
        {
          name: category?.label ?? item.category,
          path: `/docs/${item.category}`,
        },
        { name: item.name, path: item.href },
      ].map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: `${SITE_URL}${c.path}`,
      })),
    },
  ];

  return (
    <>
      <PageJsonLd graph={graph} path={item.href} />
      <ComponentsGallery open={slug} />
    </>
  );
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
