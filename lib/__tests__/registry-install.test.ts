import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Checks that every component in `public/r/*.json` still resolves once it has
 * been copied into somebody else's project.
 *
 * This exists because **the file we ship is not the file we wrote.** A registry
 * item declares a `target` for each of its files, and `shadcn add` writes them
 * there — usually flattening `registry/snap-cn/<slug>/foo.ts` down to
 * `components/snap-cn/<slug>-foo.ts`. Nothing in the repo's own toolchain sees
 * that: `tsc` type-checks the source tree, where the imports are fine.
 *
 * `type-morph` shipped broken for exactly this reason. Its `index.tsx` imported
 * `./timeline`, the manifest landed that file as `type-morph-timeline.ts`, and
 * every single install of it 404'd on the import. It type-checked here, it
 * built, it rendered, it passed every test, and it was dead on arrival in a
 * user's project. `pulsing-border` imported `remotion` without declaring it.
 * Thirteen components led their font stack with `var(--font-geist-sans)`, which
 * is not a font a render has.
 *
 * So the rule this file enforces: resolve the *manifest*, not the source.
 */

const ROOT = process.cwd();
const R = path.join(ROOT, "public/r");

type File = { path: string; target?: string; content: string };
type Item = {
  name: string;
  files?: File[];
  dependencies?: string[];
  registryDependencies?: string[];
};

const items: Item[] = fs
  .readdirSync(R)
  .filter((f) => f.endsWith(".json") && f !== "registry.json")
  .map((f) => JSON.parse(fs.readFileSync(path.join(R, f), "utf8")) as Item);

/** shadcn assumes these; a Remotion project has them before it has us. */
const AMBIENT = new Set(["react", "react-dom"]);

const targetOf = (f: File) => f.target ?? f.path;
const stem = (t: string) => t.replace(/\.(tsx?|jsx?)$/, "");

/** Every `from "…"` and bare `import "…"` in a file. */
function imports(src: string): string[] {
  const out: string[] = [];
  const re =
    /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s+["']([^"']+)["']|(?:^|\n)\s*import\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null = re.exec(src);
  while (m) {
    const spec = m[1] ?? m[2];
    if (spec) out.push(spec);
    m = re.exec(src);
  }
  return out;
}

/** `https://snapcn.dev/r/caret.json` and `caret` are the same dependency. */
const depName = (d: string) =>
  d.replace(/^https?:\/\/[^/]+\/r\//, "").replace(/\.json$/, "");

/** The file with its comments dropped — a rule can be *named* in a comment. */
const code = (src: string) =>
  src
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");

const owners = new Map<string, string>();
for (const it of items) {
  for (const f of it.files ?? []) owners.set(stem(targetOf(f)), it.name);
}

describe("registry install", () => {
  it("has something to check", () => {
    expect(items.length).toBeGreaterThan(20);
  });

  it("never lands two components on the same file", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const it of items) {
      for (const f of it.files ?? []) {
        const t = targetOf(f);
        const prev = seen.get(t);
        if (prev && prev !== it.name)
          clashes.push(`${t}: ${prev} vs ${it.name}`);
        seen.set(t, it.name);
      }
    }
    expect(clashes).toEqual([]);
  });

  it("resolves every relative import against the targets, not the source tree", () => {
    // The type-morph bug. `./timeline` next to `type-morph/index.tsx` in the
    // repo is `./type-morph-timeline` once both have been flattened into
    // `components/snap-cn/`, and only the manifest knows that.
    const broken: string[] = [];
    for (const it of items) {
      const mine = new Set((it.files ?? []).map((f) => stem(targetOf(f))));
      for (const f of it.files ?? []) {
        const dir = path.posix.dirname(targetOf(f));
        for (const spec of imports(f.content)) {
          if (!spec.startsWith(".")) continue;
          const resolved = stem(
            path.posix.normalize(path.posix.join(dir, spec)),
          );
          if (!mine.has(resolved)) {
            broken.push(
              `${it.name}: ${targetOf(f)} imports "${spec}" → ${resolved}`,
            );
          }
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("declares every snapcn component it imports", () => {
    const undeclared: string[] = [];
    for (const it of items) {
      const rdeps = new Set((it.registryDependencies ?? []).map(depName));
      const mine = new Set((it.files ?? []).map((f) => stem(targetOf(f))));
      for (const f of it.files ?? []) {
        for (const spec of imports(f.content)) {
          if (!spec.startsWith("@/components/snap-cn/")) continue;
          const t = stem(`components/snap-cn/${spec.slice(21)}`);
          if (mine.has(t)) continue;
          const owner = owners.get(t);
          if (!owner) undeclared.push(`${it.name}: nothing installs "${spec}"`);
          else if (!rdeps.has(owner)) {
            undeclared.push(
              `${it.name}: imports "${spec}" without @snapcn/${owner}`,
            );
          }
        }
      }
    }
    expect(undeclared).toEqual([]);
  });

  it("declares the shared libraries it imports", () => {
    const undeclared: string[] = [];
    for (const it of items) {
      const rdeps = new Set((it.registryDependencies ?? []).map(depName));
      for (const f of it.files ?? []) {
        for (const spec of imports(f.content)) {
          if (spec.startsWith("@/lib/snap-cn-ui") && !rdeps.has("snap-cn-ui")) {
            undeclared.push(`${it.name}: "${spec}" without snap-cn-ui`);
          }
          if (spec.startsWith("@/lib/utils") && !rdeps.has("utils")) {
            undeclared.push(`${it.name}: "${spec}" without "utils"`);
          }
        }
      }
    }
    expect(undeclared).toEqual([]);
  });

  it("imports no app path a stranger's project will not have", () => {
    // `@/lib/snap-cn-ui`, `@/lib/utils` and `@/components/snap-cn/*` are the
    // only `@/` roots an install actually creates. Anything else — `@/hooks`,
    // `@/config`, `@/registry` — is a path that exists here and nowhere else.
    const KNOWN = /^@\/(lib\/(snap-cn-ui|utils)|components\/snap-cn\/)/;
    const strays: string[] = [];
    for (const it of items) {
      for (const f of it.files ?? []) {
        for (const spec of imports(f.content)) {
          if (spec.startsWith("@/") && !KNOWN.test(spec)) {
            strays.push(`${it.name}: ${targetOf(f)} imports "${spec}"`);
          }
        }
      }
    }
    expect(strays).toEqual([]);
  });

  it("declares every npm package it imports", () => {
    const undeclared: string[] = [];
    for (const it of items) {
      const deps = new Set(it.dependencies ?? []);
      for (const f of it.files ?? []) {
        for (const spec of imports(f.content)) {
          if (spec.startsWith(".") || spec.startsWith("@/")) continue;
          const pkg = spec.startsWith("@")
            ? spec.split("/").slice(0, 2).join("/")
            : (spec.split("/")[0] as string);
          if (!AMBIENT.has(pkg) && !deps.has(pkg) && !deps.has(spec)) {
            undeclared.push(
              `${it.name}: imports "${spec}", "${pkg}" not in dependencies`,
            );
          }
        }
      }
    }
    expect(undeclared).toEqual([]);
  });

  it("paints nothing through a CSS variable", () => {
    // The render entries import `app/globals.css`, so the token palette is in
    // the bundle — but `--font-geist-sans` is declared by `next/font` in
    // `app/layout.tsx`, which a bundle never runs. A stack led by that variable
    // therefore resolves in the Player and to nothing in the mp4: the same
    // component, two faces. Measured — stripping it from the thirteen
    // components that had it produced byte-identical mp4s, so it had never
    // been doing anything in a render at all.
    const found: string[] = [];
    for (const it of items) {
      for (const f of it.files ?? []) {
        for (const line of code(f.content).split("\n")) {
          if (line.includes("var(--")) found.push(`${it.name}: ${line.trim()}`);
        }
      }
    }
    expect(found).toEqual([]);
  });

  it("is deterministic — a render must be reproducible frame for frame", () => {
    const found: string[] = [];
    for (const it of items) {
      for (const f of it.files ?? []) {
        for (const bad of [
          "Math.random(",
          "Date.now(",
          "setTimeout(",
          "setInterval(",
        ]) {
          if (f.content.includes(bad)) found.push(`${it.name}: ${bad})`);
        }
      }
    }
    expect(found).toEqual([]);
  });

  it("promotes no layer to buy smoothness", () => {
    // Every one of these hands the transform to the compositor, which resamples
    // a bitmap instead of re-rasterising real type. They are the same trick
    // wearing different hats and they are not fixes. `willChange` is allowed,
    // but only gated on `getRemotionEnvironment().isRendering`.
    const found: string[] = [];
    for (const it of items) {
      for (const f of it.files ?? []) {
        const src = code(f.content);
        for (const bad of [
          "translateZ(0)",
          "translate3d(",
          "backfaceVisibility",
          "perspective(1px)",
        ]) {
          if (src.includes(bad)) found.push(`${it.name}: ${bad}`);
        }
        if (src.includes("willChange") && !src.includes("isRendering")) {
          found.push(`${it.name}: willChange not gated on isRendering`);
        }
      }
    }
    expect(found).toEqual([]);
  });
});
