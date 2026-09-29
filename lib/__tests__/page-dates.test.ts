/**
 * lib/page-dates.json — the sitemap's `lastModified` for pages without a
 * component date. Written from git by `pnpm run sitemap:dates`, because the
 * production build has no `.git` to ask.
 *
 * If this fails, run `pnpm run sitemap:dates` and commit the result.
 */

import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import PAGE_DATES from "@/lib/page-dates.json";
import { datedFiles, pageDates } from "@/scripts/lib/page-dates.mts";

/** A shallow or git-less checkout would date every file by one commit. */
function fullHistory(): boolean {
  try {
    return (
      execFileSync("git", ["rev-parse", "--is-shallow-repository"], {
        encoding: "utf8",
      }).trim() === "false"
    );
  } catch {
    return false;
  }
}

describe("page-dates.json", () => {
  it("dates every docs page and gallery route, and nothing else", () => {
    expect(Object.keys(PAGE_DATES).sort()).toEqual(datedFiles());
  });

  it.runIf(fullHistory())("matches git", () => {
    expect(PAGE_DATES).toEqual(pageDates());
  });
});
