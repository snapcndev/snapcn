import ts from "typescript";
import type { ControlType } from "../../lib/customizer-config.ts";

/**
 * How one component sits on somebody else's footage as a Remotion Studio
 * Element — the part of the Element guidelines a registry component does not
 * answer on its own: https://www.remotion.dev/elements/contributing
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
  /** Where the box sits in the stage, top-left, in px. Default: centred. */
  at?: readonly [number, number];
  /**
   * A scene prop under another name, `{ element: scene }` — for a prop whose
   * name the Sequence already owns (`from`).
   */
  alias?: Record<string, string>;
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
  /**
   * An array of pictures that are not objects of their own (they flash by a
   * frame or two each), as numbered picture fields: \`image1\` … \`imageN\`,
   * each with Studio's own picker, handed to the scene as one array.
   */
  slots?: { prop: string; key: string; count: number; label: string };
  /** Frames, when the preview's length is not the Element's. */
  durationInFrames?: number;
  /**
   * A control whose picture may be a video, and which picker Studio should
   * open for it. An Inspector asset field takes one type; a frame built for a
   * screen recording wants the video picker even though it also shows stills.
   */
  assets?: Record<string, "image" | "video" | "audio">;
  /**
   * The scene is a set of objects — cards, steps, messages — and each is its
   * own selectable, editable thing in Studio. The Element is then `wrapped`:
   * the exported component is a stage holding one call site per object, and
   * every object is outlined on the node the scene draws it as (see `Item` in
   * snap-cn-ui). Without this the scene is one interactive object.
   */
  items?: Items;
}

/** One kind of object in a scene, and how its values reach the scene's props. */
export interface Items {
  /** What one object is called in Studio: "Card", "Step", "Message". */
  noun: string;
  /** The field whose value names each object in the timeline. */
  nameFrom?: string;
  /** Each value one object carries. */
  fields: Record<string, ItemField>;
  /**
   * The scene's props from the objects' values, as a TypeScript arrow taking
   * the array of objects: `(o) => ({ …})`. Default: every field with a `from`
   * joined on its `sep` (or passed as an array without one).
   */
  build?: string;
  /**
   * The objects the Element starts with, or how to read them off its defaults.
   * Default: the `from` props split.
   */
  starter?:
    | readonly Record<string, string>[]
    | ((defaults: Record<string, unknown>) => Record<string, string>[]);
  /**
   * What Studio outlines. "node" (the default) is the element the scene wraps
   * in \`Item\`, transforms and all. "content" is everything that element
   * draws, measured every frame — for a scene that moves an object's parts
   * separately (lines that slide in one by one), where no one element holds
   * them all.
   */
  outline?: "node" | "content";
  /**
   * Which objects the scene draws, as a TypeScript arrow on one object's
   * values: \`(x) => Boolean(x.text?.trim())\`. A scene that drops blank
   * entries from its lists would otherwise hand every later object its
   * neighbour's outline; dropped here, the lists and the outlines agree.
   */
  keep?: string;
}

export interface ItemField {
  label: string;
  type: "text" | "image" | "video" | "enum";
  /** The choices of an "enum" field; the first is its default. */
  options?: readonly string[];
  /** The scene prop this field's values are a list in. */
  from?: string;
  /** How that list is written; none means it is an array. */
  sep?: string;
  /**
   * The prop on the node the scene draws the object as that shows this value.
   * Set, the object pushes its own value onto that node while Studio edits it,
   * so the change shows before the file is saved.
   */
  node?: string;
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
  // Studio's own crop and premount, on every layer: a prop of the same name
  // disappears from the Inspector into Studio's Crop section, in its units.
  "cropLeft",
  "cropRight",
  "cropTop",
  "cropBottom",
  "premountFor",
  "postmountFor",
  "layout",
]);

const lit = (v: unknown) => JSON.stringify(v);
const VIDEO = /\.(mp4|webm|mov|m4v)(\?|$)/i;

/** The picker a picture control opens: the Element's say, else what its default is. */
function assetFor(
  studio: Studio,
  key: string,
  value: unknown,
): "image" | "video" | "audio" {
  const said = studio.assets?.[key];
  if (said) return said;
  return typeof value === "string" && VIDEO.test(value) ? "video" : "image";
}

/** The numbered keys of an Element's \`slots\`, in order. */
export const slotKeys = (studio: Studio) =>
  studio.slots
    ? Array.from(
        { length: studio.slots.count },
        (_, i) => `${studio.slots?.key}${i + 1}`,
      )
    : [];

/** The shared font knob (FONT_FAMILY_CONTROL), whose "Default" means "unset". */
const isFont = (c: ControlType) =>
  c.type === "select" && (c as { brand?: string }).brand === "font";

const numeric = (options: readonly string[]) =>
  options.every((o) => /^\d+$/.test(o));

/** One Inspector control, as an `InteractivitySchema` field. */
function field(
  c: ControlType,
  value: unknown,
  asset: "image" | "video" | "audio" = "image",
): string {
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
      return `{ type: "asset", assetType: ${lit(asset)}, default: ${value ? lit(value) : "undefined"}, ${label} }`;
    case "select": {
      // Studio's own font picker: any Google font, and it writes the
      // \`loadFont()\` into the project itself. \`resolveFont\` passes a name it
      // does not know straight through, so the scene takes whatever it picks.
      if (isFont(c)) {
        return `{ type: "font-family", default: ${value === undefined ? "undefined" : lit(value)}, ${label} }`;
      }
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
  const renamed = Object.fromEntries(
    Object.entries(studio.alias ?? {}).map(([el, scene]) => [scene, el]),
  );
  for (const [sceneKey, c] of Object.entries(controls)) {
    if (studio.drop?.includes(sceneKey)) continue;
    const key = renamed[sceneKey] ?? sceneKey;
    let value: unknown = c.default;
    // A site-relative asset, or a `|` list of them (avatars, card images).
    if (
      typeof value === "string" &&
      value.split("|").every((p) => /^\/(?!\/)/.test(p.trim()))
    ) {
      value = value
        .split("|")
        .map((p) => `${site}${p.trim()}`)
        .join("|");
    }
    if (c.type === "select" && numeric(c.options)) value = Number(value);
    // An unset colour or image is "" to the customizer, undefined to the component.
    if (value === "" && (c.type === "color" || c.type === "image")) continue;
    // So is the default face: Studio's font picker has no "Default" entry.
    if (isFont(c) && value === "Default") continue;
    out[key] = value;
  }
  Object.assign(out, studio.props);
  if (studio.slots) {
    const list = (out[studio.slots.prop] ?? []) as string[];
    for (const [i, k] of slotKeys(studio).entries()) {
      if (list[i]) out[k] = list[i];
    }
    delete out[studio.slots.prop];
  }
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
  const [ax, ay] = studio.at ?? [(sw - w) / 2, (sh - h) / 2];
  const list = studio.list ?? [];
  const alias = studio.alias ?? {};
  const aliased = Object.keys(alias);
  const schema = studio.controls.map((key) => {
    // A list is a prop the customizer never had a control for.
    const c: ControlType | undefined = list.includes(key)
      ? {
          type: "text",
          default: "",
          label: `${key[0].toUpperCase()}${key.slice(1)} (comma separated)`,
        }
      : controls[alias[key] ?? key];
    if (!c) throw new Error(`${name}: no control ${key}`);
    return `  ${key}: ${field(c, defaults[key], assetFor(studio, key, defaults[key]))},`;
  });
  const slots = slotKeys(studio);
  for (const [i, k] of slots.entries()) {
    schema.push(
      `  ${k}: { type: "asset", assetType: "image", default: ${defaults[k] ? lit(defaults[k]) : "undefined"}, description: ${lit(`${studio.slots?.label} ${i + 1}`)} },`,
    );
  }
  const omitted = [
    ...list,
    ...aliased.map((k) => alias[k]),
    ...(studio.slots ? [studio.slots.prop] : []),
  ];
  const added = [
    ...list.map((k) => `    readonly ${k}?: string;`),
    ...slots.map((k) => `    readonly ${k}?: string;`),
    ...aliased.map(
      (k) =>
        `    readonly ${k}?: ComponentProps<typeof ${scene}>[${lit(alias[k])}];`,
    ),
  ];
  const props = omitted.length
    ? `Omit<ComponentProps<typeof ${scene}>, ${omitted.map(lit).join(" | ")}> & {\n${added.join("\n")}\n  }`
    : `ComponentProps<typeof ${scene}>`;
  const split = [
    ...list.map(
      (k) => ` ${k}={${k}?.split(",").map((w) => w.trim()).filter(Boolean)}`,
    ),
    ...aliased.map((k) => ` ${alias[k]}={${k}}`),
    ...(studio.slots
      ? [
          ` ${studio.slots.prop}={[${slots.join(", ")}].filter((s): s is string => Boolean(s))}`,
        ]
      : []),
  ].join("");
  const pulled = [...list, ...aliased, ...slots];
  const spread = pulled.length
    ? `const { ${pulled.join(", ")}, ...rest } = { ...${name}Defaults, ...props };`
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
              ? `<div style={{ position: "absolute", left: ${-ax}, top: ${-ay}, width: ${sw}, height: ${sh} }}>
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

/**
 * The scene's parameter defaults, made the Element's. The wrapper passes every
 * one of them, so the scene's own are never read — but they are what someone
 * reading the installed file sees, and several of them are snapcn's: its mark,
 * its roster, its posters. Pointing them at the Element's values makes the file
 * say what it renders, and lets pruning drop the constants only they used.
 * A literal where the value is one; the defaults object where it is data.
 */
export function adoptDefaults(
  source: string,
  scene: string,
  name: string,
  studio: Studio,
  defaults: Record<string, unknown>,
): string {
  const file = ts.createSourceFile(
    "element.tsx",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const fn = file.statements.find(
    (s): s is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(s) && s.name?.text === scene,
  );
  const pattern = fn?.parameters[0]?.name;
  if (!pattern || !ts.isObjectBindingPattern(pattern)) return source;
  const byScene = Object.fromEntries(
    Object.keys(defaults)
      .filter((k) => !studio.list?.includes(k))
      .map((k) => [studio.alias?.[k] ?? k, k]),
  );
  const edits: [number, number, string][] = [];
  for (const el of pattern.elements) {
    const key = (el.propertyName ?? el.name).getText();
    const own = byScene[key];
    if (!el.initializer || own === undefined) continue;
    const value = defaults[own];
    const text =
      value !== null && typeof value === "object"
        ? `${name}Defaults.${own}`
        : JSON.stringify(value);
    edits.push([el.initializer.getStart(), el.initializer.end, text]);
  }
  let out = source;
  for (const [a, b, text] of edits.reverse()) {
    out = out.slice(0, a) + text + out.slice(b);
  }
  return out;
}

/** An object's starter values: the Element's own list, else its `from` props split. */
export function itemStarter(
  items: Items,
  defaults: Record<string, unknown>,
): Record<string, string>[] {
  if (typeof items.starter === "function") return items.starter(defaults);
  if (items.starter) return items.starter.map((o) => ({ ...o }));
  const columns = Object.entries(items.fields).map(([key, f]) => {
    const v = f.from ? defaults[f.from] : undefined;
    const list = Array.isArray(v)
      ? v.map(String)
      : typeof v === "string" && f.sep
        ? v
            .split(f.sep)
            .map((x) => x.trim())
            .filter(Boolean)
        : [];
    return [key, list] as const;
  });
  const n = Math.max(0, ...columns.map(([, l]) => l.length));
  return Array.from({ length: n }, (_, i) =>
    Object.fromEntries(columns.map(([k, l]) => [k, l[i] ?? ""])),
  );
}

/** Where a field's list goes in the scene's props — omitted from the stage's own. */
const itemProps = (items: Items) =>
  Object.values(items.fields)
    .map((f) => f.from)
    .filter((f): f is string => Boolean(f));

/**
 * The code appended to the inlined scene for a `wrapped` Element: the objects,
 * the stage that hosts them, and the exported component — the stage with one
 * call site per object, written out literally so Studio edits them in place.
 */
export function studioItemsWrapper({
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
  studio: Studio & { items: Items };
  controls: Record<string, ControlType>;
  defaults: Record<string, unknown>;
}): string {
  const items = studio.items;
  const obj = `${name}${items.noun.replace(/\W/g, "")}`;
  const stage = `${name}Stage`;
  const [w, h] = studio.box;
  const [sw, sh] = studio.stage ?? studio.box;
  const [ax, ay] = studio.at ?? [(sw - w) / 2, (sh - h) / 2];
  const list = studio.list ?? [];
  const alias = studio.alias ?? {};
  const aliased = Object.keys(alias);
  const fromKeys = itemProps(items);

  // ── The object ──────────────────────────────────────────────────────────
  const fieldEntries = Object.entries(items.fields);
  for (const [k] of fieldEntries) {
    if (
      RESERVED.has(k) ||
      ["name", "style", "node", "slot", "report", "controls"].includes(k)
    ) {
      throw new Error(`${name}: an item field cannot be called ${k}`);
    }
  }
  const values = fieldEntries
    .map(([k]) => `  readonly ${k}?: string;`)
    .join("\n");
  const objSchema = fieldEntries
    .map(([k, f]) => {
      const text = `description: ${lit(f.label)}`;
      if (f.type === "enum") {
        if (!f.options?.length) throw new Error(`${name}: ${k} has no options`);
        return `  ${k}: { type: "enum", default: ${lit(f.options[0])}, ${text}, variants: { ${f.options.map((o) => `${lit(o)}: {}`).join(", ")} } },`;
      }
      return f.type === "text"
        ? `  ${k}: { type: "text-content", default: "", ${text} },`
        : `  ${k}: { type: "asset", assetType: ${lit(f.type)}, default: undefined, ${text} },`;
    })
    .join("\n");
  const pushed = fieldEntries
    .filter(([, f]) => f.node)
    .map(
      ([k, f]) =>
        `        ...(${k} === undefined ? null : { ${lit(f.node)}: ${k} }),`,
    )
    .join("\n");
  const pulled = fieldEntries.map(([k]) => k).join(", ");

  // ── The stage ───────────────────────────────────────────────────────────
  const stageControls = studio.controls.filter((k) => !fromKeys.includes(k));
  const schema = stageControls.map((key) => {
    const c: ControlType | undefined = list.includes(key)
      ? {
          type: "text",
          default: "",
          label: `${key[0].toUpperCase()}${key.slice(1)} (comma separated)`,
        }
      : controls[alias[key] ?? key];
    if (!c) throw new Error(`${name}: no control ${key}`);
    return `  ${key}: ${field(c, defaults[key], assetFor(studio, key, defaults[key]))},`;
  });
  const omitted = [...list, ...aliased.map((k) => alias[k]), ...fromKeys];
  const added = [
    ...list.map((k) => `    readonly ${k}?: string;`),
    ...aliased.map(
      (k) =>
        `    readonly ${k}?: ComponentProps<typeof ${scene}>[${lit(alias[k])}];`,
    ),
    "    readonly children?: ReactNode;",
  ];
  const sceneProps = `${
    omitted.length
      ? `Omit<ComponentProps<typeof ${scene}>, ${omitted.map(lit).join(" | ")}>`
      : `ComponentProps<typeof ${scene}>`
  } & {\n${added.join("\n")}\n  }`;
  const split = [
    ...list.map(
      (k) => ` ${k}={${k}?.split(",").map((w) => w.trim()).filter(Boolean)}`,
    ),
    ...aliased.map((k) => ` ${alias[k]}={${k}}`),
  ].join("");
  const pulledStage = [...list, ...aliased];
  const stageDefaults = Object.fromEntries(
    Object.entries(defaults).filter(([k]) => !fromKeys.includes(k)),
  );
  const spread = pulledStage.length
    ? `const { ${pulledStage.join(", ")}, ...rest } = { ...${name}Defaults, ...props };`
    : `const rest = { ...${name}Defaults, ...props };`;
  const build =
    items.build ??
    `(o) => ({\n${fieldEntries
      .filter(([, f]) => f.from)
      .map(([k, f]) =>
        f.sep
          ? `    ${f.from}: o.map((x) => clean(x.${k}, ${lit(f.sep)})).join(${lit(f.sep)}),`
          : `    ${f.from}: o.map((x) => x.${k} ?? ""),`,
      )
      .join("\n")}\n  })`;

  // ── Content outlines ────────────────────────────────────────────────────
  const content = items.outline === "content";
  const reactImports = [
    "Children",
    "type ComponentProps",
    "type CSSProperties",
    "cloneElement",
    "useLayoutEffect",
    "useState",
    "forwardRef",
    "isValidElement",
    "type ReactElement",
    "type ReactNode",
    "type Ref",
    "useImperativeHandle",
    "useRef",
  ];

  // ── The call sites ──────────────────────────────────────────────────────
  const starter = itemStarter(items, defaults);
  const attr = (k: string, v: unknown) =>
    typeof v === "string" && !/["{}<>\n]/.test(v)
      ? `${k}="${v}"`
      : `${k}={${lit(v)}}`;
  const stageAttrs = stageControls
    .filter((k) => k in stageDefaults)
    .map((k) => `      ${attr(k, stageDefaults[k])}`)
    .join("\n");
  const sites = starter
    .map((o, i) => {
      const label =
        (items.nameFrom && o[items.nameFrom]) || `${items.noun} ${i + 1}`;
      const props = [
        attr("name", label),
        ...fieldEntries.map(([k]) => attr(k, o[k] ?? "")),
      ];
      return `      <${obj}\n        ${props.join("\n        ")}\n      />`;
    })
    .join("\n");

  return `
import {
  ${reactImports.join(",\n  ")},
} from "react";
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
import { type ItemHost, ItemHostProvider } from "@/lib/snap-cn-ui";

/* ─────────────────────────────────────────────────────────────────────────
   Remotion Studio: one ${items.noun.toLowerCase()} at a time
   ───────────────────────────────────────────────────────────────────────── */

${
  content
    ? `/**
 * Everything the element paints, in page pixels: its text runs, its media, and every
 * box with a fill or a border, each cut to the boxes that clip it.
 */
function ${name}Painted(el: Element): [number, number, number, number] | null {
  let u: [number, number, number, number] | null = null;
  const add = (r: DOMRect, from: Element) => {
    let b: [number, number, number, number] = [r.left, r.top, r.right, r.bottom];
    for (let a: Element | null = from; a; a = a === el ? null : a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.opacity === "0" || cs.visibility === "hidden") return;
      if (a !== from && cs.overflow !== "visible") {
        const c = a.getBoundingClientRect();
        b = [Math.max(b[0], c.left), Math.max(b[1], c.top), Math.min(b[2], c.right), Math.min(b[3], c.bottom)];
      }
    }
    if (b[2] <= b[0] || b[3] <= b[1]) return;
    u = u ? [Math.min(u[0], b[0]), Math.min(u[1], b[1]), Math.max(u[2], b[2]), Math.max(u[3], b[3])] : b;
  };
  const walk = (e: Element) => {
    const cs = getComputedStyle(e);
    if (cs.display === "none") return;
    const media = /^(img|video|canvas|svg)$/i.test(e.tagName);
    if (media || cs.backgroundColor !== "rgba(0, 0, 0, 0)" || cs.backgroundImage !== "none" || parseFloat(cs.borderTopWidth) > 0) add(e.getBoundingClientRect(), e);
    if (media) return;
    for (const n of Array.from(e.childNodes)) {
      if (n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) {
        const range = document.createRange();
        range.selectNodeContents(n);
        for (const r of Array.from(range.getClientRects())) add(r, e);
      } else if (n.nodeType === Node.ELEMENT_NODE) walk(n as Element);
    }
  };
  walk(el);
  return u;
}

`
    : ""
}type ${obj}Values = {
${values}
};

type ${obj}Props = InteractiveBaseProps &
  Omit<InteractiveTransformProps, "style"> &
  ${obj}Values & {
    readonly style?: CSSProperties | null;
    /** The node the scene draws this ${items.noun.toLowerCase()} as; set by the stage, never by hand. */
    readonly node?: ReactElement;
    /** Where its outline is drawn when it follows its content; set by the stage too. */
    readonly slot?: { current: HTMLDivElement | null };
    /** Hands its values back to the stage while Studio edits them; set by the stage too. */
    readonly report?: (values: ${obj}Values) => void;
  };

const ${obj}Schema = {
  ...Interactive.baseSchema,
${objSchema}
  ...Interactive.transformSchema,
} as const satisfies InteractivitySchema;

/**
 * One ${items.noun.toLowerCase()}. The scene decides where it is on every frame and draws it;
 * this puts that drawing inside the ${items.noun.toLowerCase()}'s own Sequence with the outline
 * on it, so Studio can select it on the canvas and the outline moves with it.
 * Its values reach the scene through the stage; the ones that show on the
 * node are pushed onto it as well, so an edit shows before the file saves.
 */
const ${obj}Inner = forwardRef<
  Element,
  ${obj}Props & { readonly controls: SequenceControls | undefined }
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
      node,${content ? "\n      slot," : ""}
      report,
      ${pulled},
    },
    ref,
  ) => {
    const outlineRef = useRef<Element>(null);
    // Studio's live values arrive here, not at the call site the stage reads,
    // so they go back up to it: the scene shows an edit while it is typed.
    useLayoutEffect(() => {
      report?.({ ${pulled} });
    });
    useImperativeHandle(ref, () => (${content ? "slot?.current ?? " : ""}outlineRef.current) as Element, []);${
      content
        ? `
    // The outline is a box of its own on the stage, moved every frame to
    // cover what the node draws: its parts move separately, so no one
    // element of the scene's holds them all.
    const nodeRef = useRef<Element>(null);
    useLayoutEffect(() => {
      const box = slot?.current;
      const root = box?.parentElement;
      if (!box || !root) return;
      const b = nodeRef.current ? ${name}Painted(nodeRef.current) : null;
      if (!b) {
        box.style.display = "none";
        return;
      }
      const r = root.getBoundingClientRect();
      const k = root.offsetWidth / (r.width || 1);
      box.style.display = "block";
      box.style.left = \`\${(b[0] - r.left) * k}px\`;
      box.style.top = \`\${(b[1] - r.top) * k}px\`;
      box.style.width = \`\${(b[2] - b[0]) * k}px\`;
      box.style.height = \`\${(b[3] - b[1]) * k}px\`;
    });`
        : ""
    }
    if (!node) return null;
    const own = node as ReactElement<{ ref?: Ref<Element>; style?: CSSProperties }>;
    return (
      <Sequence
        layout="none"
        from={from}
        durationInFrames={durationInFrames}
        trimBefore={trimBefore}
        freeze={freeze}
        hidden={hidden}
        showInTimeline={showInTimeline}
        name={name ?? ${lit(items.noun)}}
        controls={controls}
        outlineRef={${content ? "slot ?? outlineRef" : "outlineRef"}}
      >
        {cloneElement(own, {
          ref: ${content ? "nodeRef" : "outlineRef"},
          style: { ...own.props.style, ...style },
${pushed}
        })}
      </Sequence>
    );
  },
);

const ${obj} = Interactive.withSchema({
  Component: ${obj}Inner,
  componentName: "<${obj}>",
  schema: ${obj}Schema,
  supportsEffects: false,
});

type ${stage}Props = InteractiveBaseProps & ${sceneProps};

/**
 * What a scene prop falls back to when Studio does not pass it, reset included.
 * The ${items.noun.toLowerCase()}s' own lists are here only for the scene's parameter defaults;
 * the stage always passes the ones its children build.
 */
const ${name}Defaults = ${lit(defaults)} satisfies Partial<${stage}Props>${
    fromKeys.length
      ? ` &
  Partial<Pick<ComponentProps<typeof ${scene}>, ${fromKeys.map(lit).join(" | ")}>>`
      : ""
  };

const ${stage}Schema = {
  ...Interactive.baseSchema,
${schema.join("\n")}
} as const satisfies InteractivitySchema;

/**
 * A value as the scene's list will read it back: each separator it would split
 * on becomes a character that looks the same and does not split, so "Hello,
 * world" stays one ${items.noun.toLowerCase()} and the ones after it keep their outlines.
 */
function ${name}Clean(v: string | undefined, seps: string): string {
  const look: Record<string, string> = { ",": "\\u201A", "|": "\\u2223", ";": "\\u037E", ">": "\\u203A" };
  let out = v ?? "";
  for (const c of seps.split(" ").join("")) out = out.split(c).join(look[c] ?? " ");
  return out;
}

/** The scene's props, from its ${items.noun.toLowerCase()}s' values in order. */
const ${name}FromItems = ${build.replace(/^\(o\)/, `(o: readonly ${obj}Values[])`).replace(/\bclean\(/g, `${name}Clean(`)};

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

/**
 * The scene, with its ${items.noun.toLowerCase()}s as children. It reads their values to lay
 * the scene out, and hands each one back the node the scene draws it as.
 */
const ${stage}Inner = forwardRef<
  HTMLDivElement,
  ${stage}Props & { readonly controls: SequenceControls | undefined }
>(
  (
    {
      controls,
      name,
      from,
      durationInFrames,
      trimBefore,
      freeze,
      hidden,
      showInTimeline,
      children,
      ...props
    },
    ref,
  ) => {
    const outlineRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => outlineRef.current as HTMLDivElement, []);${
      content
        ? `
    // One empty box per ${items.noun.toLowerCase()} on the stage: its outline, which it moves
    // to cover what it draws.
    const slots = useRef<{ current: HTMLDivElement | null }[]>([]);
    const slotFor = (i: number) => {
      slots.current[i] ??= { current: null };
      return slots.current[i];
    };`
        : ""
    }
    const objects = (Children.toArray(children).filter(isValidElement) as ReactElement<${obj}Values>[])${
      items.keep
        ? `.filter((o) => (${items.keep.replace(/^\(x\)/, `(x: ${obj}Values)`)})(o.props))`
        : ""
    };
    ${spread}
    // Values Studio is editing that the file does not have yet, by position.
    const [live, setLive] = useState<Record<number, ${obj}Values>>({});
    const keys = ${lit(fieldEntries.map(([k]) => k))} as const;
    const report = (index: number, values: ${obj}Values) => {
      const saved = objects[index]?.props;
      const edited = keys.some((k) => values[k] !== saved?.[k]);
      setLive((prev) => {
        const had = prev[index];
        if (!edited) {
          if (!had) return prev;
          const next = { ...prev };
          delete next[index];
          return next;
        }
        return had && keys.every((k) => had[k] === values[k]) ? prev : { ...prev, [index]: values };
      });
    };
    const built = ${name}FromItems(objects.map((o, i) => ({ ...o.props, ...live[i] })));
    const host: ItemHost = (index, node) => {
      const own = objects[index];
      return own
        ? cloneElement(own as ReactElement<{ node?: ReactElement; slot?: unknown; report?: unknown }>, {
            node,${content ? "\n            slot: slotFor(index)," : ""}
            report: (values: ${obj}Values) => report(index, values),
          })
        : node;
    };
    // The scene measures its copy once, on mount, so a saved edit remounts it.
    // An edit still being typed does not: its objects' Sequences would
    // remount with it, Studio would lose the selection, and the Inspector
    // field being typed in would lose its focus mid-word.
    const key = JSON.stringify({
      ...rest,
      ...${name}FromItems(objects.map((o) => o.props)),
    });
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
          style={{ position: "relative", width: ${w}, height: ${h},${studio.clip ? ' overflow: "hidden",' : ""} ${INHERITED} }}
        >${
          content
            ? `
          {/* First, so each box's ref is set before the objects that move it
              run their layout effects on a fresh mount. */}
          {objects.map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: one box per position
              key={i}
              ref={slotFor(i)}
              style={{ position: "absolute", display: "none", pointerEvents: "none", opacity: 0 }}
            />
          ))}`
            : ""
        }
          ${
            studio.stage
              ? `<div style={{ position: "absolute", left: ${-ax}, top: ${-ay}, width: ${sw}, height: ${sh} }}>
            <${name}Fade>
              <ItemHostProvider value={host}>
                <${scene} key={key} {...rest} {...built}${split} />
              </ItemHostProvider>
            </${name}Fade>
          </div>`
              : `<${name}Fade>
            <ItemHostProvider value={host}>
              <${scene} key={key} {...rest} {...built}${split} />
            </ItemHostProvider>
          </${name}Fade>`
          }
        </div>
      </Sequence>
    );
  },
);

const ${stage} = Interactive.withSchema({
  Component: ${stage}Inner,
  componentName: "<${stage}>",
  schema: ${stage}Schema,
  supportsEffects: false,
});

/**
 * ${title}: the scene, then each ${items.noun.toLowerCase()} as its own call site — select one on
 * the canvas or in the timeline and edit it here, or add, remove and reorder
 * them as JSX.
 */
export const ${name} = () => (
    <${stage}
${stageAttrs}
    >
${sites}
    </${stage}>
);
`;
}
