/**
 * Demo mp4s for the pro components.
 *
 * The pro tier is gitignored, so its demos cannot ride in `public/demos` the way
 * the free ones do — they are built here and uploaded to R2 by
 * `scripts/pro-upload.mts`, and the gallery plays them off that origin. What
 * comes out of this script is therefore what the *site* serves, not a scratch
 * render to look at: same 60fps / 960-wide web pass as `render-previews.mts`,
 * same byte-hash manifest so a re-render is a new
 * URL and a stale copy is not something a cache can serve.
 *
 *     node scripts/pro-demos.mts <out-dir> [slug ...]
 *
 * With no slugs it renders the whole tier; the gallery only needs the published
 * set, which is what `PRO_NAMES` in config/site.ts lists.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { tsconfigWebpackAlias } from "./tsconfig-webpack-alias.mts";

/**
 * Every paid component that has a name and a description — i.e. every row of the
 * pro manifest. Not a hand-kept list: one went stale the moment the tier grew
 * past it and the gallery then advertised 14 of 35.
 */
const PRO: string[] = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "registry/snap-cn-pro/registry.json"),
    "utf8",
  ),
).items.map((i: { name: string }) => i.name);

const out = process.argv[2];
// Optional slug list after the out dir: render only those. The gallery wants the
// published pro set, not every slug in the tier.
const only = process.argv.slice(3);
const LIST = only.length > 0 ? only : PRO;
const root = process.cwd();
mkdirSync(out, { recursive: true });
await ensureBrowser();
const tsAliases = tsconfigWebpackAlias(root);
const serveUrl = await bundle({
  entryPoint: path.join(root, "src", "remotion", "dev-entry.ts"),
  ignoreRegisterRootWarning: true,
  webpackOverride: (raw) => {
    const config = enableTailwind(raw);
    const existing = Object.entries(config.resolve?.alias ?? {}).map(
      ([name, alias]) => ({
        name: name.replace(/\$$/, ""),
        alias: alias as string,
        onlyModule: name.endsWith("$"),
      }),
    );
    return {
      ...config,
      resolve: { ...config.resolve, alias: [...existing, ...tsAliases] },
    };
  },
});
let i = 0;
for (const id of LIST) {
  i += 1;
  const t = Date.now();
  try {
    const composition = await selectComposition({ serveUrl, id });
    const file = path.join(out, `${id}.mp4`);
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      crf: 20,
      outputLocation: file,
    });
    webPass(file);
    console.log(
      `[${i}/${LIST.length}] ok   ${id} — ${composition.durationInFrames}f in ${((Date.now() - t) / 1000).toFixed(1)}s`,
    );
  } catch (e) {
    console.log(
      `[${i}/${LIST.length}] FAIL ${id}: ${(e as Error).message.split("\n")[0].slice(0, 80)}`,
    );
  }
}
writeManifest(out);
writeCatalogue(out);

/**
 * 60fps and 960 wide, in one pass — the same trade `render-previews.mts` makes
 * and for the same reasons (a card is never painted above ~600 device pixels; a
 * 60fps container stops a high-refresh display holding frames for the wrong
 * length of time). The `maxrate` cap is what keeps the photographic scenes from
 * being the whole page's payload. Left as rendered if ffmpeg is missing.
 */
function webPass(file: string) {
  const tmp = `${file}.60.mp4`;
  const done = spawnSync("ffmpeg", [
    "-nostdin",
    "-v",
    "error",
    "-i",
    file,
    "-vf",
    "fps=60,scale=960:-2",
    "-c:v",
    "libx264",
    "-crf",
    "16",
    "-maxrate",
    "1200k",
    "-bufsize",
    "2400k",
    "-preset",
    "slow",
    "-pix_fmt",
    "yuv420p",
    "-an",
    "-movflags",
    "+faststart",
    "-y",
    tmp,
  ]);
  if (done.status === 0) renameSync(tmp, file);
  else rmSync(tmp, { force: true });
}

/** Byte hashes for `?v=`, over everything on disk so the manifest never goes half-stale. */
function writeManifest(outDir: string) {
  const manifest: Record<string, string> = {};
  for (const file of readdirSync(outDir).sort()) {
    if (!file.endsWith(".mp4")) continue;
    manifest[file.slice(0, -4)] = createHash("sha256")
      .update(readFileSync(path.join(outDir, file)))
      .digest("hex")
      .slice(0, 10);
  }
  writeFileSync(
    path.join(root, "lib", "pro-demo-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(
    `Wrote lib/pro-demo-manifest.json (${Object.keys(manifest).length} demos)`,
  );
}

/**
 * The paid catalogue, committed.
 *
 * `registry/snap-cn-pro/registry.json` is gitignored, so nothing the site builds
 * can import it — a public checkout has no pro tier and CI would fail to
 * resolve the path. The names, titles and descriptions still have to reach the
 * gallery somehow, and `public/r/registry.json` only carries the ones a
 * `SNAPCN_PRO_PUBLIC=1` build happened to list, which is how the grid came to
 * advertise fourteen components out of thirty-five.
 *
 * So this file: metadata only, written next to the demo manifest, checked in.
 * It lists exactly the components that have a video on disk, because a paid card
 * with nothing to play is a card that sells nothing. No source, no props, no
 * file list — the same trade the built index already makes.
 */
function writeCatalogue(outDir: string) {
  const rendered = new Set(
    readdirSync(outDir)
      .filter((f) => f.endsWith(".mp4"))
      .map((f) => f.slice(0, -4)),
  );
  const manifest = JSON.parse(
    readFileSync(path.join(root, "registry/snap-cn-pro/registry.json"), "utf8"),
  ) as { items: { name: string; title?: string; description?: string }[] };

  // The changelog dates a paid component by the day it joined this list, and
  // this function rewrites the list from scratch — so carry every known day
  // over, and stamp a name seen for the first time with today.
  const cataloguePath = path.join(root, "lib", "pro-catalogue.json");
  const previous = new Map<string, { added?: string }>(
    existsSync(cataloguePath)
      ? (
          JSON.parse(readFileSync(cataloguePath, "utf8")) as {
            name: string;
            added?: string;
          }[]
        ).map((i) => [i.name, i])
      : [],
  );
  const today = new Date().toISOString().slice(0, 10);

  const items = manifest.items
    .filter((i) => rendered.has(i.name))
    .map((i) => {
      const known = previous.get(i.name);
      const added = known ? known.added : today;
      return {
        name: i.name,
        title: i.title ?? i.name,
        description: i.description ?? "",
        ...(added ? { added } : {}),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  writeFileSync(cataloguePath, `${JSON.stringify(items, null, 2)}\n`);
  console.log(`Wrote lib/pro-catalogue.json (${items.length} components)`);
}
