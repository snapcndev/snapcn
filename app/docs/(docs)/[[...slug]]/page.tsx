import { DocsBody, DocsDescription, DocsTitle } from "fumadocs-ui/page";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Fragment } from "react";
import { InstallBlock } from "@/components/docs/install-block";
import { DocsNewsletterCta } from "@/components/docs/newsletter-cta";
import { RelatedComponents } from "@/components/docs/related-components";
import { renderedDemoPoster, renderedDemoSrc } from "@/lib/demo-urls";
import {
  GALLERY_CATEGORIES,
  type GalleryItem,
  galleryItemByHref,
  PRO_GALLERY_ITEMS,
  proItemBySlugs,
  slugFromHref,
} from "@/lib/gallery-data";
import { collectDocsPages } from "@/lib/llms";
import { CATALOGUE_PRICE, PRO_SAMPLE } from "@/lib/plans";
import { proDemoSrc } from "@/lib/pro-demos";
import { RenderedDemo } from "@/lib/rendered-demos";
import { installCounts, MIN_SHOWN } from "@/lib/server/install-counts";
import {
  componentQuestions,
  faqPage,
  firstSentence,
  JsonLd,
  PUBLISHER,
  searchMeta,
} from "@/lib/structured-data";
import { getMDXComponents } from "@/mdx-components";
import { source } from "@/source";

const SITE_URL = "https://snapcn.dev";

/**
 * Rebuilt daily rather than once per deploy, for the install counts: they are a
 * 30-day window, so a page baked at build time would show last month's number
 * until the next release.
 */
export const revalidate = 86400;

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
 * The gallery overlay is unchanged and is still how the gallery is browsed. It
 * simply is no longer the *only* place a component's documentation exists.
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
    return (
      <ProComponentPage
        item={pro}
        installers={(await installCounts())?.total}
      />
    );
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
  // Only for a page with a component behind it: a prose page has no install
  // command to answer with, and a FAQ invented for one would be the drift
  // this helper exists to avoid.
  const questions = item && slug ? componentQuestions(slug, item) : [];
  const installers = item
    ? (await installCounts())?.byComponent[slug]
    : undefined;

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
      {installers !== undefined && installers >= MIN_SHOWN ? (
        <InstalledBy count={installers} />
      ) : null}
      <DocsBody className="mt-8">
        <MDX components={getMDXComponents()} />
        <FaqSection questions={questions} />
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
        name: page.data.title,
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
    title,
    description,
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
 * The visible half of the FAQPage schema — same list, so they cannot disagree.
 *
 * Inside the prose body so it reads as the page's last section, and `#faq` is
 * the `@id` the schema points at. Backticks in an answer are inline code.
 */
function FaqSection({
  questions,
}: {
  questions: { question: string; answer: string }[];
}) {
  if (questions.length === 0) return null;
  return (
    <>
      <h2 id="faq">Frequently asked questions</h2>
      {questions.map(({ question, answer }) => (
        <Fragment key={question}>
          <h3>{question}</h3>
          <p>
            {answer
              .split("`")
              .map((part, i) =>
                i % 2 ? <code key={part}>{part}</code> : part,
              )}
          </p>
        </Fragment>
      ))}
    </>
  );
}

/**
 * The proof on a free component's page: how many developers installed it.
 *
 * Distinct CLI and agent installers over 30 days — see `installCounts` for what
 * is and is not counted, and `MIN_SHOWN` for why a small number shows nothing.
 */
function InstalledBy({ count }: { count: number }) {
  return (
    <p className="mt-3 mb-0 flex items-center gap-2 text-muted-foreground text-sm">
      <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
      Installed by {count.toLocaleString("en-US")} developers in the last 30
      days
    </p>
  );
}

/**
 * A paid component's page: the video, how it moves, the price, the install.
 *
 * It used to have no page at all — the card linked to a redirect — so the
 * forty-four pro components could not be found by searching for what they do,
 * and "Charts & Stats", which is all pro, was a gallery tab and nothing a
 * search engine could land on. There is no MDX behind it (the source is
 * private), so everything here is the catalogue entry the card already shows.
 */
function ProComponentPage({
  item,
  installers,
}: {
  item: GalleryItem;
  /** Everyone who installed a snapcn component this month — there is no per-Pro count until Pro sells. */
  installers?: number;
}) {
  const slug = slugFromHref(item.href);
  const url = `${SITE_URL}${item.href}`;
  // The OG card doubles as the video's thumbnail: the pro demos have no poster
  // on the CDN, and a VideoObject without a thumbnail is not eligible for
  // video results.
  const ogImage = `${SITE_URL}/og${item.href.slice("/docs".length)}`;
  const demoSrc = proDemoSrc(slug);
  const lead = firstSentence(item.description);
  const rest = item.description.startsWith(lead)
    ? item.description.slice(lead.length).trim()
    : "";
  const questions = componentQuestions(slug, item);
  const category = GALLERY_CATEGORIES.find((c) => c.id === item.category);
  const dated = item.added
    ? { datePublished: item.added, dateModified: item.added }
    : {};

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
    <article className="mx-auto w-full max-w-4xl pt-4 pb-16 md:pt-6 md:pb-20">
      <JsonLd graph={graph} />
      <DocsTitle
        style={{ fontFamily: "var(--font-display)" }}
        className="text-4xl font-semibold tracking-tight text-balance md:text-5xl lg:text-6xl"
      >
        {item.name}
      </DocsTitle>
      <DocsDescription className="mt-3 mb-0 max-w-3xl text-balance text-lg text-muted-foreground md:text-xl">
        {lead}
      </DocsDescription>
      <DocsBody className="mt-8">
        {demoSrc ? (
          // The free pages' preview frame (`ComponentPreview`), so the two read
          // as one kind of page.
          <div className="not-prose surface-card relative aspect-video w-full overflow-hidden rounded-2xl">
            <RenderedDemo src={demoSrc} />
          </div>
        ) : null}
        {/* `/pro?c=` rather than the pricing page: it opens on this component
            with the two catalogue plans under it and the free sample beside
            them, and sign-in returns there — one page between wanting it and
            paying, not three. */}
        <div className="not-prose mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href="/docs/pricing#plans"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90"
          >
            Get {item.name} with Pro
          </Link>
          <Link
            href="/docs/pricing#free"
            className="text-muted-foreground text-sm underline underline-offset-4 hover:text-foreground"
          >
            or get {PRO_SAMPLE.title} free
          </Link>
          <span className="w-full text-muted-foreground text-xs">
            {PRO_GALLERY_ITEMS.length} Pro components · {CATALOGUE_PRICE.annual}{" "}
            a year or {CATALOGUE_PRICE.lifetime} once
            {installers && installers >= MIN_SHOWN
              ? ` · ${installers.toLocaleString("en-US")} developers installed snapcn components this month`
              : ""}
          </span>
        </div>
        {rest ? (
          <>
            <h2 id="how-it-moves">How it moves</h2>
            <p>{rest}</p>
          </>
        ) : null}
        <h2 id="installation">Installation</h2>
        <InstallBlock name={slug} />
        <FaqSection questions={questions} />
      </DocsBody>
      <RelatedComponents slug={slug} />
      <DocsNewsletterCta />
    </article>
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
