import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { remotionWebpackAlias } from "./remotion-aliases";

/**
 * Resolves the Remotion `serveUrl` that `selectComposition`/`renderMedia` need.
 *
 * Bundling is expensive, so it happens at most once per process: if the deploy
 * baked a pre-bundle into `.remotion-bundle/` (see scripts/bundle-remotion.mts),
 * that path is returned directly; otherwise we lazily `bundle()` the entry once
 * and cache the in-flight promise so concurrent first renders share it.
 */

const PREBUNDLED_DIR = path.join(process.cwd(), ".remotion-bundle");
const ENTRY_POINT = path.join(process.cwd(), "src", "remotion", "index.ts");

let serveUrlPromise: Promise<string> | null = null;

export function getServeUrl(): Promise<string> {
  if (serveUrlPromise) return serveUrlPromise;

  serveUrlPromise = (async () => {
    if (existsSync(PREBUNDLED_DIR)) {
      return PREBUNDLED_DIR;
    }
    try {
      // Both imported here, not at module scope, and for the same reason: they
      // pull native binaries (`@tailwindcss/oxide`, and `@rspack/binding` via
      // `@remotion/bundler` -> `@rspack/core`).
      //
      // `@remotion/bundler` was a top-level import until it took the site down.
      // A serverless deploy does not trace those `.node` files into the
      // function, so requiring the module throws at *evaluation* — and this
      // file is reachable from `/api/audio` and `/api/showcase` through
      // cleanup -> render-queue -> render -> here. Two routes that never render
      // anything returned 500 because the renderer failed to load beside them.
      // Deferring the import means only a request that actually bundles can hit
      // it, and it fails as a job error instead of taking the route down.
      const [{ enableTailwind }, { bundle }] = await Promise.all([
        import(
          /* webpackIgnore: true */ /* turbopackIgnore: true */
          "@remotion/tailwind-v4"
        ),
        import(
          /* webpackIgnore: true */ /* turbopackIgnore: true */
          "@remotion/bundler"
        ),
      ]);
      return await bundle({
        entryPoint: ENTRY_POINT,
        // Webpack doesn't read tsconfig `paths`; teach it every alias the
        // registry relies on (must match scripts/bundle-remotion.mts).
        // Tailwind first, then the aliases. Without `enableTailwind` every
        // class in a registry component is inert in the render.
        webpackOverride: (raw) => {
          const config = enableTailwind(raw);
          return {
            ...config,
            resolve: {
              ...config.resolve,
              alias: {
                ...(config.resolve?.alias ?? {}),
                ...remotionWebpackAlias(process.cwd()),
              },
            },
          };
        },
      });
    } catch (err) {
      // Don't poison the cache on failure — let the next render retry the bundle.
      serveUrlPromise = null;
      throw err;
    }
  })();

  return serveUrlPromise;
}
