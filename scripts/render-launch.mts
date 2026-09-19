import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, getCompositions, renderMedia } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { tsconfigWebpackAlias } from "./tsconfig-webpack-alias.mts";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const out = process.argv[2] ?? path.join(root, "out", "snapcn-pro-launch.mp4");

await ensureBrowser();
const tsAliases = tsconfigWebpackAlias(root);
const serveUrl = await bundle({
  entryPoint: path.join(root, "src", "remotion", "launch-entry.ts"),
  ignoreRegisterRootWarning: true,
  webpackOverride: (raw) => {
    const config = enableTailwind(raw);
    const existing = Object.entries(config.resolve?.alias ?? {}).map(([name, alias]) => ({
      name: name.replace(/\$$/, ""),
      alias: alias as string,
      onlyModule: name.endsWith("$"),
    }));
    return { ...config, resolve: { ...config.resolve, alias: [...existing, ...tsAliases] } };
  },
});
const [composition] = await getCompositions(serveUrl);
console.log(`rendering ${composition.id} ${composition.durationInFrames}f → ${out}`);
await renderMedia({
  serveUrl,
  composition,
  codec: "h264",
  crf: 18,
  pixelFormat: "yuv420p",
  audioCodec: null,
  outputLocation: out,
  concurrency: 4,
  onProgress: ({ progress }) => process.stdout.write(`\r${(progress * 100).toFixed(0)}%   `),
});
console.log("\ndone:", out);
