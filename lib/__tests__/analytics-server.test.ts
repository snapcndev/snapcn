import { describe, expect, it } from "vitest";
import { classifyClient } from "../analytics-server";

/**
 * `classifyClient` is what makes `registry_component_fetched` mean anything: it
 * separates a real install from a crawler and an agent. Get it wrong and the
 * headline number on the dashboard is wrong in a way nobody notices, because it
 * still looks like a plausible install count.
 *
 * The ordering cases below are the ones that actually bite — agent user-agents
 * that contain "bot", and agents that ship a full browser UA string.
 */
describe("classifyClient", () => {
  it("counts a bare shadcn/Node fetch as a CLI install", () => {
    expect(classifyClient(null)).toBe("cli");
    expect(classifyClient("node")).toBe("cli");
    expect(classifyClient("undici")).toBe("cli");
    expect(classifyClient("shadcn/4.11.0")).toBe("cli");
    expect(classifyClient("curl/8.4.0")).toBe("cli");
  });

  it("puts AI agents ahead of the bot and browser rules", () => {
    // Contains "bot" — must NOT be classified as a crawler.
    expect(classifyClient("PerplexityBot/1.0")).toBe("agent");
    expect(classifyClient("ChatGPT-User/1.0")).toBe("agent");
    expect(classifyClient("Claude-User/1.0")).toBe("agent");
    // Ships a full browser string — must NOT be classified as a browser.
    expect(
      classifyClient("Mozilla/5.0 (compatible; anthropic-ai/1.0; +http://x)"),
    ).toBe("agent");
    expect(classifyClient("Cursor/0.42 Chrome/120")).toBe("agent");
  });

  it("keeps crawlers out of the install count", () => {
    expect(classifyClient("Googlebot/2.1")).toBe("bot");
    expect(classifyClient("Mozilla/5.0 (compatible; bingbot/2.0)")).toBe("bot");
    expect(classifyClient("facebookexternalhit/1.1")).toBe("bot");
  });

  it("recognises a person looking at the JSON in a tab", () => {
    expect(
      classifyClient(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
      ),
    ).toBe("browser");
  });

  it("falls back rather than guessing", () => {
    expect(classifyClient("something-nobody-has-seen/1.0")).toBe("unknown");
  });
});

describe("classifyClient — registry indexers", () => {
  // Every string below was pulled from real traffic on 2026-09-19. Between
  // them they accounted for 390 ids and 2,737 events in 30 days, all of it
  // counted as installs, because none of them says "bot" and several contain
  // "mozilla" or start with "shadcn".
  const indexers = [
    "Mozilla/5.0 (compatible; registry-directory/1.0; +https://registry.directory)",
    "BlockDex/1.0 (+https://blockdex.thecompound.tech; indexes public shadcn registries; hello@thecompound.tech)",
    "VelustroRegistryBot/1.0 (+https://velustro-studio.pages.dev/?redirectTo=community; open-source index with attribution)",
    "bes-ui-universal-index/0.3",
    "sh4dcn-vendor (+https://sh4dcn.vercel.app)",
    "shadcn-registry-health/1.0",
    "shadcn-registry-corpus-collector/0.1 (+phase0)",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) GVideo-registry-fetch/1.0",
    "relay-fetch-corpus",
  ];

  for (const ua of indexers) {
    it(`counts ${ua.slice(0, 34)}… as a bot, not an install`, () => {
      expect(classifyClient(ua)).toBe("bot");
    });
  }

  it("still counts the real CLI, agents and browsers correctly", () => {
    // The whole point is not to win the bot fight by losing the install count.
    expect(classifyClient("shadcn")).toBe("cli");
    expect(classifyClient("node")).toBe("cli");
    expect(classifyClient("curl/8.7.1")).toBe("cli");
    expect(classifyClient("Claude-User/1.0")).toBe("agent");
    expect(
      classifyClient(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
      ),
    ).toBe("browser");
  });
});
