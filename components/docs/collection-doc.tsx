import Link from "next/link";
import { collectionBySlug, collectionItems } from "@/lib/collections";
import { ComponentCardGrid } from "./component-card-grid";
import { InstallBlock } from "./install-block";

/**
 * The body of a collection page: what is in it, and how to install one.
 *
 * Deliberately shorter than `CategoryDoc`. A category index is where somebody
 * who already knows what snapcn is browses a tier of the catalogue, so it earns
 * the usage snippet and the composition boilerplate. A collection page is
 * arrived at from a search for a *thing* — "remotion iphone mockup" — and what
 * that reader needs is to see the thing, then the one line that installs it.
 * The rest is a click away on the component's own page, which is the page that
 * should rank second for the same query.
 *
 * Everything is resolved from `lib/collections.ts` by slug, so a page is one
 * `<Collection slug="…" />` and there is no second copy of the member list to
 * drift.
 */
export function CollectionDoc({ slug }: { slug: string }) {
  const collection = collectionBySlug(slug);
  if (!collection) return null;

  const items = collectionItems(collection);
  if (items.length === 0) return null;

  const free = items.filter((item) => !item.pro);
  const pro = items.length - free.length;
  // The install example is the first free member: a paid name in a copyable
  // command is a line that 402s for most readers.
  const leadSlug = (free[0] ?? items[0]).href.split("/").pop() as string;

  return (
    <>
      <h2 id="components">The components</h2>
      <p>
        {free.length === 1
          ? `One free ${collection.query}`
          : `${free.length} free ${collection.query}s`}
        {pro > 0 ? `, plus ${pro} in Pro` : ""}. Each card plays its own scene —
        open one for its props, the source <code>shadcn add</code> writes, and a
        player you can scrub frame by frame.
      </p>

      <ComponentCardGrid
        items={items.map((item) => ({
          name: item.name,
          description: item.description,
          status: "stable" as const,
          href: item.href,
          pro: item.pro,
        }))}
      />

      <h2 id="install">Install</h2>
      <p>
        Each one is copied into your own Remotion project by the shadcn CLI, and
        the file it writes is yours to edit — there is no snapcn package to
        depend on.{" "}
        <Link href="/docs/getting-started/installation">
          Set the registry up once
        </Link>
        , then add components by name:
      </p>

      <InstallBlock name={leadSlug} />

      <p>
        Swap the name for any other component on this page. Every prop has a
        working default, so it renders the moment it is mounted.
      </p>
    </>
  );
}
