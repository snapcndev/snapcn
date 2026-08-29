import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  getCompositions,
  renderMedia,
} from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { tsconfigWebpackAlias } from "../tsconfig-webpack-alias.mts";

/**
 * Render one registry component at its config defaults, to an mp4.
 *
 * `render-previews.mts` only knows the slugs in `RENDERED_DEMOS`, and those
 * files are hashed into a manifest the site serves — neither is what you want
 * while iterating on a component that is not shipped yet.
 *
 *   node scripts/dev/render-one.mts <slug> <out.mp4>
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const [slug, out] = process.argv.slice(2);
if (!slug || !out) throw new Error("usage: render-one.mts <slug> <out.mp4>");

const tsAliases = tsconfigWebpackAlias(root);

/**
 * The pro tier is a private, gitignored directory, so most checkouts do not have
 * it. Point its barrel at an empty stub when it is missing, and `dev-root` can
 * import it unconditionally instead of every caller carrying a branch.
 */
const proBarrel = path.join(root, "registry", "snap-cn-pro", "__index__.tsx");
const proAlias = {
  name: "@/registry/snap-cn-pro/__index__",
  alias: existsSync(proBarrel)
    ? proBarrel
    : path.join(root, "src", "remotion", "no-pro.ts"),
  onlyModule: true,
};
await ensureBrowser();

const serveUrl = await bundle({
  entryPoint: path.join(root, "src", "remotion", "dev-entry.ts"),
  // The entry is side-effect-only (CSS, then the root) so `registerRoot` lives
  // one import away, which is the same shape the shipped entries use.
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
      resolve: {
        ...config.resolve,
        alias: [proAlias, ...existing, ...tsAliases],
      },
    };
  },
});

const composition = (await getCompositions(serveUrl)).find(
  (c) => c.id === slug,
);
if (!composition) {
  throw new Error(`no composition "${slug}" in the demos root`);
}

await renderMedia({
  serveUrl,
  composition,
  codec: "h264",
  crf: 16,
  pixelFormat: "yuv420p",
  audioCodec: null,
  outputLocation: out,
  concurrency: Number(process.env.REMOTION_CONCURRENCY) || 4,
  onProgress: ({ progress }) =>
    process.stdout.write(`\r${slug} ${(progress * 100).toFixed(0)}%   `),
});
process.stdout.write(`\n${out} — ${composition.durationInFrames} frames\n`);
