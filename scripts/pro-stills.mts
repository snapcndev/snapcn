import path from "node:path";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { tsconfigWebpackAlias } from "./tsconfig-webpack-alias.mts";

const PRO = [
  "agent-chat", "agent-open", "app-reveal", "chat-thread", "lcd-type",
  "manifesto", "phrase-swarm", "read-through", "sentence-set",
  "showcase-drift", "stretch-word", "version-drop", "word-rush", "word-settle",
];
const out = process.argv[2];
const root = process.cwd();
await ensureBrowser();
const tsAliases = tsconfigWebpackAlias(root);
const serveUrl = await bundle({
  entryPoint: path.join(root, "src", "remotion", "dev-entry.ts"),
  ignoreRegisterRootWarning: true,
  webpackOverride: (raw) => {
    const config = enableTailwind(raw);
    const existing = Object.entries(config.resolve?.alias ?? {}).map(([name, alias]) => ({
      name: name.replace(/\$$/, ""), alias: alias as string, onlyModule: name.endsWith("$"),
    }));
    return { ...config, resolve: { ...config.resolve, alias: [...existing, ...tsAliases] } };
  },
});
for (const id of PRO) {
  try {
    const composition = await selectComposition({ serveUrl, id });
    // Two thirds in: past every entrance, before most exits.
    const frame = Math.floor(composition.durationInFrames * 0.66);
    await renderStill({
      composition, serveUrl, frame, scale: 0.5, imageFormat: "jpeg",
      output: path.join(out, `${id}.jpg`),
    });
    console.log(`ok   ${id} @${frame}/${composition.durationInFrames}`);
  } catch (e) {
    console.log(`FAIL ${id}: ${(e as Error).message.split("\n")[0].slice(0, 90)}`);
  }
}
