/**
 * The paid components in the gallery — lib/gallery-data.ts.
 *
 * Run with:  pnpm vitest run lib/__tests__/pro-gallery.test.ts
 *
 * Two bugs are pinned here, and they pull in opposite directions.
 *
 * The first is the paid work never being seen: the whole point of interleaving
 * is that a pro card turns up between free ones, so "all fourteen appended to
 * the end" has to fail.
 *
 * The second is the paid work leaking into the free lists. `GALLERY_ITEMS` is
 * counted on the landing page, in the FAQ, in the changelog, in the sitemap and
 * in llms.txt, and every one of those is a claim about what is free, MIT and
 * installable. A pro component in any of them is a lie in a place nobody would
 * think to look.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const CDN = "https://pro.example.com";

/** gallery-data reads the CDN origin at module scope, so each case re-imports. */
async function load(base: string | undefined) {
  vi.resetModules();
  if (base === undefined) vi.stubEnv("NEXT_PUBLIC_PRO_DEMO_BASE", "");
  else vi.stubEnv("NEXT_PUBLIC_PRO_DEMO_BASE", base);
  return await import("@/lib/gallery-data");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("with a CDN configured", () => {
  it("lists every published pro component", async () => {
    const { PRO_GALLERY_ITEMS } = await load(CDN);
    const { PRO_NAMES } = await import("@/config/site");
    const listed = PRO_GALLERY_ITEMS.map((item) =>
      item.href.split("/").pop(),
    ).sort();
    expect(listed).toEqual([...PRO_NAMES].sort());
  });

  it("marks them paid, and gives each one its own address", async () => {
    const { PRO_GALLERY_ITEMS } = await load(CDN);
    const { PRO_ITEMS } = await import("@/config/site");
    const joined = new Map(PRO_ITEMS.map((i) => [i.name, i.added]));
    for (const item of PRO_GALLERY_ITEMS) {
      expect(item.pro).toBe(true);
      // Its own docs page, under the category it is filed in — the URL the
      // docs route, the sitemap and the category index all link to.
      const slug = item.href.split("/").pop() ?? "";
      expect(item.href).toBe(`/docs/${item.category}/${slug}`);
      // Dated the day the catalogue went into the grid, or the later day the
      // component joined it, so the changelog never backdates one — see
      // `itemsByReleaseDate`.
      expect(item.added).toBe(joined.get(slug) ?? "2026-09-12");
    }
    const hrefs = new Set(PRO_GALLERY_ITEMS.map((i) => i.href));
    expect(hrefs.size).toBe(PRO_GALLERY_ITEMS.length);
  });

  it("spreads them through the free work rather than parking them at the end", async () => {
    const { CATALOGUE_ITEMS, GALLERY_ITEMS, PRO_GALLERY_ITEMS } =
      await load(CDN);
    expect(CATALOGUE_ITEMS).toHaveLength(
      GALLERY_ITEMS.length + PRO_GALLERY_ITEMS.length,
    );

    const at = CATALOGUE_ITEMS.flatMap((item, i) => (item.pro ? [i] : []));
    expect(at).toHaveLength(PRO_GALLERY_ITEMS.length);
    // Spread over the whole grid rather than bunched at one end — the bug a
    // whole-number gap produced was fourteen paid cards in the first two thirds
    // and none at all in the last. Never two in a row while there is a free card
    // to put between them; once paid outnumbers free, only the surplus may pair
    // up, and never three.
    expect(Math.min(...at)).toBeLessThan(CATALOGUE_ITEMS.length / 4);
    expect(Math.max(...at)).toBeGreaterThan((CATALOGUE_ITEMS.length * 3) / 4);
    const pairs = at.filter(
      (pos, i) => i > 0 && pos - (at[i - 1] ?? -2) === 1,
    ).length;
    expect(pairs).toBeLessThanOrEqual(
      Math.max(0, PRO_GALLERY_ITEMS.length - GALLERY_ITEMS.length),
    );
    for (let i = 2; i < at.length; i++) {
      expect((at[i] ?? 0) - (at[i - 2] ?? 0)).toBeGreaterThan(2);
    }
  });

  it("keeps the free list in its curated order", async () => {
    const { CATALOGUE_ITEMS, GALLERY_ITEMS } = await load(CDN);
    const free = CATALOGUE_ITEMS.filter((item) => !item.pro);
    expect(free.map((i) => i.href)).toEqual(GALLERY_ITEMS.map((i) => i.href));
  });

  it("never lets a paid component into a list that means free", async () => {
    const { GALLERY_ITEMS, GALLERY_COUNT, NEW_ITEMS, itemsByReleaseDate } =
      await load(CDN);
    expect(GALLERY_ITEMS.some((i) => i.pro)).toBe(false);
    expect(GALLERY_COUNT).toBe(GALLERY_ITEMS.length);
    expect(NEW_ITEMS.some((i) => i.pro)).toBe(false);
    // The default is the free list, which is what the RSS feed publishes — it
    // promises things a reader can go and install.
    expect(
      itemsByReleaseDate().some((day) => day.items.some((i) => i.pro)),
    ).toBe(false);
  });

  it("dates the paid catalogue into the changelog when asked for it", async () => {
    const { CATALOGUE_ITEMS, CATALOGUE_COUNT, itemsByReleaseDate } =
      await load(CDN);
    const days = itemsByReleaseDate(CATALOGUE_ITEMS);
    const listed = days.flatMap((day) => day.items);
    expect(listed.filter((i) => i.pro).length).toBe(
      CATALOGUE_ITEMS.filter((i) => i.pro).length,
    );
    // Nothing undated: the page prints a warning line when this stops holding.
    expect(listed).toHaveLength(CATALOGUE_COUNT);
  });

  it("filters and deep links reach a pro card like any other", async () => {
    const { getFilteredItems, ITEM_BY_SLUG, PRO_GALLERY_ITEMS } =
      await load(CDN);
    for (const item of PRO_GALLERY_ITEMS) {
      const slug = item.href.split("/").pop() ?? "";
      expect(ITEM_BY_SLUG.get(slug)).toBe(item);
      expect(getFilteredItems(item.category)).toContain(item);
    }
  });

  it("resolves a pro page from any category the CLI's docs link names", async () => {
    const { PRO_GALLERY_ITEMS, proItemBySlugs } = await load(CDN);
    const item = PRO_GALLERY_ITEMS.find((i) => i.category === "charts");
    expect(item).toBeDefined();
    const slug = item?.href.split("/").pop() ?? "";
    // The pro registry's docs links say `scenes` for most of them; the page
    // redirects those to `item.href`, so the lookup must not care.
    expect(proItemBySlugs(["scenes", slug])).toBe(item);
    expect(proItemBySlugs(["charts", slug])).toBe(item);
    // Free components and bare slugs are the MDX route's, never this one's.
    expect(proItemBySlugs(["text", "text-reveal"])).toBeNull();
    expect(proItemBySlugs([slug])).toBeNull();
  });

  it("plays a hashed video off the CDN", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_PRO_DEMO_BASE", `${CDN}/`);
    const { proDemoSrc } = await import("@/lib/pro-demos");
    const { PRO_NAMES } = await import("@/config/site");
    for (const slug of PRO_NAMES) {
      // The trailing slash on the base is stripped, never doubled.
      expect(proDemoSrc(slug)).toMatch(
        new RegExp(`^${CDN}/${slug}\\.mp4\\?v=[0-9a-f]{10}$`),
      );
    }
  });
});

describe("with no CDN", () => {
  it("shows no pro cards at all, rather than fourteen grey boxes", async () => {
    const { CATALOGUE_ITEMS, GALLERY_ITEMS, PRO_GALLERY_ITEMS } =
      await load(undefined);
    expect(PRO_GALLERY_ITEMS).toEqual([]);
    expect(CATALOGUE_ITEMS).toEqual(GALLERY_ITEMS);
  });

  it("hands out no pro URLs", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_PRO_DEMO_BASE", "");
    const { proDemoSrc } = await import("@/lib/pro-demos");
    expect(proDemoSrc("manifesto")).toBeNull();
  });
});
