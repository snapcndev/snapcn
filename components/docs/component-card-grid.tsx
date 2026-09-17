import { ComponentCard } from "./component-card";

export interface CardItem {
  name: string;
  description: string;
  status: "stable" | "soon";
  href?: string;
  /** Paid: no registry config to mount, only the video on the CDN. */
  pro?: boolean;
}

/**
 * A grid, not `columns-*`. Every card is its composition's 16:9 frame and
 * nothing else, so there is no ragged edge for a masonry to pack — and CSS
 * multicol packs greedily, which leaves the last column short and a column-wide
 * hole down the right of the page. Row-major puts the only hole at the tail.
 */
export function ComponentCardGrid({ items }: { items: CardItem[] }) {
  return (
    <div className="not-prose my-8 grid grid-cols-1 items-start gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <ComponentCard key={item.name} item={item} />
      ))}
    </div>
  );
}
