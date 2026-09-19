import { expect, test } from "vitest";
import {
  CATALOGUE_ITEMS,
  FREE_CATEGORIES,
  GALLERY_ITEMS,
  PRO_GALLERY_ITEMS,
} from "@/lib/gallery-data";
import {
  CATEGORY_QUERY,
  categoryItemList,
  categoryQuestions,
  componentQuery,
  firstSentence,
  searchMeta,
} from "@/lib/structured-data";

const page = { title: "Text Reveal", description: "A zoom-out title" };

test("a component page carries its own query, falling back to its category's", () => {
  expect(searchMeta(["charts", "scatter-bloom"], page, "charts")).toEqual({
    title: "Text Reveal — Remotion scatter plot animation",
    description:
      "Remotion scatter plot animation for React, installed with shadcn. A zoom-out title",
  });
  // The fallback is reachable only by a slug with no entry of its own. Every
  // shipped component now has one — the test below is what keeps that true —
  // so this needs a name that is not a component to exercise it at all.
  expect(searchMeta(["text", "not-a-component"], page, "text").title).toBe(
    "Text Reveal — Remotion text animation",
  );
});

test("a category index pluralises it; a guide keeps its own title", () => {
  expect(searchMeta(["text"], page).title).toBe(
    "Text Reveal — Remotion text animations",
  );
  expect(searchMeta(["getting-started", "installation"], page)).toEqual(page);
  expect(searchMeta(["constructor"], page)).toEqual(page);
});

test("every component's query survives a truncated search result", () => {
  // Google cuts a title near 60 characters. " · snapcn" is the part it may
  // drop; the name and the query are not.
  for (const item of GALLERY_ITEMS) {
    const { title } = searchMeta(
      item.href.split("/").slice(2),
      { title: item.name, description: item.description },
      item.category,
    );
    expect(title.length, title).toBeLessThanOrEqual(55);
  }
});

test("the first sentence ends at a stop before a space, not inside a number", () => {
  expect(
    firstSentence("The scene settles in from 0.86x. Then it cuts at 1.633s."),
  ).toBe("The scene settles in from 0.86x.");
  // Free descriptions are one unpunctuated sentence.
  expect(firstSentence("A zoom-out title")).toBe("A zoom-out title.");
});

test("every component carries its own query, and no two share one", () => {
  // A category phrase shared by nine pages is nine pages competing for one
  // result, so no component may fall back to it — and two components on the
  // same phrase is the same bug with extra steps. This is the check that a
  // component added next month does not silently rejoin either pile.
  const categoryPhrases = new Set(Object.values(CATEGORY_QUERY));
  const seen = new Map<string, string>();
  for (const item of [...GALLERY_ITEMS, ...PRO_GALLERY_ITEMS]) {
    const slug = item.href.split("/").pop() as string;
    const query = componentQuery(slug, item.category);

    expect(categoryPhrases.has(query), `${slug} has no query of its own`).toBe(
      false,
    );
    expect(seen.get(query), `${slug} duplicates ${seen.get(query)}`).toBe(
      undefined,
    );
    seen.set(query, slug);

    // Google cuts the title near 60 characters and " · snapcn" is the only
    // part it may drop, so the name and the query have to fit in 55 without it.
    expect(`${item.name} — ${query}`.length, item.name).toBeLessThanOrEqual(55);
  }
});

test("every category's FAQ and ItemList interpolate to real text", () => {
  // `CATALOGUE_PRICE` is an object of three prices, and dropping it into a
  // template literal whole rendered "a one-off [object Object]" into the
  // FAQPage schema of all eight category pages. Nothing else would have caught
  // it: the page built, the schema validated, and the sentence was wrong.
  for (const { id } of FREE_CATEGORIES) {
    const items = CATALOGUE_ITEMS.filter((i) => i.category === id);
    const questions = categoryQuestions(id, items);

    expect(questions.length).toBeGreaterThan(0);
    for (const { question, answer } of questions) {
      for (const text of [question, answer]) {
        expect(text, `${id}: ${text}`).not.toContain("[object Object]");
        expect(text, `${id}: ${text}`).not.toContain("undefined");
        expect(text, `${id}: ${text}`).not.toContain("NaN");
      }
    }

    const list = categoryItemList(id, items);
    expect(list.numberOfItems, id).toBe(items.length);
    expect(list.itemListElement.at(-1)?.position, id).toBe(items.length);
  }
});
