import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Turn every install into a way back to snapcn. Runs after `shadcn build`,
 * before `split-pro` (so the pro items are stamped before they move out).
 *
 * Two things, both on the built `public/r/<name>.json` and never on the source:
 *
 * 1. **A one-line header on every copied file** naming the component and its
 *    page. The file lives in the user's repo for good — often a public one — so
 *    this is the only link to snapcn that survives the install. On the built
 *    JSON rather than in `registry/snap-cn/*`, because the source is what
 *    `motion:measure` hashes, and a comment there would invalidate every
 *    measurement for a change that renders nothing.
 *
 * 2. **One line on every free component's `docs`**, which the shadcn CLI prints
 *    after the install succeeds. 751 developers a month read that line at the
 *    moment a component has just worked; it pointed only at the component's own
 *    docs, and nothing told them the rest of the catalogue exists.
 *
 * Idempotent: a second run finds the stamps and leaves them alone.
 *
 * Run: part of `pnpm run registry:build`, or `node scripts/stamp-registry.mts`.
 */

const root = process.cwd();
const PUBLIC_R = path.join(root, "public", "r");
const SITE = "https://snapcn.dev";

const readJson = async (p: string) => JSON.parse(await readFile(p, "utf8"));

const catalogue: { name: string }[] = await readJson(
  path.join(root, "lib", "pro-catalogue.json"),
).catch(() => []);
const proSource: { items?: { name: string }[] } = await readJson(
  path.join(root, "registry", "snap-cn-pro", "registry.json"),
).catch(() => ({}));
const proNames = new Set([
  ...catalogue.map((i) => i.name),
  ...(proSource.items ?? []).map((i) => i.name),
]);

const UPSELL = `${catalogue.length} Pro components too — charts, launch scenes, device shots: ${SITE}/docs/pricing?ref=cli-docs`;
const STAMP = "· snapcn";

type Item = {
  name: string;
  title?: string;
  docs?: string;
  files?: { path: string; content?: string }[];
};

let stamped = 0;
for (const file of await readdir(PUBLIC_R)) {
  if (!file.endsWith(".json") || file === "registry.json") continue;
  const full = path.join(PUBLIC_R, file);
  const item: Item = await readJson(full);
  if (!item.files) continue;

  const pro = proNames.has(item.name);
  // The component's own page when its `docs` names one, else the gallery.
  const page =
    item.docs?.match(/https:\/\/snapcn\.dev\/docs\/[a-z0-9/-]+/)?.[0] ??
    `${SITE}/docs/components`;
  const header = `// ${item.title ?? item.name} ${STAMP}${pro ? " Pro" : ""} — ${page}\n`;

  let changed = false;
  for (const f of item.files) {
    if (!f.content || !/\.(tsx?|jsx?)$/.test(f.path)) continue;
    if (
      f.content.startsWith("// ") &&
      f.content.split("\n")[0].includes(STAMP)
    ) {
      continue;
    }
    // Before `"use client"` is fine: a directive must be the first statement,
    // and a comment is not one.
    f.content = header + f.content;
    changed = true;
  }

  if (!pro && item.docs && !item.docs.includes("?ref=cli-docs")) {
    item.docs = `${item.docs} — ${UPSELL}`;
    changed = true;
  }

  if (changed) {
    await writeFile(full, `${JSON.stringify(item, null, 2)}\n`);
    stamped++;
  }
}

console.log(`stamp-registry: ${stamped} built items stamped`);
