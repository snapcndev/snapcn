import { createHash } from "node:crypto";
import { globSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * What a measurement was taken against.
 *
 * One implementation, imported by both sides: `scripts/measure.mts` stamps it
 * onto every entry it writes, and the MCP's `build-manifest.mjs` recomputes it
 * before copying one into the snapshot. Two implementations is a hash that
 * disagrees with itself, which is worse than no hash at all — it would drop
 * every measurement or none of them for reasons nobody could see.
 *
 * The component's own registry directory, plus `snap-cn-ui` — the tier every
 * component's `registryDependencies` points at and whose theme decides what the
 * ink weighs. Deliberately NOT the built `public/r/*.json` or the tier
 * manifests: those churn on every `registry:build` and would invalidate every
 * measurement on a run that changed nothing.
 *
 * Returns null when the component has no registry directory — a name the
 * measurement cannot be about.
 */
export function sourceHash(repo: string, name: string): string | null {
  const own = globSync(`registry/*/${name}/**`, {
    cwd: repo,
    withFileTypes: true,
  });
  if (!own.length) return null;
  const shared = globSync("registry/snap-cn-ui/**", {
    cwd: repo,
    withFileTypes: true,
  });
  const files = [...own, ...shared]
    .filter((e) => e.isFile() && !e.parentPath.includes("__tests__"))
    .map((e) => path.resolve(repo, e.parentPath, e.name))
    .sort();
  const h = createHash("sha256");
  for (const f of files) {
    // The path as well as the bytes: a renamed file is a changed component, and
    // hashing content alone would call that identical.
    h.update(path.relative(repo, f));
    h.update(readFileSync(f));
  }
  return h.digest("hex").slice(0, 12);
}
