import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The source files a sitemap entry is dated by: every docs MDX page, and the
 * bespoke `(gallery)` routes, which have no MDX.
 */
export function datedFiles(): string[] {
  const mdx = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? mdx(join(dir, e.name))
        : e.name.endsWith(".mdx")
          ? [join(dir, e.name)]
          : [],
    );
  const gallery = readdirSync("app/docs/(gallery)", { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => `app/docs/(gallery)/${e.name}/page.tsx`);
  return [...mdx("content/docs"), ...gallery].sort();
}

/** `YYYY-MM-DD` of the last commit touching `file`; today if it has local edits. */
function lastChanged(file: string, today: string): string {
  const dirty = execFileSync("git", ["status", "--porcelain", "--", file], {
    encoding: "utf8",
  }).trim();
  if (dirty) return today;
  const date = execFileSync("git", ["log", "-1", "--format=%cs", "--", file], {
    encoding: "utf8",
  }).trim();
  return date || today;
}

export function pageDates(): Record<string, string> {
  const today = new Date().toISOString().slice(0, 10);
  return Object.fromEntries(
    datedFiles().map((file) => [file, lastChanged(file, today)]),
  );
}
