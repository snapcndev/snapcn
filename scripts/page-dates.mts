/**
 * Writes lib/page-dates.json: the day each page's source last changed, from git.
 *
 * The sitemap's `lastModified` has to be a true date or nothing (see
 * app/sitemap.ts), and the production image is built without `.git`
 * (.dockerignore), so the build cannot ask git itself. This asks it here and
 * commits the answer. `lib/__tests__/page-dates.test.ts` fails when the file
 * no longer matches git, so it cannot quietly go stale.
 *
 * A file with uncommitted changes is dated today: it is about to be committed.
 *
 *   pnpm run sitemap:dates
 */

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { pageDates } from "./lib/page-dates.mts";

const dates = pageDates();
writeFileSync("lib/page-dates.json", `${JSON.stringify(dates, null, 2)}\n`);
const dirty = execFileSync(
  "git",
  ["status", "--porcelain", "--", ...Object.keys(dates)],
  {
    encoding: "utf8",
  },
).trim();
console.log(
  `lib/page-dates.json: ${Object.keys(dates).length} files${dirty ? " (uncommitted files dated today)" : ""}`,
);
