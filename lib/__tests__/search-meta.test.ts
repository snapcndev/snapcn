import { expect, test } from "vitest";
import { GALLERY_ITEMS } from "@/lib/gallery-data";
import { firstSentence, searchMeta } from "@/lib/structured-data";

const page = { title: "Text Reveal", description: "A zoom-out title" };

test("a component page carries its category's query", () => {
  expect(searchMeta(["text", "text-swell"], page, "text")).toEqual({
    title: "Text Reveal — Remotion text animation",
    description:
      "Remotion text animation for React, installed with shadcn. A zoom-out title",
  });
  // A component with a narrower query of its own carries that instead.
  expect(searchMeta(["charts", "scatter-bloom"], page, "charts").title).toBe(
    "Text Reveal — Remotion scatter plot animation",
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
