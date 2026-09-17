import type { ReactElement } from "react";
import { installCommand } from "@/config/site";
import {
  type CategoryId,
  GALLERY_COUNT,
  type GalleryItem,
  PRO_GALLERY_ITEMS,
} from "@/lib/gallery-data";
import { CATALOGUE_PRICE } from "@/lib/plans";

/**
 * The JSON-LD boilerplate, once.
 *
 * The MDX docs route and the components gallery each build a `@graph` and
 * hand-roll the same `<script type="application/ld+json">` around it. The four
 * bespoke `(gallery)` routes emitted nothing at all — a video editor, a video
 * gallery, a dated changelog and a roadmap, none of them machine-readable. This
 * is what they now share.
 */

export const SITE_URL = "https://snapcn.dev";

export const PUBLISHER = {
  "@type": "Organization",
  name: "snapcn",
  url: SITE_URL,
} as const;

/**
 * Docs → Page. Two levels, because that is what these routes are — a flat
 * section under `/docs`, not a nested tree.
 */
export function docsBreadcrumb(title: string, path: string) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Docs",
        item: `${SITE_URL}/docs`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: title,
        item: `${SITE_URL}${path}`,
      },
    ],
  };
}

/**
 * What someone searching for a category types — not what the sidebar calls it.
 *
 * A component page was titled with its name alone ("Text Reveal · snapcn"), and
 * nobody searches for a name they have never heard. They search "remotion text
 * animation"; the name is what they learn once they land. Every phrase ends in a
 * count noun, so a category index pluralises it with an "s".
 */
export const CATEGORY_QUERY: Record<CategoryId, string> = {
  text: "Remotion text animation",
  captions: "Remotion subtitle animation",
  logos: "Remotion logo animation",
  screens: "Remotion product demo animation",
  charts: "Remotion chart animation",
  social: "Remotion social proof animation",
  // "remotion templates" is contested; "remotion launch video template" is not,
  // and it is what a scene is for.
  scenes: "Remotion launch video template",
  "ai-input": "Remotion AI chat animation",
};

/**
 * The narrower query, where a component answers one better than its category.
 *
 * From reading the live results (2026-09-15), not guessed: Remotion's own
 * Elements library holds the plain "remotion bar chart", "remotion counter" and
 * "remotion captions" results, and nothing at all ranks for "remotion scatter
 * plot animation", "remotion iphone mockup" or "remotion terminal animation".
 * A component page wins the specific search or none. snapcn already sits #5
 * for "remotion text reveal word by word" and for karaoke captions, so those
 * keep their words.
 */
const COMPONENT_QUERY: Record<string, string> = {
  "text-reveal": "Remotion word-by-word text reveal",
  "type-morph": "Remotion typewriter effect",
  "word-wheel": "Remotion rotating words animation",
  "karaoke-captions": "Remotion karaoke captions",
  "word-captions": "Remotion TikTok-style captions",
  "phone-frame": "Remotion iPhone mockup",
  "laptop-frame": "Remotion MacBook mockup",
  "terminal-simulator": "Remotion terminal animation",
  "cursor-track": "Remotion cursor click animation",
  "screen-recording": "Remotion screen recording zoom",
  "follower-rush": "Remotion follower count animation",
  "scatter-bloom": "Remotion scatter plot animation",
  "ticker-climb": "Remotion line chart animation",
  "metric-morph": "Remotion bar chart animation",
  "hex-tally": "Remotion unit chart animation",
  "tally-rise": "Remotion counter animation",
  "vault-count": "Remotion number counter animation",
};

/** The query a component page carries: its own, or its category's. */
export function componentQuery(slug: string, category: CategoryId): string {
  return COMPONENT_QUERY[slug] ?? CATEGORY_QUERY[category];
}

/**
 * Title and meta description for a docs page, carrying that query.
 *
 * A component is `<Name> — <query>`, a category index `<Label> — <query>s`, and
 * a guide keeps its own title. The description leads with the same words because
 * Google bolds the query where the snippet contains it — and the frontmatter
 * descriptions describe the motion, which nobody types.
 */
export function searchMeta(
  slugs: string[],
  page: { title: string; description: string },
  category?: CategoryId,
): { title: string; description: string } {
  const index = slugs.length === 1 && Object.hasOwn(CATEGORY_QUERY, slugs[0]);
  const query = category
    ? componentQuery(slugs.at(-1) ?? "", category)
    : index
      ? `${CATEGORY_QUERY[slugs[0] as CategoryId]}s`
      : null;
  if (!query) return { title: page.title, description: page.description };
  return {
    title: `${page.title} — ${query}`,
    description: `${query} for React, installed with shadcn. ${page.description}`,
  };
}

/**
 * Per-component Q&A — rendered on the page *and* emitted as FAQPage.
 *
 * It used to be schema only: a FAQPage for questions no reader could see, which
 * is the one thing Google's structured-data rules forbid, and invisible to an
 * answer engine that reads the HTML rather than the JSON-LD. Both now come from
 * this list, so the visible answer and the schema cannot disagree.
 *
 * "How do I add <component>" is the query this registry exists to win and the
 * install command is the conversion, so it goes first. Backticks mark inline
 * code: the page renders them as `<code>`, the schema strips them.
 */
export function componentQuestions(slug: string, item: GalleryItem) {
  const what = {
    question: `What is ${item.name}?`,
    answer: `${item.name} is a ${componentQuery(slug, item.category)} for React. ${firstSentence(item.description)}`,
  };

  // A paid component is the same install and the same ownership; what a buyer
  // actually needs answered is the price, and it is the question a free page
  // answers with "MIT".
  if (item.pro) {
    return [
      {
        question: `How do I add ${item.name} to a Remotion project?`,
        answer: `${item.name} is part of snapcn Pro, and installs with the same shadcn CLI as every free component: \`${installCommand(slug)}\`. The source is copied into your project and is yours to edit — there is no runtime package to keep installed.`,
      },
      what,
      {
        question: `Is ${item.name} free?`,
        answer: `No. It is one of ${PRO_GALLERY_ITEMS.length} Pro components, sold together: ${CATALOGUE_PRICE.annual} a year for the whole catalogue and everything that ships while your year runs, or ${CATALOGUE_PRICE.lifetime} once to own it outright. The other ${GALLERY_COUNT} snapcn components are free and MIT.`,
      },
    ];
  }

  return [
    {
      question: `How do I add ${item.name} to a Remotion project?`,
      answer: `Run \`${installCommand(slug)}\`. The source is copied into \`components/snap-cn/\` (or wherever your \`components.json\` points) with anything it depends on, and you own the code from then on — there is no runtime package to keep installed.`,
    },
    what,
    {
      question: `What do I need before using ${item.name}?`,
      answer:
        "An existing Remotion project (`npx create-video@latest`) with a `components.json`. `shadcn init` does not recognise Remotion, so the installation guide has you write that file by hand — it takes two minutes. The component is MIT licensed and free.",
    },
  ];
}

/**
 * The first sentence, closed with a full stop.
 *
 * A free description is one unpunctuated sentence; a pro one is a paragraph of
 * choreography. Both need a one-line summary for a meta description or an
 * answer. A stop only counts before a space or the end, so "0.86x" and "1.633s"
 * do not end one.
 */
export function firstSentence(text: string): string {
  const sentence = text.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? text;
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

export function faqPage(
  url: string,
  questions: { question: string; answer: string }[],
) {
  return {
    "@type": "FAQPage",
    "@id": `${SITE_URL}${url}#faq`,
    mainEntity: questions.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer.replaceAll("`", "") },
    })),
  };
}

export function JsonLd({
  graph,
}: {
  graph: Record<string, unknown>[];
}): ReactElement {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is serialized JSON, not markup
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": graph,
        }),
      }}
    />
  );
}
