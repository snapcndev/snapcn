import { collectDocsPages, pageMarkdown, SITE_URL } from "@/lib/llms";

export const dynamic = "force-static";

/**
 * Any docs URL with `.md` appended, as plain markdown.
 *
 * `next.config.ts` rewrites `/docs/:path*.md` here; nothing links to
 * `/docs-md/*` and it is not in the sitemap, so the public URL stays the docs
 * URL an agent already has.
 *
 * ## Why
 *
 * Appending `.md` is the convention coding agents try first, and until now
 * snapcn answered it with a 200 and forty-seven kilobytes of React shell —
 * the same failure mode `unknownComponent` in middleware.ts was written to fix,
 * one layer up. An agent that spends its context on `<script>` tags does not
 * get to the install command at the bottom of the page.
 *
 * The bytes are `pageMarkdown`, the same function `/llms-full.txt` emits, so a
 * page fetched on its own and the same page inside the corpus can never
 * disagree.
 */
export function generateStaticParams() {
  return collectDocsPages()
    .filter((page) => page.url !== "/docs")
    .map((page) => ({ slug: page.url.replace("/docs/", "").split("/") }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await params;
  const url = slug?.length ? `/docs/${slug.join("/")}` : "/docs";
  const page = collectDocsPages().find((entry) => entry.url === url);

  // Answer a miss in the language it was asked in, as the registry 404 does.
  if (!page) {
    return new Response(
      `# Not found\n\nThere is no snapcn docs page at \`${url}\`.\nEvery page: ${SITE_URL}/llms.txt\nEvery component: ${SITE_URL}/llms-components.txt\n`,
      {
        status: 404,
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      },
    );
  }

  return new Response(`${pageMarkdown(page)}\n`, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
