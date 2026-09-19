import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createElementPayload,
  type ElementDependency,
} from "@remotion/studio-protocol";
import { loadConfigs } from "./lib/configs.mts";
import {
  elementSource,
  packageName,
  type RegistryFile,
} from "./lib/element-source.mts";

/**
 * Every free component that can stand as one file, as a Remotion Studio
 * Element: `public/elements/<name>.json`, which the "Add to Remotion Studio"
 * button sends to a running Studio over the Studio Protocol. Plus the list of
 * names, `lib/studio-elements.json`, so a page knows whether to offer the
 * button without fetching anything.
 *
 * Built from `public/r/` after `split-pro`, so an Element can only ever be
 * source that is already public — a Pro component has left that directory by
 * the time this runs.
 *
 * Run: part of `pnpm run registry:build`, or `node scripts/build-elements.mts`.
 */

const root = process.cwd();
const PUBLIC_R = path.join(root, "public", "r");
const OUT = path.join(root, "public", "elements");
const SITE = "https://snapcn.dev";
/** Every Remotion project already has these; Studio refuses them as dependencies. */
const PROVIDED = new Set(["react", "react-dom", "remotion"]);

type Item = {
  name: string;
  title?: string;
  type?: string;
  files?: RegistryFile[];
};

const readItem = async (file: string): Promise<Item> =>
  JSON.parse(await readFile(path.join(PUBLIC_R, file), "utf8"));

/** The version this site was built and tested against — Studio wants it exact. */
const installedVersion = async (pkg: string) =>
  JSON.parse(
    await readFile(
      path.join(root, "node_modules", pkg, "package.json"),
      "utf8",
    ),
  ).version as string;

const lib = (await readItem("snap-cn-ui.json")).files ?? [];
const configs = await loadConfigs();

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const built: string[] = [];
const skipped: string[] = [];
for (const file of (await readdir(PUBLIC_R)).sort()) {
  const item = await readItem(file);
  const config = configs[item.name];
  if (item.type !== "registry:component" || !config) continue;
  if (item.files?.length !== 1) {
    skipped.push(`${item.name} (${item.files?.length ?? 0} files)`);
    continue;
  }

  const element = elementSource(
    item.files[0].content,
    config.componentName,
    lib,
  );
  if (!element) {
    skipped.push(`${item.name} (builds on another component)`);
    continue;
  }

  const packages = [...new Set(element.modules.map(packageName))].filter(
    (pkg) => !PROVIDED.has(pkg),
  );
  const payload = createElementPayload({
    displayName: item.title ?? item.name,
    slug: item.name,
    sourceCode: element.sourceCode,
    dependencies: await Promise.all(
      packages.map(
        async (name): Promise<ElementDependency> =>
          name.startsWith("@remotion/")
            ? { name: name as `@remotion/${string}`, version: null }
            : { name, version: await installedVersion(name) },
      ),
    ),
    // Scenes fill whatever composition they are dropped into.
    dimensions: null,
    durationInFrames: config.durationInFrames,
    // The preview's own values, so the Element arrives looking like the page it
    // was sent from. A site-relative asset is a 404 in someone else's project.
    initialProps: Object.fromEntries(
      Object.entries(config.controls).map(([key, { default: value }]) => [
        key,
        typeof value === "string" && /^\/(?!\/)/.test(value)
          ? `${SITE}${value}`
          : value,
      ]),
    ),
  });

  await writeFile(
    path.join(OUT, `${item.name}.json`),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
  built.push(item.name);
}

await writeFile(
  path.join(root, "lib", "studio-elements.json"),
  `${JSON.stringify(built, null, 2)}\n`,
);
console.log(`elements: built ${built.length}, skipped ${skipped.length}`);
for (const s of skipped) console.log(`  - ${s}`);
