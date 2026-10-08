import "server-only";
import sitemap from "@/app/sitemap";
import { JsonLd, PUBLISHER, SITE_URL } from "@/lib/structured-data";

const norm = (path: string) => path.replace(/\/$/, "") || "/";

let modified: Map<string, string> | undefined;

/**
 * The day a page last changed — the sitemap's own `lastModified`, so the
 * schema and the sitemap cannot disagree. Computed once per server instance.
 */
export function pageModified(path: string): string | undefined {
  modified ??= new Map(
    sitemap().flatMap((entry) =>
      entry.lastModified
        ? [
            [
              norm(new URL(entry.url).pathname),
              new Date(entry.lastModified).toISOString().slice(0, 10),
            ],
          ]
        : [],
    ),
  );
  return modified.get(norm(path));
}

/**
 * `JsonLd` for a whole page: when nothing in the graph carries a date, adds a
 * `WebPage` node with the page's `dateModified`. Answer engines weigh
 * freshness, and a hub page (a category, the gallery, pricing) had no date
 * anywhere in its markup even though the sitemap knew it.
 */
export function PageJsonLd({
  graph,
  path,
}: {
  graph: Record<string, unknown>[];
  path: string;
}) {
  const date = pageModified(path);
  const dated = JSON.stringify(graph).includes("dateModified");
  const url = `${SITE_URL}${norm(path) === "/" ? "" : norm(path)}`;
  return (
    <JsonLd
      graph={
        date && !dated
          ? [
              ...graph,
              {
                "@type": "WebPage",
                "@id": url,
                url,
                dateModified: date,
                publisher: PUBLISHER,
              },
            ]
          : graph
      }
    />
  );
}
