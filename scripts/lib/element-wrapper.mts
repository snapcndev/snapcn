import ts from "typescript";
import type { ControlType } from "../../lib/customizer-config.ts";

/**
 * How one component sits on somebody else's footage as a Remotion Studio
 * Element — the part of the Element guidelines a registry component does not
 * answer on its own: https://www.remotion.dev/docs/elements/contributing
 *
 * A snapcn component is a scene: it lays itself out in whatever
 * `useVideoConfig()` reports, and several paint the page they were designed on.
 * Dropped into a composition as-is it fills the frame, covers the footage and
 * exposes nothing to the Inspector. The generated wrapper fixes all three
 * without touching the component, so the source stays the exact bytes
 * `shadcn add` installs (and `motion:measure` hashes):
 *
 * - `component-owned-sequence`: one timeline layer, moved and trimmed as one,
 *   with an `Interactive.withSchema()` schema built from the same controls the
 *   site's customizer shows;
 * - `<Sequence width height>`: `useVideoConfig()` inside it reports the box, so
 *   the scene lays itself out there instead of across the composition;
 * - an opacity fade in and out, because an overlay has to leave. Opacity only:
 *   nothing moves, so no glyph can snap to the pixel grid on the way out;
 * - `hideLayers()`: the scene's own layers kept out of the timeline, so the
 *   Element really is the one layer.
 */
export interface Studio {
  /** The box it renders in, in px. Sized to the scene, not to the frame. */
  box: readonly [number, number];
  /**
   * What the scene lays itself out in, when that is not the box: a scene that
   * scales a fixed stage to fit, or pins its line a set distance from the
   * bottom, keeps its stage and the box crops it to the content, centred.
   */
  stage?: readonly [number, number];
  /** The controls the Inspector shows. Style switches and timing internals stay in code. */
  controls: readonly string[];
  /**
   * Values that differ from the site preview: a transparent page, copy that is
   * not ours. Applied under whatever Studio passes, so a reset lands here too.
   */
  props?: Record<string, unknown>;
  /** Config controls the component must not receive — a name the Sequence owns, a broken knob. */
  drop?: readonly string[];
  /**
   * `string[]` props, edited as one comma-separated line — the Inspector has no
   * list of strings, and commas are how this registry already writes one.
   */
  list?: readonly string[];
  /** Clip to the box — for a scene drawn to be cut off by the frame edge. */
  clip?: true;
  /** No fade out: its content already leaves (captions cut page by page). */
  exit?: false;
  /** Frames, when the preview's length is not the Element's. */
  durationInFrames?: number;
}

/**
 * Every inherited text property, pinned to what a bare Remotion page gives it —
 * the page each component is designed, measured and rendered on. Without this a
 * host's `color: white` or `lineHeight: 1.5` on a parent reaches into the scene
 * and changes it (the guidelines' "set explicit defaults for inherited visual
 * properties"); with it, 18 of 18 render identically under a hostile parent.
 */
const INHERITED = [
  'color: "black",',
  'fontFamily: "initial",',
  "fontSize: 16,",
  'fontStyle: "normal",',
  'fontVariant: "normal",',
  "fontWeight: 400,",
  'fontStretch: "normal",',
  'fontKerning: "auto",',
  'fontFeatureSettings: "normal",',
  'fontVariationSettings: "normal",',
  'lineHeight: "normal",',
  'letterSpacing: "normal",',
  'wordSpacing: "normal",',
  'textAlign: "start",',
  "textIndent: 0,",
  'textTransform: "none",',
  'textShadow: "none",',
  'textRendering: "auto",',
  'whiteSpace: "normal",',
  'wordBreak: "normal",',
  'overflowWrap: "normal",',
  'hyphens: "manual",',
  'direction: "ltr",',
  'visibility: "visible",',
].join(" ");

/** Frames of the fade in, and of the fade out. */
const FADE_IN = 6;
const FADE_OUT = 12;
/** Frames added after the preview's length: a beat of rest, then the fade out. */
export const TAIL = 8 + FADE_OUT;

/** The props `Interactive.baseSchema` and the Sequence own. */
const RESERVED = new Set([
  "from",
  "durationInFrames",
  "trimBefore",
  "freeze",
  "hidden",
  "name",
  "showInTimeline",
  "style",
  "controls",
]);

const lit = (v: unknown) => JSON.stringify(v);
const numeric = (options: readonly string[]) =>
  options.every((o) => /^\d+$/.test(o));

/** One Inspector control, as an `InteractivitySchema` field. */
function field(c: ControlType, value: unknown): string {
  const label = `description: ${lit(c.label)}`;
  switch (c.type) {
    case "text":
      return `{ type: "text-content", default: ${lit(value)}, ${label} }`;
    case "number":
    case "number-input":
      return `{ type: "number", default: ${lit(value)}, min: ${c.min}, max: ${c.max}, step: ${c.step}, ${label}, hiddenFromList: false, keyframable: false }`;
    case "color":
      return `{ type: "color", default: ${value ? lit(value) : "undefined"}, ${label}, keyframable: false }`;
    case "boolean":
      return `{ type: "boolean", default: ${lit(value)}, ${label}, keyframable: false }`;
    case "image":
      return `{ type: "asset", assetType: "image", default: ${value ? lit(value) : "undefined"}, ${label} }`;
    case "select": {
      // A weight is a number to the component; an enum would write a string.
      if (numeric(c.options)) {
        const n = c.options.map(Number);
        return `{ type: "number", default: ${lit(value)}, min: ${Math.min(...n)}, max: ${Math.max(...n)}, step: ${n[1] - n[0]}, ${label}, hiddenFromList: false, keyframable: false }`;
      }
      if (!c.options.includes(String(value))) {
        throw new Error(`${value} is not an option of ${c.label}`);
      }
      return `{ type: "enum", default: ${lit(value)}, ${label}, variants: { ${c.options.map((o) => `${lit(o)}: {}`).join(", ")} } }`;
    }
  }
}

/**
 * The Element's own values: every customizer default (so the Element looks like
 * the page it was sent from), then the Element's overrides. A site-relative
 * asset is made absolute — it would 404 in someone else's project.
 */
export function elementDefaults(
  controls: Record<string, ControlType>,
  studio: Studio,
  site: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, c] of Object.entries(controls)) {
    if (studio.drop?.includes(key)) continue;
    let value: unknown = c.default;
    if (typeof value === "string" && /^\/(?!\/)/.test(value)) {
      value = `${site}${value}`;
    }
    if (c.type === "select" && numeric(c.options)) value = Number(value);
    // An unset colour or image is "" to the customizer, undefined to the component.
    if (value === "" && (c.type === "color" || c.type === "image")) continue;
    out[key] = value;
  }
  Object.assign(out, studio.props);
  for (const key of studio.list ?? []) {
    const v = out[key];
    if (Array.isArray(v)) out[key] = v.join(", ");
  }
  for (const key of Object.keys(out)) {
    if (RESERVED.has(key)) throw new Error(`${key} is owned by the Sequence`);
  }
  return out;
}

/**
 * The code appended to the inlined component. `scene` is the component, renamed
 * and no longer exported; the export is the schema-enabled wrapper, under the
 * component's own name, which is what Studio imports.
 */
export function studioWrapper({
  name,
  scene,
  title,
  studio,
  controls,
  defaults,
}: {
  name: string;
  scene: string;
  title: string;
  studio: Studio;
  controls: Record<string, ControlType>;
  defaults: Record<string, unknown>;
}): string {
  const [w, h] = studio.box;
  const [sw, sh] = studio.stage ?? studio.box;
  const list = studio.list ?? [];
  const schema = studio.controls.map((key) => {
    // A list is a prop the customizer never had a control for.
    const c: ControlType | undefined = list.includes(key)
      ? {
          type: "text",
          default: "",
          label: `${key[0].toUpperCase()}${key.slice(1)} (comma separated)`,
        }
      : controls[key];
    if (!c) throw new Error(`${name}: no control ${key}`);
    return `  ${key}: ${field(c, defaults[key])},`;
  });
  const props = list.length
    ? `Omit<ComponentProps<typeof ${scene}>, ${list.map(lit).join(" | ")}> & {\n${list.map((k) => `    readonly ${k}?: string;`).join("\n")}\n  }`
    : `ComponentProps<typeof ${scene}>`;
  const split = list
    .map((k) => ` ${k}={${k}?.split(",").map((w) => w.trim()).filter(Boolean)}`)
    .join("");
  const spread = list.length
    ? `const { ${list.join(", ")}, ...rest } = { ...${name}Defaults, ...props };`
    : `const rest = { ...${name}Defaults, ...props };`;

  return `
import { type ComponentProps, forwardRef, type ReactNode, useImperativeHandle, useRef } from "react";
import {
  AbsoluteFill,
  Interactive,
  type InteractiveBaseProps,
  type InteractiveTransformProps,
  type InteractivitySchema,
  Sequence,
  type SequenceControls,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/* ─────────────────────────────────────────────────────────────────────────
   Remotion Studio
   ───────────────────────────────────────────────────────────────────────── */

type ${name}ElementProps = InteractiveBaseProps &
  InteractiveTransformProps &
  ${props};

/** What a prop falls back to when Studio does not pass it, reset included. */
const ${name}Defaults = ${lit(defaults)} satisfies Partial<${name}ElementProps>;

const ${name}Schema = {
  ...Interactive.baseSchema,
${schema.join("\n")}
  ...Interactive.transformSchema,
} as const satisfies InteractivitySchema;

/**
 * In over the first frames, out over the last. Opacity only: nothing moves, so
 * no glyph can snap to the pixel grid on the way out.
 */
function ${name}Fade({ children }: { children: ReactNode }) {
  const frame = useCurrentFrame();
  const enter = Math.min(1, (frame + 1) / ${FADE_IN});
  ${
    studio.exit === false
      ? "const leave = 1;"
      : `const { durationInFrames } = useVideoConfig();
  const left = Math.min(1, Math.max(0, (durationInFrames - 1 - frame) / ${FADE_OUT}));
  const leave = left * left;`
  }
  return <AbsoluteFill style={{ opacity: enter * leave }}>{children}</AbsoluteFill>;
}

const ${name}Inner = forwardRef<
  HTMLDivElement,
  ${name}ElementProps & { readonly controls: SequenceControls | undefined }
>(
  (
    {
      controls,
      name,
      style,
      from,
      durationInFrames,
      trimBefore,
      freeze,
      hidden,
      showInTimeline,
      ...props
    },
    ref,
  ) => {
    const outlineRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => outlineRef.current as HTMLDivElement, []);
    ${spread}
    // The scene measures its copy once, on mount. An Inspector edit changes the
    // props without remounting it, so the key does.
    const key = JSON.stringify(props, (k, v) => (k === "children" ? undefined : v));

    // width/height are what useVideoConfig() reports inside the Sequence, so
    // the scene lays itself out in its stage rather than the whole composition.
    return (
      <Sequence
        layout="none"
        from={from}
        durationInFrames={durationInFrames}
        trimBefore={trimBefore}
        freeze={freeze}
        hidden={hidden}
        showInTimeline={showInTimeline}
        name={name ?? ${lit(title)}}
        controls={controls}
        outlineRef={outlineRef}
        width={${sw}}
        height={${sh}}
      >
        <div
          ref={outlineRef}
          style={{ position: "relative", width: ${w}, height: ${h},${studio.clip ? ' overflow: "hidden",' : ""} ${INHERITED} ...style }}
        >
          ${
            studio.stage
              ? `<div style={{ position: "absolute", left: ${(w - sw) / 2}, top: ${(h - sh) / 2}, width: ${sw}, height: ${sh} }}>
            <${name}Fade>
              <${scene} key={key} {...rest}${split} />
            </${name}Fade>
          </div>`
              : `<${name}Fade>
            <${scene} key={key} {...rest}${split} />
          </${name}Fade>`
          }
        </div>
      </Sequence>
    );
  },
);

export const ${name} = Interactive.withSchema({
  Component: ${name}Inner,
  componentName: "<${name}>",
  schema: ${name}Schema,
  supportsEffects: false,
});
`;
}

/** Remotion components that draw their own timeline row and take `showInTimeline`. */
const LAYERS = new Set([
  "AbsoluteFill",
  "Audio",
  "Html5Audio",
  "Html5Video",
  "Img",
  "Loop",
  "OffthreadVideo",
  "Sequence",
  "Video",
]);

/**
 * A component-owned-sequence Element is one timeline layer whose implementation
 * does not show as layers of its own. But every `<AbsoluteFill>`, `<Img>` and
 * `<OffthreadVideo>` is a row in Studio 4.0.52x, and a hidden parent does not
 * hide them — Word Gather arrived as a layer with three rows under it. So each
 * one rendered without a `showInTimeline` of its own gets `false`, ahead of any
 * spread so a caller's value still wins. The wrapper's Sequence sets its own and
 * stays the layer.
 */
export function hideLayers(source: string): string {
  const file = ts.createSourceFile(
    "element.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const layers = new Set<string>();
  for (const stmt of file.statements) {
    const named = ts.isImportDeclaration(stmt)
      ? stmt.importClause?.namedBindings
      : undefined;
    if (
      !named ||
      !ts.isNamedImports(named) ||
      (stmt as ts.ImportDeclaration).moduleSpecifier.getText() !== '"remotion"'
    ) {
      continue;
    }
    for (const el of named.elements) {
      if (LAYERS.has((el.propertyName ?? el.name).text))
        layers.add(el.name.text);
    }
  }
  const at: number[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      layers.has(node.tagName.text) &&
      !node.attributes.properties.some(
        (p) => ts.isJsxAttribute(p) && p.name.getText() === "showInTimeline",
      )
    ) {
      at.push(node.tagName.end);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  let out = source;
  for (const pos of at.sort((a, b) => b - a)) {
    out = `${out.slice(0, pos)} showInTimeline={false}${out.slice(pos)}`;
  }
  return out;
}
