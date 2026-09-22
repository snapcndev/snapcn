import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
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
  adoptDefaults,
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
/**
 * Neutral starter content. An Element is copied into somebody else's project,
 * so it may not arrive wearing snapcn: the guidelines ask for no project
 * branding or footage. A placeholder mark and generic photos, all on this site.
 */
const MARK = `${SITE}/logo/dummy-logo.png`;
const PHOTOS = [
  "438b9e6b50654a44d404fbf358c26e9f.webp",
  "5e5305b05bd405a0d89570725434099e.webp",
  "767d99bb371a54d0d36751e8cecae43c.jpg",
  "821d815affa6496c39cbdeeec7a84603.jpg",
  "937438c560ada1c83317f2c11b3454b0.jpg",
  "98f89cb9994f5c382ab964062c4039db.jpg",
  "b25b82db2892efff9be3204e860d30ee.jpg",
  "c9ebc6337aa2268ac4b357f9cb1ac547.jpg",
].map((f) => `${SITE}/showcase-assets/${f}`);
/**
 * follower-rush's own crowd, with its photos as URLs. The component points at
 * `/avatars/NN.jpg`, which exists on this site and 404s everywhere else — it
 * falls back to monograms, so it never breaks, it just loses every face.
 */
const FOLLOWERS =
  "Manon Melon Victor Shane Lisa Natasha Annie Abdull Kratos Jhone Matt Huggy Felomi Hazar Mikasa Silmon Luciano Nova Priya Theo Amelia Rafael Sofia Kai Jordan Nora Dana Milo Yuki Bruno Elena Omar Ivy Leo Zara Finn Maya Cole"
    .split(" ")
    .map((name, i) => ({
      name,
      avatar: `${SITE}/avatars/${String((i % 24) + 1).padStart(2, "0")}.jpg`,
    }));
/** logo-drift's measured field — positions, sizes, drifts, entries, paint — renamed. */
const DRIFT_TILES = [
  ["Ma", "Mail", "#1f2430", "#ffffff", 163, 232, -54, 12, 109, 0.28],
  ["Dc", "Docs", "#f2f4f7", "#16181d", 128, -209, 81, 32, 122, 0.48],
  ["Ch", "Chat", "#10131a", "#7dd3fc", -384, 344, -27, -68, 200, 0.95],
  ["Ca", "Calendar", "#e7e8ea", "#16181d", 519, 45, -31, 64, 144, 1.51],
  ["Pa", "Payments", "#f1ece2", "#8a5a2b", -692, -125, 41, -71, 214, 1.55],
  ["An", "Analytics", "#2b3a36", "#ffffff", -350, -339, 65, -26, 188, 1.75],
  ["St", "Storage", "#f4703a", "#ffffff", 672, -277, 2, 81, 256, 1.76],
  ["Se", "Search", "#2f6fdb", "#ffffff", -721, 211, 9, -84, 215, 2.06],
  ["Au", "Auth", "#0b0b0d", "#ffffff", 676, 348, -65, 52, 244, 2.48],
].map(([glyph, label, background, color, x, y, vx, vy, size, at]) => ({
  glyph,
  label,
  background,
  color,
  x,
  y,
  vx,
  vy,
  size,
  at,
}));
/** A page the scene would otherwise paint, left to the footage underneath. */
const CLEAR = { background: "transparent" };
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
  // ── Scenes: each laid out at its 1280x720 stage and clipped to it, so
  // nothing reaches past the box; the page left transparent.
  "agent-steps": {
    // The prompt and its steps: a column at the top of the stage.
    box: [640, 440],
    stage: [1280, 720],
    at: [296, 0],
    clip: true,
    controls: [
      "query",
      "steps",
      "result",
      "inkColor",
      "stepColor",
      "accentColor",
      "pillColor",
      "fontFamily",
      "speed",
    ],
    props: {
      paperColor: "transparent",
      glowColor: "transparent",
      query: "A 30-second launch video for an analytics dashboard",
    },
  },
  "announce-title": {
    box: [1280, 720],
    clip: true,
    controls: [
      "eyebrow",
      "title",
      "tagline",
      "inkColor",
      "titleColor",
      "taglineColor",
      "voidColor",
      "fieldColor",
      "paperColor",
      "nightColor",
      "fontFamily",
      "speed",
    ],
    props: {
      title: "Acme 2.0",
      tagline: "Everything your team ships, in one place.",
      // An empty path leaves the line bare; the default is snapcn's mark.
      symbolPath: "",
      // Its four colour cuts, left to the footage: the lines carry the
      // sequence on their own, in ink. Set a colour and that cut comes back.
      voidColor: "transparent",
      fieldColor: "transparent",
      paperColor: "transparent",
      nightColor: "transparent",
      glowStrength: 0,
      inkColor: "#141414",
      taglineColor: "#141414",
    },
  },
  "block-wordmark": {
    // The wordmark's row, full width so a longer name still fits.
    box: [1280, 240],
    stage: [1280, 720],
    at: [0, 240],
    clip: true,
    controls: ["text", "color", "colors", "fontSize", "fontFamily", "speed"],
    props: { text: "acme", background: "transparent" },
  },
  "card-rail": {
    box: [1280, 720],
    clip: true,
    controls: [
      "heading",
      "titles",
      "notes",
      "tags",
      "images",
      "mode",
      "fontFamily",
    ],
    // A start frame; the Sequence owns `from`.
    drop: ["speed", "from"],
    props: {
      heading: "Browse templates",
      images: [...PHOTOS, PHOTOS[0]].join("|"),
      titles:
        "Onboarding|Dashboard|Checkout|Settings|Reports|Inbox|Calendar|Billing|Profile",
      notes:
        "Template · 12 screens|Template · 8 screens|Template · 5 screens|Template · 9 screens|Template · 6 screens|Template · 4 screens|Template · 7 screens|Template · 3 screens|Template · 5 screens",
      tags: "@acme/onboarding|@acme/dashboard|@acme/checkout|@acme/settings|@acme/reports|@acme/inbox|@acme/calendar|@acme/billing|@acme/profile",
      theme: CLEAR,
    },
  },
  "channel-thread": {
    // The thread, which scrolls up out of the top of its stage.
    box: [1280, 560],
    stage: [1280, 720],
    at: [0, 0],
    clip: true,
    // The shared speed knob, which this component never read.
    drop: ["speed"],
    controls: ["script", "people", "mode", "fontFamily"],
    props: {
      mode: "light",
      script:
        "Launch video by Thursday?|We have nothing shot.;Already done.|Built it this morning.",
      theme: CLEAR,
    },
  },
  "count-grid": {
    box: [1280, 720],
    clip: true,
    controls: ["start", "to", "noun", "inkFrom", "inkTo", "speed"],
    // The number it counts from; the Sequence owns `from`.
    alias: { start: "from" },
    // Its own cards are this site's files through staticFile(): a 404 in
    // anyone else's project, and half of them are snapcn's posters.
    props: { background: "transparent", cards: PHOTOS },
  },
  "follower-rush": {
    box: [1280, 720],
    clip: true,
    controls: ["totalFollowers", "accentColor", "fontFamily", "speed"],
    // A light/dark select wired to `theme`, which takes token overrides.
    drop: ["theme"],
    props: { theme: CLEAR, followers: FOLLOWERS },
  },
  "hero-launch": {
    box: [1280, 720],
    clip: true,
    // The shared speed knob, which this component never read.
    drop: ["speed"],
    controls: ["image1", "image2", "heading", "fontFamily"],
    props: {
      // Lit for a dark page by default; on a transparent one, its ink is dark.
      mode: "light",
      image1: PHOTOS[3],
      image2: PHOTOS[7],
      heading: "Launching today",
      theme: CLEAR,
    },
  },
  "logo-assemble": {
    box: [1280, 720],
    clip: true,
    controls: ["brandName", "middleText", "logoSrc", "fontFamily", "speed"],
    props: {
      // Lit for a dark page by default; on a transparent one, its ink is dark.
      mode: "light",
      brandName: "Acme",
      middleText: "Everything your team ships",
      logoSrc: MARK,
      background: "transparent",
    },
  },
  "logo-collapse": {
    // The row the pictures collapse into the mark on.
    box: [1280, 360],
    stage: [1280, 720],
    at: [0, 180],
    clip: true,
    // The shared speed knob, which this component never read.
    drop: ["speed"],
    controls: ["images", "mark", "wordmark", "accent", "mode", "fontFamily"],
    props: {
      images: PHOTOS.slice(0, 6).join("|"),
      mark: MARK,
      wordmark: "acme",
      theme: CLEAR,
    },
  },
  "logo-drift": {
    box: [1280, 720],
    clip: true,
    controls: [
      "headline",
      "fontSize",
      "accentColor",
      "mode",
      "fontFamily",
      "speed",
    ],
    // Its tiles name Remotion, React, Vercel and six more: the same fitted
    // choreography, with generic app names.
    props: { theme: CLEAR, tiles: DRIFT_TILES },
  },
  "logo-flicker": {
    box: [1280, 720],
    clip: true,
    controls: ["brandName", "logoSrc", "fontFamily", "speed"],
    props: {
      // Lit for a dark page by default; on a transparent one, its ink is dark.
      mode: "light",
      brandName: "Acme",
      logoSrc: MARK,
      background: "transparent",
    },
  },
  "moodboard-reveal": {
    box: [1280, 720],
    clip: true,
    controls: [
      "leadIn",
      "emphasis",
      "tailIn",
      "heroImage",
      "darkColor",
      "lightColor",
      "fontFamily",
      "speed",
    ],
    props: {
      // Both pages left to the footage, so it crossfades nothing and draws in
      // ink; set either and that page comes back.
      darkColor: "transparent",
      lightColor: "transparent",
    },
  },
  "orbit-gallery": {
    box: [1280, 720],
    clip: true,
    controls: [
      "title",
      "subtitle",
      "buttonLabel",
      "textColor",
      "fontFamily",
      "speed",
    ],
    props: {
      // Lit for a dark page by default; on a transparent one, its ink is dark.
      mode: "light",
      background: "transparent",
      textColor: "#141414",
    },
  },
  "roster-grant": {
    box: [1280, 720],
    clip: true,
    controls: ["label", "accentColor", "fontFamily", "speed"],
    drop: ["theme"],
    props: {
      // Its own roster is snapcn's component list.
      rows: [
        [
          { name: "Analytics", role: "Module" },
          { name: "Billing", role: "Module" },
          { name: "Inbox", role: "Add-on" },
          { name: "Reports", role: "Module" },
        ],
        [
          { name: "Calendar", role: "Add-on" },
          { name: "Checkout", role: "Module" },
          { name: "Search", role: "Add-on" },
          { name: "Settings", role: "Module" },
        ],
        [
          { name: "Onboarding", role: "Flow" },
          { name: "Profile", role: "Module" },
          { name: "Exports", role: "Add-on" },
          { name: "Teams", role: "Module" },
        ],
      ],
      theme: CLEAR,
    },
  },
  "status-cycle": {
    box: [1280, 720],
    clip: true,
    controls: [
      "prefix",
      "statuses",
      "chips",
      "fieldColor",
      "pillColor",
      "pillLabelColor",
      "prefixColor",
      "fontFamily",
      "speed",
    ],
    props: {
      prefix: "Acme is",
      statuses: "designing, building, shipping, live",
      chips: "onboarding, dashboard, checkout, billing, reports",
      pageColor: "transparent",
      // The act-one field too: the prefix and the pill read on the footage.
      fieldColor: "transparent",
    },
  },
  "terminal-simulator": {
    box: [1280, 720],
    clip: true,
    controls: [
      "intro",
      "background",
      "borderColor",
      "fontSize",
      "fontFamily",
      "speed",
    ],
    props: {
      // Its light terminal: a transparent page puts the intro and the output
      // on the footage, and the dark palette's white ink would vanish on it.
      mode: "light",
      theme: CLEAR,
      background: "#ffffff",
      borderColor: "#e4e4e7",
    },
  },
  "wordmark-cut": {
    box: [1280, 720],
    clip: true,
    controls: ["word", "dotFrom", "dotTo", "fontFamily", "speed"],
    drop: ["theme"],
    props: { word: "acme.", theme: CLEAR },
  },
  "answer-stream": {
    box: [1280, 720],
    clip: true,
    controls: [
      "question",
      "answer",
      "headline",
      "model",
      "accentColor",
      "mode",
      "fontFamily",
      "speed",
    ],
    props: { theme: CLEAR },
  },
  "prompt-send": {
    box: [1280, 720],
    clip: true,
    controls: [
      "text",
      "placeholder",
      "chips",
      "accentColor",
      "mode",
      "fontFamily",
      "speed",
    ],
    props: { theme: CLEAR },
  },
  "prompt-zoom": {
    box: [1280, 720],
    clip: true,
    controls: [
      "greeting",
      "text",
      "placeholder",
      "model",
      "effort",
      "accentColor",
      "mode",
      "fontFamily",
      "speed",
    ],
    props: { theme: CLEAR },
  },
  "search-typing": {
    // The field's band; the dolly crops at the stage's sides by design.
    box: [1280, 240],
    stage: [1280, 720],
    at: [0, 245],
    clip: true,
    controls: ["text", "caret", "mode", "fontFamily", "speed"],
    props: { theme: CLEAR },
  },
  "type-morph": {
    // The line, full width so longer copy still fits.
    box: [1280, 220],
    stage: [1280, 720],
    at: [0, 230],
    clip: true,
    // `speed` and `accent`: two knobs this component never read.
    drop: ["speed", "accent"],
    controls: ["lead", "emphasis", "morphTo", "finally_", "ink", "fontFamily"],
    props: { background: "transparent" },
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
/** Every registry component, by the path another component imports it from. */
const registry: Record<string, RegistryFile> = {};
for (const f of await readdir(PUBLIC_R)) {
  const it = await readItem(f);
  const main =
    it.files?.find((x) => x.path.endsWith("/index.tsx")) ?? it.files?.[0];
  if (it.type === "registry:component" && main) {
    registry[`@/components/snap-cn/${it.name}`] = main;
  }
}
const lib = libItem.files ?? [];
const configs = await loadConfigs();

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const built: string[] = [];
for (const [name, studio] of Object.entries(ELEMENTS)) {
  const item = await readItem(`${name}.json`);
  const config = configs[name];
  // The component stays as it is, under another name; its name goes to the
  // schema-enabled wrapper, which is the one export Studio imports.
  const own = config?.componentName;
  const scene = `${own}Scene`;
  const declaration = `export function ${own}(`;
  const file = item.files?.find((f) => f.content.includes(declaration));
  if (!config || !file) {
    throw new Error(`${name} has no config, or no \`${declaration}\``);
  }
  // Its own other files, by the relative path it imports them with.
  const siblings = Object.fromEntries(
    (item.files ?? [])
      .filter((f) => f !== file)
      .map((f) => [`./${path.basename(f.path, path.extname(f.path))}`, f]),
  );
  if (file.content.split(declaration).length !== 2) {
    throw new Error(`${name}: expected one \`${declaration}\``);
  }
  const defaults = elementDefaults(config.controls, studio, SITE);
  const element = elementSource(
    adoptDefaults(
      file.content.replace(declaration, `function ${scene}(`),
      scene,
      own,
      studio,
      defaults,
    ) +
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
    { ...registry, ...siblings },
  );
  if (!element) throw new Error(`${name} imports what cannot be inlined`);
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
