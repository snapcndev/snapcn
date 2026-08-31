/**
 * Take the paid items back out of `public/`.
 *
 * `shadcn build` has one output directory and writes every item into it, which
 * for a registry with a paid half means the paid half ships to the CDN as
 * static files. This runs straight after the build and moves those files into
 * `registry/.private/`, where the `/r/[file]` route reads them behind a key.
 *
 * The index (`public/r/registry.json`) keeps its pro entries and gains
 * `meta.access = "pro"`. That is deliberate: the built index carries no
 * `files[].content`, so listing a pro component there leaks nothing and is the
 * only way anyone — the gallery, the MCP, an agent — can find out the component
 * exists in order to want it. A paywall nobody can see is a deleted feature.
 *
 * No pro registry yet? Then this is a no-op and the free build is untouched.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const PRO_SOURCE = path.join(root, "registry", "snap-cn-pro", "registry.json");
const PUBLIC_R = path.join(root, "public", "r");
const PRIVATE_DIR = path.join(root, "registry", ".private");

const readJson = async (p: string) => JSON.parse(await readFile(p, "utf8"));

const proNames: string[] = await readJson(PRO_SOURCE)
  .then(
    (r: { items?: { name: string }[] }) => r.items?.map((i) => i.name) ?? [],
  )
  .catch(() => []);

if (proNames.length === 0) {
  console.log("split-pro: no pro registry — nothing to move");
  process.exit(0);
}

await mkdir(PRIVATE_DIR, { recursive: true });

let moved = 0;
for (const name of proNames) {
  try {
    await rename(
      path.join(PUBLIC_R, `${name}.json`),
      path.join(PRIVATE_DIR, `${name}.json`),
    );
    moved++;
  } catch {
    // Already moved, or the build did not emit it. Either way there is nothing
    // public left to protect, which is the only thing this step guarantees.
  }
}

/**
 * Now put the pro items back into the *index* — metadata only.
 *
 * GATED, and off by default. The pro tier does not go public until 22 Oct 2026,
 * and an index row is not nothing: it publishes the component's name, title,
 * full description and dependency list as a static file on the CDN. That is the
 * catalogue, and the catalogue is the launch. Set SNAPCN_PRO_PUBLIC=1 to list
 * them; until then the moves above still happen, so the files are protected
 * either way and only the advertising waits.
 *
 * `shadcn build` emits an index entry with no `files[].content`, so listing a
 * paid component there gives away its name, description, props and dependency
 * list and none of its source. That is exactly the trade wanted: the gallery
 * can draw a locked card and the MCP can answer "orbit-gallery-pro exists, and
 * it needs a key" instead of "no such component". A paywall nobody can see is
 * a deleted feature.
 *
 * The entries are merged in rather than assumed present, because the pro
 * registry is built in its own repo — the free `shadcn build` here has never
 * heard of these names.
 */
if (process.env.SNAPCN_PRO_PUBLIC !== "1") {
  console.log(
    `split-pro: ${moved}/${proNames.length} pro items moved out of public/r, ` +
      `not listed (SNAPCN_PRO_PUBLIC unset)`,
  );
  process.exit(0);
}

const indexPath = path.join(PUBLIC_R, "registry.json");
const index = await readJson(indexPath);
const proItems: Record<string, unknown>[] = (await readJson(PRO_SOURCE)).items;
const byName = new Map<string, Record<string, unknown>>(
  (index.items ?? []).map((i: { name: string }) => [i.name, i]),
);

for (const item of proItems) {
  const { files, ...meta } = item as { files?: unknown; name: string };
  // `files` carries the source paths; keep the entry shaped like every other
  // index row (path/type/target, no content) so nothing downstream special-cases
  // a pro item — the only difference between the two tiers is `meta.access`.
  const stripped = {
    ...meta,
    files: Array.isArray(files)
      ? files.map((f: Record<string, unknown>) => {
          const { content: _drop, ...rest } = f;
          return rest;
        })
      : undefined,
    meta: { access: "pro" },
  };
  const existing = byName.get(meta.name);
  if (existing) Object.assign(existing, stripped);
  else index.items.push(stripped);
}
await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);

console.log(
  `split-pro: ${moved}/${proNames.length} pro items moved out of public/r, ${proItems.length} listed in the index as locked`,
);
