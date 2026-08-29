import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sourceHash } from "@/scripts/lib/source-hash.mts";
import { isCopy, stressCopy } from "@/scripts/motion-check.mts";

/**
 * `registry/__measured__.json` is a committed snapshot of numbers that came off
 * rendered frames — settle frame, copy capacity, detail coverage — and the MCP
 * merges them into `props.json`, where `snapcn_plan_video` bills beats from
 * them. Nothing regenerates on its own: `pnpm run measure` needs chromium
 * and takes minutes, so it is not in `pnpm test`.
 *
 * This is the thing that stops the snapshot lying. Same guard, same reason, as
 * `lib/demo-manifest.json` and the two stale-copy bugs this repo already paid
 * for: edit a component and its measured entry is detectably stale.
 */
const root = path.resolve(import.meta.dirname, "..", "..");
const file = path.join(root, "registry", "__measured__.json");

describe("registry/__measured__.json", () => {
  const entries: Record<string, { sourceHash: string }> = existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")).components ?? {})
    : {};
  const slugs = Object.keys(entries);

  it.skipIf(slugs.length === 0)(
    "has no entry measured against stale source",
    () => {
      const stale = slugs.filter(
        (s) => sourceHash(root, s) !== entries[s].sourceHash,
      );
      expect(
        stale,
        `re-run \`pnpm run measure --only=${stale.join(",")}\``,
      ).toEqual([]);
    },
  );
});

describe("copy budget input", () => {
  it("builds a stress line from the component's own words, on a word boundary", () => {
    const copy = stressCopy("Ship. Test. Deploy.", 40);
    expect(copy.length).toBeLessThanOrEqual(40);
    expect(copy).toBe("Ship. Test. Deploy. Ship. Test. Deploy.");
  });

  it("does not sweep text controls that are not copy", () => {
    // `announce-title.symbolPath` swept to 1500 chars measures nothing and
    // costs three renders.
    expect(isCopy("Your data has the answer.")).toBe(true);
    expect(isCopy("M12 2 L20 20 L4 20 Z")).toBe(false);
    expect(isCopy("#0F172A")).toBe(false);
    expect(isCopy("https://snapcn.dev/logo.svg")).toBe(false);
  });
});
