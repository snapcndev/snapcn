/**
 * Unit tests for `normalizeShareInput` in lib/server/shared-video.ts
 *
 * Run with:  pnpm vitest run lib/server/__tests__/shared-video.test.ts
 *
 * The rest of the module is Drizzle queries; this is the only part with
 * branching, and it sits on a trust boundary — every value here arrives in a
 * `fetch` body from the browser and ends up on a public page.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MAX_TITLE, normalizeShareInput } from "@/lib/server/shared-video";

describe("normalizeShareInput", () => {
  it("falls back to a title rather than storing an empty one", () => {
    for (const title of [undefined, null, "", "   ", 42, {}]) {
      expect(normalizeShareInput({ title }).title).toBe("Untitled video");
    }
  });

  it("trims and caps the title", () => {
    expect(normalizeShareInput({ title: "  Launch teaser  " }).title).toBe(
      "Launch teaser",
    );
    const long = "a".repeat(MAX_TITLE + 50);
    expect(normalizeShareInput({ title: long }).title).toHaveLength(MAX_TITLE);
  });

  it("keeps registry slugs and drops everything else", () => {
    // The teeth of this function: these values are rendered as text and as
    // `href`s on /v/<id>, so a path, a protocol or a tag must not survive.
    const { componentsUsed } = normalizeShareInput({
      componentsUsed: [
        "text-reveal",
        "phone-frame",
        "../../etc/passwd",
        "javascript:alert(1)",
        "<script>",
        "Text Reveal",
        "text_reveal",
        "",
        null,
        7,
      ],
    });
    expect(componentsUsed).toEqual(["text-reveal", "phone-frame"]);
  });

  it("distinguishes 'no list sent' from 'nothing in the list survived'", () => {
    // `undefined` writes SQL NULL; `[]` writes an empty array. The page reads
    // both as "no components", but conflating them here would mean a caller
    // that sent junk looked identical to one that sent nothing.
    expect(normalizeShareInput({}).componentsUsed).toBeUndefined();
    expect(normalizeShareInput({ componentsUsed: "nope" }).componentsUsed).toBe(
      undefined,
    );
    expect(normalizeShareInput({ componentsUsed: ["Nope!"] })).toMatchObject({
      componentsUsed: [],
    });
  });
});
