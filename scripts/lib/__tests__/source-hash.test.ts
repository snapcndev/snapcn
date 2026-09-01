import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { sourceHash } from "../source-hash.mts";

/**
 * The staleness detector, which is the only thing standing between a measured
 * number and the component it stopped describing. A `sourceHash` that returns a
 * constant does not fail loudly — it believes every measurement forever, which
 * is the exact failure `registry/__measured__.json` exists to make impossible.
 *
 * A throwaway tree rather than this repo's own registry: the interesting asserts
 * all EDIT a file, and doing that to a real component during a test run is how
 * you lose one.
 */
const repo = mkdtempSync(path.join(tmpdir(), "snapcn-source-hash-"));
const write = (rel: string, body: string) => {
  mkdirSync(path.join(repo, path.dirname(rel)), { recursive: true });
  writeFileSync(path.join(repo, rel), body);
};

write(
  "registry/snap-cn/widget/index.tsx",
  "export const Widget = () => null;\n",
);
write("registry/snap-cn/widget/config.ts", "export const widgetConfig = {};\n");
write("registry/snap-cn-ui/theme.ts", "export const ink = '#000';\n");

afterAll(() => rmSync(repo, { recursive: true, force: true }));

describe("sourceHash", () => {
  it("is stable for an unchanged component", () => {
    expect(sourceHash(repo, "widget")).toBe(sourceHash(repo, "widget"));
  });

  it("moves when the component's own source changes", () => {
    const before = sourceHash(repo, "widget");
    write(
      "registry/snap-cn/widget/index.tsx",
      "export const Widget = () => <b />;\n",
    );
    expect(sourceHash(repo, "widget")).not.toBe(before);
  });

  // The half that is easy to leave out and expensive to leave out: a theme edit
  // changes what every component's ink weighs, so a measurement taken before it
  // is a measurement of a different picture.
  it("moves when the shared snap-cn-ui tier changes", () => {
    const before = sourceHash(repo, "widget");
    write("registry/snap-cn-ui/theme.ts", "export const ink = '#111';\n");
    expect(sourceHash(repo, "widget")).not.toBe(before);
  });

  it("ignores __tests__, which cannot change a rendered frame", () => {
    const before = sourceHash(repo, "widget");
    write(
      "registry/snap-cn/widget/__tests__/widget.test.ts",
      "it.skip('x', () => {});\n",
    );
    expect(sourceHash(repo, "widget")).toBe(before);
  });

  // null, not a hash of nothing: a name with no directory is a measurement that
  // cannot be about anything, and it has to be droppable rather than verifiable.
  it("returns null for a component that does not exist", () => {
    expect(sourceHash(repo, "not-a-component")).toBeNull();
  });
});
