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

  // The paid half. Free components were the first to get a query because
  // they were the first to be indexed; a Pro page carries the same title and
  // the same meta description, built by the same `searchMeta()`, and without
  // an entry here all 9 `scenes` components shipped the one category phrase
  // and competed with each other for it. None of these names duplicates a
  // `/elements/` slug — checked against remotion.dev's sitemap, see the
  // CATEGORY_QUERY note above.
  "agent-chat": "Remotion AI chat conversation animation",
  "agent-open": "Remotion AI assistant intro animation",
  "agent-run": "Remotion AI agent demo animation",
  "agent-tools": "Remotion AI agent tools animation",
  "task-stream": "Remotion AI agent task list animation",
  "glass-prompt": "Remotion glass prompt animation",
  "app-reveal": "Remotion app reveal animation",
  "brief-send": "Remotion product brief animation",
  "build-out": "Remotion AI app build animation",
  "chat-thread": "Remotion chat thread animation",
  "checkout-push": "Remotion checkout animation",
  "comment-storm": "Remotion comment feed animation",
  "cross-out": "Remotion strikethrough text animation",
  "files-drop": "Remotion file upload animation",
  "focus-pull": "Remotion focus pull text animation",
  "gallery-push": "Remotion screenshot wall animation",
  "laptop-open": "Remotion MacBook open animation",
  "lcd-type": "Remotion LED screen text animation",
  "library-flight": "Remotion product tour flythrough",
  "lockup-reveal": "Remotion logo lockup reveal",
  manifesto: "Remotion kinetic typography scene",
  "orbit-flow": "Remotion orbit diagram animation",
  "pack-up": "Remotion product launch outro",
  "phone-pitch": "Remotion iPhone pitch shot",
  "phrase-swarm": "Remotion word swarm animation",
  "picker-commit": "Remotion picker wheel animation",
  "prompt-dive": "Remotion send button zoom animation",
  "proof-line": "Remotion portfolio proof animation",
  "read-through": "Remotion big text pan animation",
  "render-wall": "Remotion code to video animation",
  "say-it": "Remotion word to button animation",
  "screen-wall": "Remotion phone wall animation",
  "sentence-set": "Remotion word-by-word sentence animation",
  "showcase-drift": "Remotion showcase wall animation",
  "stretch-word": "Remotion stretched text animation",
  "string-hero": "Remotion code typing animation",
  "tap-through": "Remotion phone tap animation",
  "thank-you-swarm": "Remotion supporter wall animation",
  "version-drop": "Remotion version release animation",
  "wall-cut": "Remotion LED wall animation",
  "wire-feed": "Remotion live feed animation",
  "word-montage": "Remotion photo montage animation",
  "word-rush": "Remotion word tunnel animation",
  "word-settle": "Remotion word settle text animation",

  // The free half's remaining components. Same reason as the paid block
  // below it: a category phrase shared by nine pages is nine pages
  // competing for one result.
  "word-gather": "Remotion out-of-order word animation",
  "punch-lines": "Remotion full-frame title cards",
  "text-swell": "Remotion floating word title animation",
  "text-highlight": "Remotion text highlight animation",
  "text-rewrite": "Remotion text rewrite animation",
  "text-select": "Remotion text selection animation",
  "text-swap": "Remotion text swap animation",
  "text-build": "Remotion reflowing text animation",
  "word-flip": "Remotion 3D word flip animation",
  "logo-collapse": "Remotion logo collapse animation",
  "logo-drift": "Remotion logo cloud animation",
  "logo-assemble": "Remotion logo assemble animation",
  "logo-flicker": "Remotion logo flicker intro",
  "block-wordmark": "Remotion wordmark animation",
  "card-rail": "Remotion card carousel animation",
  "orb-swarm": "Remotion kinetic typography with orbs",
  "count-grid": "Remotion stat card grid animation",
  "roster-grant": "Remotion access granted animation",
  "wordmark-cut": "Remotion wordmark end card",
  "announce-title": "Remotion launch title animation",
  "status-cycle": "Remotion status badge animation",
  "hero-launch": "Remotion product launch hero",
  "orbit-gallery": "Remotion orbit feature cards",
  "moodboard-reveal": "Remotion moodboard animation",
  "reel-collage": "Remotion photo collage animation",
  "channel-thread": "Remotion Slack chat animation",
  "search-typing": "Remotion search bar animation",
  "prompt-send": "Remotion AI prompt typing animation",
  "prompt-zoom": "Remotion AI prompt zoom animation",
  "answer-stream": "Remotion AI streaming answer animation",
  "answer-highlight": "Remotion AI answer highlight",
  "agent-steps": "Remotion AI agent steps animation",
};

/** The query a component page carries: its own, or its category's. */
export function componentQuery(slug: string, category: CategoryId): string {
  return COMPONENT_QUERY[slug] ?? CATEGORY_QUERY[category];
}

/**
 * Is this slug path a category index rather than a component or a guide?
 *
 * The one test, exported, because three readers now need it — `searchMeta`
 * pluralises the query for it, and the docs route hangs a category FAQ and an
 * `ItemList` off it. Three copies of `slugs.length === 1 && a CATEGORY_QUERY
 * lookup` is three places for a new category to be forgotten.
 */
export function isCategoryIndex(slugs: string[]): slugs is [CategoryId] {
  return slugs.length === 1 && Object.hasOwn(CATEGORY_QUERY, slugs[0]);
}

/**
 * A category's own FAQ — rendered on the page *and* emitted as FAQPage.
 *
 * Sibling to `componentQuestions`, and for the same reason: a hub page that
 * answers "how do I add one" is the page an answer engine can quote, and a
 * category index had nothing quotable on it at all. The questions are the ones
 * a person landing on "remotion text animations" from a search actually has —
 * how to install one, what it costs, and whether they need Remotion first.
 */
export function categoryQuestions(
  category: CategoryId,
  items: { name: string; href: string; pro?: boolean }[],
) {
  return collectionQuestions(CATEGORY_QUERY[category], items);
}

/**
 * The same three questions for any curated list, keyed by its phrase.
 *
 * A collection page (`/docs/collections/device-mockups`) is a hub exactly like
 * a category index, and the reader arriving at it from a search has the same
 * three questions. Splitting this from `categoryQuestions` is what stops the
 * second hub type shipping with no FAQ at all, the way the first one did.
 */
export function collectionQuestions(
  query: string,
  items: { name: string; href: string; pro?: boolean }[],
) {
  const free = items.filter((i) => !i.pro);
  const lead = free[0] ?? items[0];
  const leadSlug = lead ? lead.href.split("/").pop() : undefined;

  return [
    {
      question: `How do I add a ${query} to a Remotion project?`,
      answer: leadSlug
        ? `Every ${query} here installs with the shadcn CLI — \`${installCommand(leadSlug)}\` copies ${lead.name} into your project as a file you own, written against the plain Remotion API. There is no runtime package to keep installed.`
        : `Each one installs with the shadcn CLI, which copies the component into your project as a file you own.`,
    },
    {
      question: `Are snapcn's ${query}s free?`,
      answer: `${free.length} of them are MIT-licensed and free to use commercially${
        items.length > free.length
          ? `; the other ${items.length - free.length} are part of snapcn Pro — ${CATALOGUE_PRICE.annual} a year for the whole catalogue, or ${CATALOGUE_PRICE.lifetime} once to own it outright`
          : ""
      }.`,
    },
    {
      question: `Do I need Remotion to use a ${query}?`,
      answer: `Yes. snapcn is a component registry, not a video framework — each component is a React component built on Remotion's \`useCurrentFrame()\` and \`interpolate()\`, so it renders inside an existing Remotion project.`,
    },
  ];
}

/**
 * The category's components, as an `ItemList`.
 *
 * What a hub page *is*, said in the one vocabulary a crawler reads it in. The
 * grid on the page is already this list; without the schema it is a wall of
 * links, and the page competes for "remotion text animations" while describing
 * itself as a generic article.
 */
export function categoryItemList(
  category: CategoryId,
  items: { name: string; href: string; description: string }[],
) {
  return itemList(`${CATEGORY_QUERY[category]}s`, items);
}

/** The same list, for any hub that has a name for what it is listing. */
export function itemList(
  name: string,
  items: { name: string; href: string; description: string }[],
) {
  return {
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      description: firstSentence(item.description),
      url: `${SITE_URL}${item.href}`,
    })),
  };
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
  const index = isCategoryIndex(slugs);
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

/**
 * A post, as `BlogPosting`.
 *
 * `headline` is the reader's H1 and not the search title: the two diverge
 * whenever `seoTitle` is set, and schema that disagrees with the visible
 * heading is the mismatch Google's structured-data rules single out. The
 * `mainEntityOfPage` is what tells a crawler this URL is the article itself
 * rather than a page that merely mentions one — a blog index would otherwise
 * look like the same thing.
 */
export function blogPosting(post: {
  title: string;
  description?: string;
  date: Date;
  url: string;
}) {
  return {
    "@type": "BlogPosting",
    headline: post.title,
    ...(post.description ? { description: post.description } : {}),
    datePublished: post.date.toISOString(),
    author: PUBLISHER,
    publisher: PUBLISHER,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}${post.url}` },
    url: `${SITE_URL}${post.url}`,
  };
}
