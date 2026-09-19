import type { ComponentConfig } from "../../lib/customizer-config.ts";

const REPO = new URL("../../", import.meta.url);

/**
 * `registry/__configs__.ts` is the driver: it is where SHARED_CONTROLS is merged
 * and the MIN_SPEED_ONE overrides are applied, so it is the only place that
 * knows a component's real runtime controls. Node resolves neither the `@/`
 * alias nor extensionless relative imports; teach it both, exactly as
 * `snapcn-mcp/scripts/build-manifest.mjs` already does.
 */
export async function loadConfigs(): Promise<Record<string, ComponentConfig>> {
  // `node:module`'s `registerHooks` is Node >= 22.15 and this repo is on
  // @types/node 20, so the shape is declared here rather than bumping types the
  // whole app would have to absorb.
  const { registerHooks } = (await import("node:module")) as unknown as {
    registerHooks: (hooks: {
      resolve: (
        spec: string,
        ctx: unknown,
        next: (s: string, c: unknown) => unknown,
      ) => unknown;
    }) => void;
  };
  registerHooks({
    resolve(spec: string, ctx: unknown, next) {
      if (spec.startsWith("@/")) spec = new URL(spec.slice(2), REPO).href;
      try {
        return next(spec, ctx);
      } catch {
        return next(`${spec}.ts`, ctx);
      }
    },
  });
  const mod = await import(new URL("registry/__configs__.ts", REPO).href);
  return mod.CONFIGS;
}
