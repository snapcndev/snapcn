import { describe, expect, it } from "vitest";
import { proRedirect } from "@/lib/pro-redirect";

const href = (slug: string) =>
  slug === "manifesto" ? "/docs/text/manifesto" : undefined;

describe("proRedirect — every /pro address printed into a terminal still lands", () => {
  it("sends the 402's component link to that component's page, keeping ref", () => {
    expect(proRedirect({ c: "manifesto", ref: "cli" }, href)).toBe(
      "/docs/text/manifesto?ref=cli",
    );
  });

  it("sends a bare or unknown /pro to the pricing page", () => {
    expect(proRedirect({}, href)).toBe("/docs/pricing");
    expect(proRedirect({ ref: "cli" }, href)).toBe("/docs/pricing?ref=cli");
    expect(proRedirect({ c: "not-a-component" }, href)).toBe("/docs/pricing");
  });

  it("sends a buyer back from checkout to their keys", () => {
    expect(proRedirect({ checkout: "done", ref: "x" }, href)).toBe(
      "/account?checkout=done",
    );
  });
});
