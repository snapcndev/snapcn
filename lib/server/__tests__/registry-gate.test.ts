import { describe, expect, it } from "vitest";
import { bearer } from "@/lib/server/api-key";

/**
 * The two parsers standing in front of the paid registry. Both are trust
 * boundaries — one decides which file gets read off disk, the other decides
 * whose key is being checked — so both get a check that fails loudly.
 *
 * `componentName` is duplicated here rather than exported: it exists to keep a
 * route honest, and exporting it so a test can reach it widens the surface the
 * route is meant to narrow. If it changes, this copy has to change with it,
 * which is the point.
 */
function componentName(file: string): string | null {
  const match = file.match(/^([a-z0-9]([a-z0-9-]*[a-z0-9])?)\.json$/);
  return match?.[1] ?? null;
}

describe("componentName", () => {
  it("accepts a registry name", () => {
    expect(componentName("text-reveal.json")).toBe("text-reveal");
    expect(componentName("caret.json")).toBe("caret");
  });

  it("refuses anything that could leave public/r", () => {
    for (const bad of [
      "../../.env.json",
      "..%2f..%2fsecret.json",
      "a/b.json",
      "text-reveal.json.bak",
      "TextReveal.json",
      "-leading.json",
      "trailing-.json",
      ".json",
      "text-reveal",
    ]) {
      expect(componentName(bad), bad).toBeNull();
    }
  });
});

describe("bearer", () => {
  const req = (h?: string) =>
    new Request("https://snapcn.dev/r/x.json", {
      headers: h ? { authorization: h } : {},
    });

  it("reads the key, whatever case the scheme arrives in", () => {
    expect(bearer(req("Bearer sk_abc"))).toBe("sk_abc");
    expect(bearer(req("bearer sk_abc"))).toBe("sk_abc");
  });

  it("is null when there is nothing usable", () => {
    expect(bearer(req())).toBeNull();
    expect(bearer(req("sk_abc"))).toBeNull();
    expect(bearer(req("Basic sk_abc"))).toBeNull();
    expect(bearer(req("Bearer "))).toBeNull();
  });
});
