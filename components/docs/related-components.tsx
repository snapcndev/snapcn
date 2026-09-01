import Link from "next/link";
import { GALLERY_ITEMS } from "@/lib/gallery-data";

/**
 * The other components in this one's category, linked.
 *
 * Every component page was an orphan. All thirty-nine are in the sitemap, all
 * of them are aimed at a search like "remotion karaoke captions", and **not one
 * of them linked to another** — the only paths between them were the category
 * index and the sitemap itself. That is the cheapest on-page thing a docs site
 * can get wrong: internal links are how a crawler learns which pages are
 * related and worth spending budget on, and a page nothing links to reads as a
 * page nothing vouches for.
 *
 * Rendered from the page layout rather than added to thirty-nine MDX files, so
 * a new component is linked from its neighbours the moment it is in
 * `GALLERY_ITEMS` — and nobody has to remember to come back here.
 *
 * It earns its place for readers too. Somebody who landed cold on one component
 * from a search has no idea the other six in its category exist; this is the
 * only thing on the page that tells them.
 */
export function RelatedComponents({ slug }: { slug: string }) {
  const current = GALLERY_ITEMS.find((i) => i.href.endsWith(`/${slug}`));
  if (!current) return null;

  const siblings = GALLERY_ITEMS.filter(
    (i) => i.category === current.category && i.href !== current.href,
  ).slice(0, 6);
  if (siblings.length === 0) return null;

  return (
    <nav className="mt-14 border-border border-t pt-8">
      <h2 className="mb-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
        More in this category
      </h2>
      <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {siblings.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group block no-underline"
              // The description is the anchor's context for a crawler and the
              // reason to click for a reader; both want it in the markup.
            >
              <span className="font-medium text-foreground text-sm group-hover:underline">
                {item.name}
              </span>
              <span className="mt-0.5 block text-muted-foreground text-xs leading-relaxed">
                {item.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
