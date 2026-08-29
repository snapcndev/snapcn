import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Refresh the snapcn MCP server's snapshot of this registry.
 *
 * The MCP ships a build-time snapshot rather than fetching at runtime: its tools
 * have to be deterministic and work offline, and an agent asking for a component
 * cannot wait on a network round trip. The cost of that choice is exactly this
 * script — the snapshot is a copy, and a copy nobody regenerates is a lie. Add a
 * component, run `registry:build`, and the MCP still swears there are 32.
 *
 * So it hangs off `registry:build`, which is the one command that necessarily
 * runs when the registry changes.
 *
 * Absence is not failure. The MCP is a sibling checkout, so a contributor or a
 * CI box that only has this repo must still be able to build the registry — the
 * script says what it skipped and exits 0.
 *
 * Run: `pnpm run registry:build` (or `pnpm run sync:mcp` on its own)
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const workspace = path.resolve(repo, "..");

/**
 * Found by its package name, not its folder name — the checkout has already
 * been renamed once (from `magic-mcp-main 2`, the fork it started as), and a
 * hardcoded path would have broken silently on that move.
 */
function findMcp(): string | null {
  for (const entry of readdirSync(workspace, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = path.join(workspace, entry.name, "package.json");
    if (!existsSync(manifest)) continue;
    try {
      if (JSON.parse(readFileSync(manifest, "utf8")).name === "@snapcn/mcp") {
        return path.join(workspace, entry.name);
      }
    } catch {
      // A malformed package.json in a sibling folder is not this script's problem.
    }
  }
  return null;
}

const mcp = findMcp();
if (!mcp) {
  console.log("sync-mcp: no @snapcn/mcp checkout beside this repo — skipping.");
  process.exit(0);
}

// Both generators, always. `manifest` carries the components and their props;
// `skills` carries the motion rules and archetypes. Running only the first is
// how the MCP ends up describing new components with last month's rules.
for (const script of ["build-manifest.mjs", "build-skills.mjs"]) {
  console.log(`sync-mcp: ${script}`);
  execFileSync("node", [path.join(mcp, "scripts", script)], {
    cwd: mcp,
    stdio: "inherit",
    // The generators default to a sibling named `snap-cn`; be explicit so this
    // keeps working if either checkout is renamed.
    env: { ...process.env, SNAPCN_REPO: repo },
  });
}
console.log(`sync-mcp: snapshot refreshed in ${path.basename(mcp)}`);
