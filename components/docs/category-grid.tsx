import { CATALOGUE_ITEMS, type CategoryId } from "@/lib/gallery-data";
import { ComponentCardGrid } from "./component-card-grid";

/**
 * Every component in one category, as the same preview cards the gallery uses.
 *
 * The category index pages used to be hand-written bullet lists of links —
 * a page about video components with no video on it, sitting one click from a
 * gallery full of playing previews. `/docs/social` was the only one that had
 * been converted, by pasting a card array into the MDX, which is the other
 * failure mode: a second copy of every name and description to keep in step with
 * `lib/gallery-data`.
 *
 * So the page says which category it is and nothing else. Add a component to
 * `GALLERY_ITEMS` and it appears on its category index, in the gallery, and in
 * the count in the sidebar, from the one edit.
 */
export function CategoryGrid({ category }: { category: CategoryId }) {
  // The paid work too, in the gallery's order: every pro component has a page
  // to link to, and `/docs/charts` holds nothing else.
  const items = CATALOGUE_ITEMS.filter(
    (item) => item.category === category,
  ).map((item) => ({
    name: item.name,
    description: item.description,
    // Everything in the catalogue has shipped — the gallery is the list of
    // what exists. Unbuilt things live in `ComingSoonPage`, not here.
    status: "stable" as const,
    href: item.href,
    pro: item.pro,
  }));

  return <ComponentCardGrid items={items} />;
}
