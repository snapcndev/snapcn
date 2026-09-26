import { spawnSync } from "node:child_process";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Upload the browser source maps to PostHog, then remove them from the build.
 * Runs after `next build`.
 *
 * PostHog's error tracking showed minified frames only, which is why a crash
 * like "Cannot read properties of undefined (reading 'ai-input')" could not be
 * traced to a component. With the maps uploaded, the same stack resolves to
 * file:line, and the maps themselves are never served.
 *
 * `.next/static` only: those are the files a browser runs. The server maps are
 * twice as many and would add minutes to every deploy for errors PostHog never
 * sees. (This is why `@posthog/nextjs-config` isn't used — it uploads all of
 * `.next`.)
 *
 * The maps are deleted whether or not the upload worked. A failed upload costs
 * readable stack traces for one deploy; a map left in `.next/static` would
 * publish the source.
 */
const KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
const STATIC_DIR = path.join(process.cwd(), ".next", "static");

if (!KEY || !PROJECT_ID) {
  console.log("[sourcemaps] POSTHOG_PERSONAL_API_KEY unset — skipping upload.");
  process.exit(0);
}

// posthog-cli refuses to upload without a release version, and outside a git
// checkout it cannot find one itself. Coolify only provides SOURCE_COMMIT to
// the build when "Include Source Commit in Build" is on, so fall back to the
// build's own timestamp rather than lose every upload. (Symbols are matched by
// the chunk ids the CLI injects; the version only groups them.)
const release =
  process.env.SOURCE_COMMIT ||
  `build-${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}`;
const result = spawnSync(
  path.join(process.cwd(), "node_modules", ".bin", "posthog-cli"),
  [
    "sourcemap",
    "process",
    "--directory",
    STATIC_DIR,
    "--release-name",
    "snapcn",
    "--release-version",
    release,
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      POSTHOG_CLI_API_KEY: KEY,
      POSTHOG_CLI_PROJECT_ID: PROJECT_ID,
      POSTHOG_CLI_HOST:
        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.posthog.com",
    },
  },
);
if (result.status !== 0) {
  console.warn(
    "[sourcemaps] upload failed — deploying without readable stack traces.",
  );
}

// The `//# sourceMappingURL=` comments go with the maps, or every open devtools
// asks for a file that 404s.
const MAP_COMMENT = /\n?\/[/*][#@] sourceMappingURL=[^\n]*$/;
let removed = 0;
for (const entry of await readdir(STATIC_DIR, { recursive: true })) {
  const file = path.join(STATIC_DIR, entry);
  if (file.endsWith(".map")) {
    await rm(file);
    removed++;
  } else if (file.endsWith(".js") || file.endsWith(".css")) {
    const text = await readFile(file, "utf8");
    if (MAP_COMMENT.test(text))
      await writeFile(file, text.replace(MAP_COMMENT, ""));
  }
}
console.log(`[sourcemaps] removed ${removed} maps from .next/static.`);
