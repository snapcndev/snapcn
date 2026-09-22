import { describe, expect, it } from "vitest";
import { elementSource } from "../element-source.mts";

/**
 * The inliner's one job is to turn a component plus the lib it imports into a
 * single file Studio accepts and a user's `tsc` does too. The fixture carries
 * the real hazard in miniature: culori's `interpolate` in the lib against
 * Remotion's in the component — 21 components, and a duplicate import there is
 * a file that does not compile in somebody's project.
 */
const lib = [
  {
    path: "registry/snap-cn-ui/core/index.ts",
    content: `export { mix } from "./color";
export { useTheme } from "./theme";
export { unused } from "./unused";
`,
  },
  {
    path: "registry/snap-cn-ui/core/theme.ts",
    content: `import { mix } from "./color";
export const useTheme = () => mix("red", "blue");
`,
  },
  {
    path: "registry/snap-cn-ui/core/color.ts",
    content: `// snapcn UI Core · snapcn
import { formatHex, interpolate } from "culori";
export function mix(a: string, b: string) {
  return interpolate([a, b])(0.5);
}
/** Arrives with the file, read by nothing in this component. */
export const toHex = (c: string) => formatHex(c);
`,
  },
  {
    path: "registry/snap-cn-ui/core/unused.ts",
    content: "export const unused = 1;\n",
  },
];

const component = `// Demo · snapcn
"use client";

import { interpolate } from "remotion";
import { mix, useTheme } from "@/lib/snap-cn-ui";

export const SPEED = 2;
export const leftoverFrames = () => SPEED * 10;
export interface DemoProps {
  at: number;
}
export const Demo = ({ at }: DemoProps) => (
  <div style={{ color: useTheme(), opacity: interpolate(at, [0, 1], [0, SPEED]) }}>
    {mix("a", "b")}
  </div>
);
export default Demo;
`;

describe("elementSource", () => {
  it("inlines the lib it uses as one file with one exported component", () => {
    const element = elementSource(component, "Demo", lib);
    const code = element?.sourceCode ?? "";

    expect(
      code.startsWith("// Demo · snapcn\n// snapcn UI Core · snapcn\n"),
    ).toBe(true);
    expect(code).toContain('import { interpolate } from "remotion";');
    expect(code).toContain(
      'import { interpolate as culoriInterpolate } from "culori";',
    );
    expect(code).toContain("return culoriInterpolate([a, b])(0.5);");
    // What Studio counts, with the regex it counts with.
    expect(
      [...code.matchAll(/export\s+(?:const|function)\s+([A-Z_$][\w$]*)/g)].map(
        (m) => m[1],
      ),
    ).toEqual(["Demo"]);
    expect(code).toContain("export interface DemoProps");
    expect(code.indexOf("function mix")).toBeLessThan(
      code.indexOf("const useTheme"),
    );
    expect(code).not.toMatch(/unused|use client|export default/);
    // What nothing reads is an error under a template's `noUnusedLocals`.
    expect(code).not.toMatch(/toHex|formatHex|leftoverFrames/);
    expect(element?.modules).toEqual(["remotion", "culori"]);
  });

  it("inlines the components it builds on, when it has them", () => {
    const input = {
      path: "registry/snap-cn-ui/input/index.tsx",
      content: `import { cn } from "@/lib/utils";
import { mix } from "@/lib/snap-cn-ui";
const SPEED = 1;
export const surface = () => mix("a", "b") + SPEED;
export function Input() {
  return <div className={cn("x")} />;
}
`,
    };
    const card = `import { surface } from "@/components/snap-cn/input";
const SPEED = 2;
export const Card = () => <div>{surface() + SPEED}</div>;
`;
    const deps = { "@/components/snap-cn/input": input };
    const code = elementSource(card, "Card", lib, deps)?.sourceCode ?? "";

    expect(code).toContain("const surface = () =>");
    // Its helper yields the name to the component's.
    expect(code).toContain("const SPEEDInput = 1;");
    expect(code).toContain('mix("a", "b") + SPEEDInput');
    // `Input` and the `cn` only it used go, so `@/lib/utils` is never needed.
    expect(code).not.toMatch(/function Input|cn\(|@\/lib\/utils|@\/components/);

    const usesInput = `import { Input } from "@/components/snap-cn/input";
export const Form = () => <Input />;
`;
    expect(() => elementSource(usesInput, "Form", lib, deps)).toThrow(
      /not inlined, still used: cn/,
    );
  });

  it("leaves a component built on another component to the CLI", () => {
    const composite = `import { Input } from "@/components/snap-cn/input";
export const Form = () => <Input />;
`;
    expect(elementSource(composite, "Form", lib)).toBeNull();
  });
});
