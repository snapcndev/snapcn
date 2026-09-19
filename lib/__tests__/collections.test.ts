import { expect, test } from "vitest";
import { PRO_NAMES } from "@/config/site";
import { COLLECTIONS, collectionItems } from "@/lib/collections";
import { GALLERY_ITEMS } from "@/lib/gallery-data";

const freeNames = new Set(
  GALLERY_ITEMS.map((i) => i.href.split("/").pop() as string),
);
const known = new Set([...freeNames, ...PRO_NAMES]);

test("every collection member is a component that exists", () => {
  // `collectionItems` resolves against the live catalogue and silently drops
  // anything it cannot find — which is right for a paid component with no CDN
  // configured, and catastrophic for a typo. This is the difference.
  for (const collection of COLLECTIONS) {
    for (const name of collection.names) {
      expect(known.has(name), `${collection.slug}: "${name}"`).toBe(true);
    }
  }
});

test("every collection has a free member to print an install command for", () => {
  // `CollectionDoc` falls back to the first member when there is no free one,
  // which would put a name that 402s into a copyable command.
  for (const collection of COLLECTIONS) {
    const hasFree = collection.names.some((n) => freeNames.has(n));
    expect(hasFree, collection.slug).toBe(true);
  }
});

test("collections have unique slugs and a query each, and resolve in order", () => {
  const slugs = new Set<string>();
  for (const collection of COLLECTIONS) {
    expect(slugs.has(collection.slug), collection.slug).toBe(false);
    slugs.add(collection.slug);
    expect(collection.query.startsWith("Remotion "), collection.slug).toBe(
      true,
    );
    expect(collection.names.length).toBeGreaterThan(1);

    // Whatever survives resolution keeps the curated order.
    const resolved = collectionItems(collection).map(
      (i) => i.href.split("/").pop() as string,
    );
    expect(resolved).toEqual(
      collection.names.filter((n) => resolved.includes(n)),
    );
  }
});
