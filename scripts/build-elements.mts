import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createElementPayload,
  type ElementDependency,
} from "@remotion/studio-protocol";
import { loadConfigs } from "./lib/configs.mts";
import {
  elementSource,
  packageName,
  type RegistryFile,
} from "./lib/element-source.mts";
import {
  elementDefaults,
  hideLayers,
  type Studio,
  studioWrapper,
  TAIL,
} from "./lib/element-wrapper.mts";

/**
 * The components in `ELEMENTS`, as Remotion Studio Elements:
 * `public/elements/<name>.json`, which the "Add to Remotion Studio" button sends
 * to a running Studio over the Studio Protocol. Plus the list of names,
 * `lib/studio-elements.json`, so a page knows whether to offer the button
 * without fetching anything.
 *
 * Built from `public/r/` after `split-pro`, so an Element can only ever be
 * source that is already public — a Pro component has left that directory by
 * the time this runs.
 *
 * Run: part of `pnpm run registry:build`, or `node scripts/build-elements.mts`.
 */

const root = process.cwd();
const PUBLIC_R = path.join(root, "public", "r");
const OUT = path.join(root, "public", "elements");
const SITE = "https://snapcn.dev";
/** Every Remotion project already has these; Studio refuses them as dependencies. */
const PROVIDED = new Set(["react", "react-dom", "remotion"]);

type Item = {
  name: string;
  title?: string;
  type?: string;
  files?: RegistryFile[];
  devDependencies?: string[];
};

/**
 * The components that are Elements: text treatments, captions and frames that
 * sit on top of somebody else's footage. The full scenes — logo sequences,
 * galleries, multi-act titles — are not; they stay on `shadcn add` until they
 * are built from parts that are. Adding one here is the whole opt-in; see
 * `Studio` for what each field answers.
 */
const ELEMENTS: Record<string, Studio> = {
  "answer-highlight": {
    box: [720, 320],
    // Sized off the frame's height: laid out at its stage, cropped to the card.
    stage: [960, 540],
    controls: [
      "question",
      "answer",
      "statement",
      "word",
      "questionColor",
      "answerColor",
      "pillColor",
      "accentColor",
      "fontFamily",
      "speed",
    ],
    props: { paperColor: "transparent" },
  },
  "cursor-track": {
    box: [1280, 720],
    // The cursor enters from off-frame; here that edge is the box's.
    clip: true,
    // No `variant`: arrow and dot are two cursors, and an Inspector control
    // must not switch between visual styles (the Element guidelines).
    controls: ["size", "color", "outlineColor", "ringColor", "speed"],
  },
  "karaoke-captions": {
    box: [1280, 160],
    // The line sits a set distance off the bottom: cropped to it.
    stage: [1280, 320],
    controls: [
      "text",
      "emphasize",
      "accentColor",
      "fontSize",
      "emphasisScale",
      "fontFamily",
      "speed",
    ],
    // Sized off the short side by default, which is the strip's height here.
    props: { fontSize: 45 },
    // A light/dark select wired to `theme`, which takes token overrides.
    drop: ["theme"],
    // Fades its own line out, and spreads the line across its own length.
    exit: false,
    durationInFrames: 150,
  },
  "laptop-frame": {
    box: [900, 600],
    controls: [
      "screenSrc",
      "notchLabel",
      "showNotch",
      "bezelColor",
      "screenColor",
      "restTilt",
      "scale",
      "floatLoop",
      "speed",
    ],
    // The zoom-to-screen finale leaves any box; it is a scene's ending.
    props: { finale: "none", notchLabel: "Recording" },
  },
  "phone-frame": {
    box: [380, 760],
    controls: [
      "screenSrc",
      "bezelColor",
      "screenColor",
      "scale",
      "tiltAngle",
      "showDynamicIsland",
      "floatLoop",
      "speed",
    ],
    // `showcase` is a crane move across the frame; "" is the built-in screen.
    props: { variant: "tilt", screenSrc: "" },
  },
  "punch-lines": {
    box: [1120, 380],
    controls: [
      "script",
      "ink",
      "accentColor",
      "accentBeat",
      "fontSize",
      "fontWeight",
      "fontFamily",
      "speed",
    ],
    props: {
      ground: "transparent",
      script: "Your launch / deserves a video. | Make it. Ship it. | Today.",
      // The last card cuts out on the preview's final frame; held through the
      // tail, it is what the fade out carries away.
      holds: `48,48,${48 + TAIL}`,
    },
  },
  "screen-recording": {
    box: [1280, 720],
    controls: [
      "src",
      "fit",
      "radius",
      "cropTop",
      "cropRight",
      "cropBottom",
      "cropLeft",
      "audio",
      "speed",
    ],
    props: { backdropColor: "transparent" },
    // The Sequence's trim, not the recording's.
    drop: ["trimBefore"],
  },
  "text-build": {
    box: [1100, 160],
    controls: [
      "text",
      "fontSize",
      "color",
      "fontWeight",
      "fontFamily",
      "speed",
    ],
  },
  "text-highlight": {
    box: [860, 120],
    controls: [
      "before",
      "highlight",
      "after",
      "baseColor",
      "accentColor",
      "highlightedTextColor",
      "fontSize",
      "fontWeight",
      "fontFamily",
      "speed",
    ],
    // `logo-wipe` ends on a full-frame flood of colour.
    props: { preset: "marker" },
  },
  "text-reveal": {
    box: [820, 240],
    controls: [
      "text",
      "fontSize",
      "color",
      "fontWeight",
      "fontFamily",
      "speed",
    ],
  },
  "text-rewrite": {
    box: [1000, 160],
    // Scales a 16:9 stage to fit: laid out at it, cropped to the line.
    stage: [1280, 720],
    controls: [
      "headline",
      "keep",
      "append",
      "accentColor",
      "mode",
      "fontFamily",
      "speed",
    ],
    props: {
      headline: "Or just try Acme",
      append: "Billing",
      markPath: "",
      glow: false,
      theme: { background: "transparent" },
    },
  },
  "text-select": {
    box: [1280, 160],
    // Scales a 16:9 stage to fit: laid out at it, cropped to the line.
    stage: [1280, 720],
    controls: ["headline", "accentColor", "mode", "fontFamily", "speed"],
    props: { glow: false, theme: { background: "transparent" } },
  },
  "text-swap": {
    box: [900, 160],
    // The fly-through carries the old line past the camera, across the whole
    // frame; an Element keeps it inside its box.
    clip: true,
    controls: [
      "fromText",
      "toText",
      "fontSize",
      "color",
      "fontWeight",
      "fontFamily",
      "speed",
    ],
  },
  "text-swell": {
    box: [1280, 180],
    controls: [
      "text",
      "fontSize",
      "color",
      "fontWeight",
      "fontFamily",
      "speed",
    ],
  },
  "word-captions": {
    box: [1280, 160],
    // The line sits a set distance off the bottom: cropped to it.
    stage: [1280, 320],
    controls: [
      "words",
      "framesPerWord",
      "textColor",
      "accentColor",
      "fontSize",
      "maxWidth",
      "fontFamily",
      "speed",
    ],
    props: { fontSize: 45 },
    // Pages cut out on their last word, like speech does.
    exit: false,
    // The whole transcript: 16 words at 14 frames, and a beat.
    durationInFrames: 16 * 14 + 10,
  },
  "word-flip": {
    box: [1280, 160],
    controls: [
      "prefix",
      "words",
      "suffix",
      "caret",
      "fontSize",
      "color",
      "fontWeight",
      "fontFamily",
      "speed",
    ],
    props: { words: ["Modern", "Stunning", "Minimal"] },
    list: ["words"],
  },
  "word-gather": {
    box: [860, 380],
    // Scatters and sizes off its frame: laid out at it, cropped to the words.
    stage: [1065, 582],
    controls: ["text", "maxWidth", "accent", "mode", "fontFamily", "speed"],
    props: { theme: { background: "transparent" } },
  },
  "word-wheel": {
    box: [700, 532],
    controls: ["headline", "words", "spin", "mode", "fontFamily"],
    props: { headline: "Made for", theme: { background: "transparent" } },
    // The shared speed knob, which this component never read.
    drop: ["speed"],
    clip: true,
  },
};

const readItem = async (file: string): Promise<Item> =>
  JSON.parse(await readFile(path.join(PUBLIC_R, file), "utf8"));

/** The version this site was built and tested against — Studio wants it exact. */
const installedVersion = async (pkg: string) =>
  JSON.parse(
    await readFile(
      path.join(root, "node_modules", pkg, "package.json"),
      "utf8",
    ),
  ).version as string;

const libItem = await readItem("snap-cn-ui.json");
const lib = libItem.files ?? [];
const configs = await loadConfigs();

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const built: string[] = [];
for (const [name, studio] of Object.entries(ELEMENTS)) {
  const item = await readItem(`${name}.json`);
  const config = configs[name];
  const file = item.files?.[0];
  if (!config || !file || item.files?.length !== 1) {
    throw new Error(`${name} is not a one-file component with a config`);
  }

  // The component stays as it is, under another name; its name goes to the
  // schema-enabled wrapper, which is the one export Studio imports.
  const own = config.componentName;
  const scene = `${own}Scene`;
  const declaration = `export function ${own}(`;
  if (file.content.split(declaration).length !== 2) {
    throw new Error(`${name}: expected one \`${declaration}\``);
  }
  const defaults = elementDefaults(config.controls, studio, SITE);
  const element = elementSource(
    file.content.replace(declaration, `function ${scene}(`) +
      studioWrapper({
        name: own,
        scene,
        title: item.title ?? name,
        studio,
        controls: config.controls,
        defaults,
      }),
    own,
    lib,
  );
  if (!element) throw new Error(`${name} builds on another component`);
  // Studio shows this file and writes it into the project as-is: format it
  // the way the rest of the source is, generated wrapper included.
  const sourceCode = execFileSync(
    path.join(root, "node_modules", ".bin", "biome"),
    ["format", `--stdin-file-path=registry/snap-cn/${name}/element.tsx`],
    { input: hideLayers(element.sourceCode), encoding: "utf8" },
  );

  const imported = [...new Set(element.modules.map(packageName))].filter(
    (pkg) => !PROVIDED.has(pkg),
  );
  // The types a package does not ship (culori's), which the registry declares
  // as devDependencies for `shadcn add`. Studio has one dependency list, and
  // without them a template's strict `tsc` rejects the import.
  const types = [
    ...new Set([
      ...(item.devDependencies ?? []),
      ...(libItem.devDependencies ?? []),
    ]),
  ].filter((t) => imported.includes(t.replace(/^@types\//, "")));
  const packages = [...imported, ...types];
  const [width, height] = studio.box;
  const payload = createElementPayload({
    displayName: item.title ?? name,
    slug: name,
    sourceCode,
    dependencies: await Promise.all(
      packages.map(
        async (pkg): Promise<ElementDependency> =>
          pkg.startsWith("@remotion/")
            ? { name: pkg as `@remotion/${string}`, version: null }
            : { name: pkg, version: await installedVersion(pkg) },
      ),
    ),
    dimensions: { width, height },
    durationInFrames: studio.durationInFrames ?? config.durationInFrames + TAIL,
    installationMode: "component-owned-sequence",
    // The starter content Studio writes onto the component, where the
    // Inspector edits it: the controls it shows, at the Element's values.
    initialProps: Object.fromEntries(
      studio.controls.flatMap((key) =>
        key in defaults
          ? [[key, defaults[key] as string | number | boolean]]
          : [],
      ),
    ),
  });

  await writeFile(
    path.join(OUT, `${name}.json`),
    `${JSON.stringify(payload, null, 2)}\n`,
  );
  built.push(name);
}

await writeFile(
  path.join(root, "lib", "studio-elements.json"),
  `${JSON.stringify(built, null, 2)}\n`,
);
console.log(`elements: built ${built.length}`);
