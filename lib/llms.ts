import fs from "node:fs";
import path from "node:path";
import { GALLERY_CATEGORIES, GALLERY_ITEMS } from "./gallery-data";

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

export function collectDocsPages(): LlmsPage[] {
  const pages: LlmsPage[] = [componentsGalleryPage()];

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

export const LLMS_HEADER = `# snapcn

> snapcn is a shadcn-style registry of production-ready video components for Remotion (React). Developers install components with \`npx shadcn@latest add @snapcn/<component>\`; the source and everything it depends on is copied into their project and they own the code. Typical use: building product demo videos, launch videos and social clips in React.

Prerequisites: an existing Remotion project (\`npx create-video@latest\`) and the shadcn CLI. License: MIT. Author: Sri Nath (https://x.com/SriNath693). Site: ${SITE_URL}
`;
