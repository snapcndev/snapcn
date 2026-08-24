import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  getCompositions,
  renderMedia,
} from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { tsconfigWebpackAlias } from "./tsconfig-webpack-alias.mts";

/**
 * Render each component in `lib/rendered-demos.tsx` to `public/demos/<slug>.mp4`.
 *
 * These files are what the site plays instead of a live `<Player>` — see the
 * long note in `lib/rendered-demos.tsx` for why, and CONTRIBUTING.md for the
 * workflow. They are committed, because the site serves them statically and a
 * build must not depend on a headless Chrome round-trip.
 *
 * Run:
 *   pnpm run render:previews                 # every slug in RENDERED_DEMOS
 *   pnpm run render:previews --only text-swell
 *
 * Concurrency (tabs per render) is env-tunable: REMOTION_CONCURRENCY (default 4).
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

function getFlag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && i + 1 < process.argv.length) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
}

function remotionConcurrency(): number {
  const parsed = Number(process.env.REMOTION_CONCURRENCY);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 4;
}

async function main() {
  const only = getFlag("only");
  const outDir = path.join(root, "public", "demos");
  mkdirSync(outDir, { recursive: true });

  await ensureBrowser();

  // Webpack doesn't read tsconfig `paths`, and the registry barrel reaches into
  // several specific mappings, not just the `@/*` catch-all — so translate the
  // whole `paths` map to aliases.
  const tsAliases = tsconfigWebpackAlias(root);

  console.log("Bundling previews entry…");
  const serveUrl = await bundle({
    entryPoint: path.join(root, "src", "remotion", "previews-entry.ts"),
    webpackOverride: (raw) => {
      // Compile Tailwind into the bundle — without it every class in a
      // component is inert in the render (measured: a red box came out white).
      const config = enableTailwind(raw);
      // Remotion's default alias is an object; fold it into the ordered array
      // form (first match wins) so our specific entries keep their precedence.
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

  let comps = await getCompositions(serveUrl);
  if (only) comps = comps.filter((c) => c.id === only);

  if (comps.length === 0) {
    console.error(
      only
        ? `No composition matched --only ${only}. Is "${only}" listed in RENDERED_DEMOS?`
        : "No compositions found — is RENDERED_DEMOS empty?",
    );
    process.exit(1);
  }

  const concurrency = remotionConcurrency();
  console.log(
    `Rendering ${comps.length} preview(s) → public/demos (concurrency=${concurrency})`,
  );

  let i = 0;
  for (const composition of comps) {
    i += 1;
    const tag = `[${i}/${comps.length}] ${composition.id}`;
    const outputLocation = path.join(outDir, `${composition.id}.mp4`);

    await renderMedia({
      serveUrl,
      composition,
      codec: "h264",
      // The whole reason these files exist is that they look better than the
      // live player. Encoding them badly would give that away — CRF 18 is
      // visually lossless on flat type, and these are a few seconds long.
      crf: 18,
      // Safari and every mobile browser refuse to decode 4:2:0 progressive H.264
      // without this, and a demo that silently doesn't play is worse than one
      // that stutters.
      pixelFormat: "yuv420p",
      audioCodec: null,
      outputLocation,
      concurrency,
      onProgress: ({ progress }) => {
        process.stdout.write(`\r${tag} ${(progress * 100).toFixed(0)}%   `);
      },
    });
    retimeTo60(outputLocation, tag);
  }

  writeManifest(outDir);
}

/**
 * Re-time a finished render to a 60fps container, by duplicating frames.
 *
 * Not cosmetic, and not about the demo: **Chrome paces a whole page's rendering
 * to the frame rate of the video playing on it.** Measured on an otherwise idle
 * page — one video, or none, and rAF runs at the display rate; two or more 30fps
 * videos and the entire page drops to 30fps. The showcase wall plays five or six
 * at once, so 30fps files pin the wall's own motion to 30fps, and a wall sliding
 * at constant velocity is the least forgiving thing there is to run at half rate.
 * Same clips at 60fps: the page holds 60.
 *
 * Frame duplication rather than a 60fps render, because the scenes are authored
 * on frame numbers against their config's fps — rendering them at 60 would play
 * them at half speed. This keeps every rendered frame exactly as authored and
 * only changes the cadence the container declares. Duplicate frames cost almost
 * nothing in H.264 (most of these files come out *smaller*), and it measures at
 * SSIM 0.998–0.9997 against the source.
 *
 * ## …and down to 960 wide, in the same pass
 *
 * Nothing ever paints one of these at 1280. There are three consumers and they
 * are all cards: the showcase wall (`stageWidth * 0.2` — 288 CSS px on a 1440
 * stage) and the two masonry grids in the docs (`sm:columns-2` → `xl:columns-4`,
 * so ~300 CSS px). The widest any of them gets on a 2× display is ~600 device
 * pixels, and 960 clears that with room left over.
 *
 * The 320 pixels above it were costing 4.2MB across the eleven demos and 44% of
 * the decode — which the wall pays at 60fps, five clips at a time, while its
 * canvas resamples every one of them into strips. Scaling here rather than at
 * render time keeps Remotion's output at the composition's real size; this pass
 * was already re-encoding, so it is free.
 *
 * If a demo ever gets shown full-bleed, this is the line that has to move.
 *
 * ## The full-size render is kept, not thrown away
 *
 * That reasoning is about the *site*, and it holds. It does not hold for X,
 * where the same clip plays full-bleed in the feed on a 3x phone — 960 wide is
 * below the 1280 X itself asks for, and it reads as a cheap export. The file
 * that satisfies both already exists for one moment: what Remotion just wrote,
 * at the composition's real size and CRF 18, before this pass shrinks it. So it
 * is copied to `social-exports/` first rather than being overwritten. No extra
 * render, no change to a single byte the site serves.
 */
function retimeTo60(file: string, tag: string) {
  // Keep the full-size render before the downscale pass replaces it in place.
  const social = path.join(root, "social-exports", path.basename(file));
  mkdirSync(path.dirname(social), { recursive: true });
  copyFileSync(file, social);

  const tmp = `${file}.60.mp4`;
  const done = spawnSync(
    "ffmpeg",
    [
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
      // CRF alone is a *quality* target, not a size one, and it prices detail
      // honestly: flat type costs nothing, photographs cost whatever they cost.
      // Across these demos that spread is 60kbps (word-captions) to 6,900kbps
      // (logo-flicker) — a 100× range from one setting. orbit-gallery landed at
      // 4.6MB and was, on its own, 75% of the landing page's 6MB payload and its
      // 8.4s LCP.
      //
      // So: keep CRF 16 as the target and cap the outliers. Fourteen of the
      // twenty demos are already under 1.2Mbps and this line does not touch a
      // byte of them; the six above it — the ones carrying photographs, device
      // screens and a flickering logo — get held at roughly 1.5MB per ten
      // seconds. Measured on orbit-gallery: 4.6MB → 1.5MB at SSIM 0.989.
      //
      // The cap is per-second, so it scales with length instead of punishing it.
      // If a demo ever legitimately needs more, raise it here rather than
      // dropping CRF, which would degrade the flat-type demos that are fine.
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
    ],
    { stdio: "inherit" },
  );

  if (done.status === 0) {
    renameSync(tmp, file);
    writePoster(file, tag);
    process.stdout.write(`\r${tag} done → ${path.relative(root, file)} @60\n`);
    return;
  }

  rmSync(tmp, { force: true });
  process.stdout.write(
    `\r${tag} done → ${path.relative(root, file)} — but STILL 30fps\n` +
      `  ffmpeg is not on PATH, so this file was left as rendered. The site will\n` +
      `  work, and the showcase wall will animate at 30fps instead of 60. Install\n` +
      `  ffmpeg and re-run to fix it; see the note on retimeTo60.\n`,
  );
}

/**
 * A still frame for the demo, written beside it.
 *
 * `/docs/components` renders one card per component, and the grid is short
 * enough that every card is on screen at once — so there is nothing below the
 * fold to lazily defer, and autoplaying the lot cost 16.6MB and twenty-two
 * decoders that never stopped. The cards show this instead, and play the real
 * file on hover. All 22 posters together are ~164KB.
 *
 * Taken 60% of the way in, not at frame 0: most of these scenes animate *in*,
 * so their first frame is an empty stage.
 *
 * webp via `cwebp` — the ffmpeg here has no libwebp encoder, and a PNG of the
 * same frame is roughly 6x the bytes. A missing `cwebp` is not fatal: the
 * poster is simply absent and the card is a blank box until hover, which is
 * exactly how it behaved before posters existed.
 */
function writePoster(file: string, tag: string) {
  const slug = path.basename(file, ".mp4");
  const dir = path.join(path.dirname(file), "posters");
  mkdirSync(dir, { recursive: true });

  const probe = spawnSync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "csv=p=0",
    file,
  ]);
  const seconds = Number(String(probe.stdout ?? "").trim());
  const at =
    Number.isFinite(seconds) && seconds > 0 ? (seconds * 0.6).toFixed(2) : "0";

  const png = path.join(dir, `${slug}.png`);
  const frame = spawnSync("ffmpeg", [
    "-nostdin",
    "-y",
    "-v",
    "error",
    "-ss",
    at,
    "-i",
    file,
    "-frames:v",
    "1",
    "-vf",
    "scale=640:-2",
    png,
  ]);
  if (frame.status !== 0) return;

  const webp = spawnSync("cwebp", [
    "-quiet",
    "-q",
    "76",
    png,
    "-o",
    path.join(dir, `${slug}.webp`),
  ]);
  rmSync(png, { force: true });
  if (webp.status !== 0) {
    process.stdout.write(`\r${tag} — no poster (cwebp not on PATH)\n`);
  }
}

/**
 * Every demo ships to the SAME path forever (`/demos/<slug>.mp4`), so a browser
 * that has one will happily keep replaying it after the file underneath has been
 * re-rendered — and <video> caches hardest of all. That has now cost three rounds
 * of "you didn't fix it" against builds that no longer existed.
 *
 * So the URL carries a hash of the file's own bytes. Change the demo, change the
 * URL. A stale demo is not something a cache can serve any more, because the thing
 * it cached is at a different address.
 *
 * Hashes ALL demos on disk, not just the one `--only` re-rendered, so the manifest
 * never goes half-stale.
 */
function writeManifest(outDir: string) {
  const manifest: Record<string, string> = {};
  for (const file of readdirSync(outDir).sort()) {
    if (!file.endsWith(".mp4")) continue;
    const slug = file.slice(0, -4);
    manifest[slug] = createHash("sha256")
      .update(readFileSync(path.join(outDir, file)))
      .digest("hex")
      .slice(0, 10);
  }
  const target = path.join(root, "lib", "demo-manifest.json");
  writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `Wrote lib/demo-manifest.json (${Object.keys(manifest).length} demos)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
