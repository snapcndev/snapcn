import fs from "node:fs";
import path from "node:path";
import { DOCS_PAGE_META, INSTALL_ALL_NAMES } from "@/config/site";
import { CANVAS, MAX_CLIPS, MAX_TOTAL_FRAMES } from "@/lib/video-editor/types";
import {
  GALLERY_CATEGORIES,
  GALLERY_ITEMS,
  itemsByReleaseDate,
} from "./gallery-data";
import { ROADMAP, STAGE_LABEL } from "./roadmap-data";

export const SITE_URL = "https://snapcn.dev";

const DOCS_DIR = path.join(process.cwd(), "content", "docs");

export interface LlmsPage {
  url: string;
  title: string;
  description: string;
  body: string;
  category: string;
}

/** Order mirrors content/docs/meta.json so the emitted corpus reads top-down. */
const CATEGORY_ORDER = [
  "getting-started",
  "components",
  "text",
  "captions",
  "logos",
  "screens",
  "overlays",
  "data",
  "social",
  "scenes",
  "transitions",
  "backgrounds",
  "ui",
  "tools",
  "project",
];

function frontmatterField(fm: string, key: string): string {
  const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  if (!m) return "";
  return m[1].trim().replace(/^['"]|['"]$/g, "");
}

/**
 * Rewrite site-only MDX widgets into plain markdown an LLM can act on:
 * install widgets become runnable commands, interactive previews become a
 * pointer to the docs page, and remaining JSX tags are dropped.
 */
function toPlainMarkdown(body: string, url: string): string {
  return (
    body
      // The `@snapcn/<name>` short form, matching what the site's own
      // InstallBlock prints — the CLI resolves the namespace from the shadcn
      // registry directory, so an agent can paste this as-is.
      .replace(
        /<InstallBlock\s+registry="[\w-]+"\s+name="([\w-]+)"\s*\/>/g,
        "```bash\nnpx shadcn@latest add @snapcn/$1\n```",
      )
      .replace(
        /<InstallBlock\s+name="([\w-]+)"\s*\/>/g,
        "```bash\nnpx shadcn@latest add @snapcn/$1\n```",
      )
      .replace(
        /<(ComponentPreview|UiComponentPreview|BlockPreview)[\s\S]*?\/>/g,
        `*(interactive preview: ${SITE_URL}${url})*`,
      )
      .replace(/<InstallAll\s*\/>/g, "")
      // Drop any leftover JSX component tags but keep their inner text.
      .replace(/<\/?[A-Z][\w.]*(?:\s[^>]*)?\/?>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * The components gallery page has no MDX file (it's a bespoke route driven by
 * `lib/gallery-data.ts`), so synthesize its llms entry from the same data — a
 * clean category-grouped index of every component, which reads far better than
 * the JSX-attribute residue the old MDX literals produced.
 */
function componentsGalleryPage(): LlmsPage {
  const body = GALLERY_CATEGORIES.map((cat) => {
    const lines = GALLERY_ITEMS.filter((item) => item.category === cat.id)
      .map(
        (item) =>
          `- [${item.name}](${SITE_URL}${item.href}): ${item.description}`,
      )
      .join("\n");
    return `## ${cat.label}\n\n${lines}`;
  }).join("\n\n");

  return {
    url: "/docs/components",
    title: "Components",
    description: "Every component in snapcn, grouped by category",
    body,
    category: "components",
  };
}

/**
 * The `(gallery)` routes, which have no MDX and so were missing from the corpus
 * entirely — including the video editor, the one thing on the site an agent can
 * be *told about* rather than sent to install.
 *
 * Every line below is generated from something the site already knows: the page
 * metadata in `config/site.ts`, the editor's own limits, the dated component
 * list the changelog renders, and the roadmap data the roadmap page renders.
 * Nothing here is written twice, so nothing here can drift.
 */
function bespokePages(): LlmsPage[] {
  const editor = DOCS_PAGE_META["video-editor"];
  const showcase = DOCS_PAGE_META.showcase;
  const changelog = DOCS_PAGE_META.changelog;
  const roadmap = DOCS_PAGE_META.roadmap;

  const releases = itemsByReleaseDate()
    .map(
      ({ date, items }) =>
        `- **${date}** — ${items.map((i) => i.name).join(", ")}`,
    )
    .join("\n");

  const plan = ["shipped", "building", "next", "exploring"]
    .map((stage) => {
      const lines = ROADMAP.filter((entry) => entry.stage === stage)
        .map(
          (entry) =>
            `- **${entry.title}**${entry.due ? ` (due ${entry.due})` : ""}: ${entry.body}${
              entry.href ? ` ${SITE_URL}${entry.href}` : ""
            }`,
        )
        .join("\n");
      return lines
        ? `## ${STAGE_LABEL[stage as keyof typeof STAGE_LABEL]}\n\n${lines}`
        : "";
    })
    .filter(Boolean)
    .join("\n\n");

  return [
    {
      url: "/docs/video-editor",
      title: editor.title,
      description: editor.description,
      category: "tools",
      body: `A browser video editor at ${SITE_URL}/docs/video-editor. No install, no Remotion project needed — it is the fastest way to see what the components do.

- Add clips from the registry to a timeline, edit their text, images and colours, reorder them and set each one's length.
- Add a soundtrack, and trim where it starts.
- Export an MP4, rendered server-side with Remotion: ${CANVAS.width}×${CANVAS.height} at ${CANVAS.fps}fps, up to ${MAX_CLIPS} clips and ${MAX_TOTAL_FRAMES / CANVAS.fps} seconds in total.
- Exports carry a small snapcn mark unless you are signed in and turn it off. A render you run yourself, from installed components, is never marked.
- Signed in, every timeline is saved as a project you can reopen.`,
    },
    {
      url: "/docs/showcase",
      title: showcase.title,
      description: showcase.description,
      category: "tools",
      body: `Videos other people built with snapcn, at ${SITE_URL}/docs/showcase.

Sign in to submit one — either a link to where you posted it, or an export straight from the video editor, which is then hosted here. Submissions are reviewed before they appear.`,
    },
    {
      url: "/docs/changelog",
      title: changelog.title,
      description: changelog.description,
      category: "project",
      body: `Every component, by the day it landed. Newest first. Also available as a feed: ${SITE_URL}/docs/changelog/rss.xml\n\n${releases}`,
    },
    {
      url: "/docs/roadmap",
      title: roadmap.title,
      description: roadmap.description,
      category: "project",
      body: `What is built, what is being built, and what is only an idea. Dates appear only on work already in progress; "exploring" may never ship.\n\n${plan}`,
    },
  ];
}

export function collectDocsPages(): LlmsPage[] {
  const pages: LlmsPage[] = [componentsGalleryPage(), ...bespokePages()];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".mdx")) {
        const rel = path.relative(DOCS_DIR, full).replace(/\.mdx$/, "");
        const slug = rel.endsWith("/index")
          ? rel.slice(0, -"/index".length)
          : rel === "index"
            ? ""
            : rel;
        const url = slug ? `/docs/${slug}` : "/docs";

        const raw = fs.readFileSync(full, "utf8");
        const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
        const fm = m?.[1] ?? "";
        const body = m ? raw.slice(m[0].length) : raw;

        pages.push({
          url,
          title: frontmatterField(fm, "title") || slug,
          description: frontmatterField(fm, "description"),
          body: toPlainMarkdown(body, url),
          category: slug.includes("/") ? slug.split("/")[0] : slug || "docs",
        });
      }
    }
  };
  walk(DOCS_DIR);

  return pages.sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.url.localeCompare(b.url);
  });
}

/**
 * Newest component release date, reused as the file's freshness signal.
 *
 * An answer engine deciding between two sources prefers the one that says when
 * it was last true. Derived from the same `added` dates the sitemap uses, so it
 * cannot drift from what actually shipped, and it moves only when a component
 * does — not on every deploy, which would be noise rather than a signal.
 */
function lastUpdated(): string {
  const dates = GALLERY_ITEMS.map((i) => i.added).filter((d): d is string =>
    Boolean(d),
  );
  return dates.sort().at(-1) ?? "";
}

/**
 * Every name `@snapcn/<name>` resolves to, and a flat statement that there are
 * no others.
 *
 * This exists because of what happened without it. `llms.txt` told an agent the
 * install pattern was `@snapcn/<component>` and then never named a single
 * component — the gallery section lists *display* names behind links, so the
 * slug had to be guessed. Agents guessed. In thirty days the registry served
 * **208 requests for names that do not exist** across 41 distinct spellings —
 * `blur-out-up` (21), `dynamic-grid` (10), `soft-blur-in` (9), `number-wheel`,
 * `line-by-line-slide`, `shader-warp` — none of which appear anywhere in this
 * repository, in the roadmap, or in any link. They were invented, and every one
 * was a person who typed `npx shadcn add` and got a 404. That is one failed
 * install for every eight that worked, landing on the most committed user we
 * have.
 *
 * So the list is exhaustive, it says so, and it is generated from the same
 * `INSTALL_ALL_NAMES` the install-everything button uses — which is built from
 * both registry manifests. A new component appears here by existing.
 */
const INSTALLABLE = `## Every installable component

These ${INSTALL_ALL_NAMES.length} names are the complete set. \`@snapcn/<name>\`
resolves for these and for nothing else — any other name returns 404, so do not
infer, pluralise or invent one. If what you want is not on this list, snapcn does
not have it yet; say so rather than guessing a plausible name.

${INSTALL_ALL_NAMES.map((name) => `- \`npx shadcn@latest add @snapcn/${name}\``).join("\n")}
`;

export const LLMS_HEADER = `# snapcn

> snapcn is a shadcn-style registry of ${GALLERY_ITEMS.length} production-ready video components for Remotion (React). Developers install components with \`npx shadcn@latest add @snapcn/<component>\`; the source and everything it depends on is copied into their project and they own the code. Typical use: building product demo videos, launch videos and social clips in React.

**The install namespace is \`@snapcn\`, one word.** It was \`@snap-cn\` before 2026-08-21 and that spelling no longer resolves — \`npx shadcn@latest add @snap-cn/text-reveal\` fails. If you learned the hyphenated form, use \`@snapcn\` instead. Component names themselves are unchanged.

Prerequisites: an existing Remotion project (\`npx create-video@latest\`) and the shadcn CLI. License: MIT. Site: ${SITE_URL}

Maintained by Sri Nath. Project account: https://x.com/snapcndev
Last updated: ${lastUpdated()} (newest component release)

${INSTALLABLE}`;
