import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
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
  slotKeys,
  studioItemsWrapper,
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
    // The karaoke look, pinned: the component's default is the plain boxed
    // caption, which paints none of accent, emphasis or font.
    props: { fontSize: 45, preset: "karaoke" },
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
    // A phone's screen is a recording more often than a still; the scene
    // plays either, and the picker is Studio's only way to replace it.
    assets: { screenSrc: "video" },
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
    items: {
      noun: "Card",
      nameFrom: "text",
      // The scene drops a blank one; so does the stage, so the rest keep their outlines.
      keep: `(x) => Boolean(x.text?.trim())`,
      // Lines slide in one at a time, each on its own transform.
      outline: "content",
      fields: {
        text: {
          label: "Text (/ breaks a line)",
          type: "text",
          from: "script",
          sep: "|",
        },
      },
      // The last card holds through the Element's fade-out, whichever it is.
      build: `(o) => ({
        script: o.map((x) => clean(x.text, "|")).join("|"),
        holds: o.map((_, i) => (i === o.length - 1 ? ${48 + TAIL} : 48)).join(","),
      })`,
    },
  },
  "screen-recording": {
    box: [1280, 720],
    controls: [
      "src",
      "fit",
      "radius",
      "cutTop",
      "cutRight",
      "cutBottom",
      "cutLeft",
      "audio",
      "speed",
    ],
    // The recording's crop, renamed: Studio owns `crop*` on every layer and
    // would take these into its own Crop section, in its own units.
    alias: {
      cutTop: "cropTop",
      cutRight: "cropRight",
      cutBottom: "cropBottom",
      cutLeft: "cropLeft",
    },
    props: { backdropColor: "transparent" },
    // The Sequence's trim, not the recording's.
    drop: ["trimBefore"],
  },
  "text-build": {
    // Cropped to the ink it draws over its whole run, measured, 16px clear.
    box: [1100, 101],
    stage: [1100, 160],
    at: [0, 37],
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
    // Cropped to the ink it draws over its whole run, measured, 16px clear.
    box: [1000, 113],
    at: [140, 297],
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
    // Cropped to the ink it draws over its whole run, measured, 16px clear.
    box: [1280, 109],
    at: [0, 302],
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
    // The default "boxed" look paints neither the accent nor the font; the
    // YouTube look is the plainest one that does.
    props: { fontSize: 45, preset: "youtube" },
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
    // The scene lays out in 700 × 532; the reel's rows travel 63px above and
    // 53px below it on the way round (measured), so the box is taller than
    // the stage and the outline holds the whole turn.
    box: [700, 720],
    stage: [700, 532],
    at: [0, -94],
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
    items: {
      noun: "Step",
      nameFrom: "done",
      fields: {
        running: { label: "While running", type: "text", from: "steps" },
        done: { label: "When done (the last step never is)", type: "text" },
        icon: {
          label: "Icon when done",
          type: "enum",
          options: ["check", "globe"],
        },
      },
      build: `(o) => ({ steps: o.map((x) => clean(x.running, ";>") + " > " + clean(x.done, ";>") + (x.icon === "globe" ? " @globe" : "")).join("; ") })`,
      starter: (d) =>
        String(d.steps ?? "")
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((e) => {
            const icon = /@globe$/.test(e) ? "globe" : "check";
            const body = e.replace(/@globe$/, "").trim();
            const cut = body.indexOf(">");
            return {
              running: (cut < 0 ? body : body.slice(0, cut)).trim(),
              done: (cut < 0 ? body : body.slice(cut + 1)).trim(),
              icon,
            };
          }),
    },
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
    items: {
      noun: "Card",
      nameFrom: "title",
      // Three cards in frame, and a flick carries the rail about one card on:
      // three flicks show six. More cards get more flicks, closer together, so
      // every card still comes past inside the Element's length.
      build: `(o) => {
        const join = (k: "title" | "note" | "tag" | "image") => o.map((x) => clean(x[k], "|")).join("|");
        const flicks = Math.max(3, o.length - 3);
        return { titles: join("title"), notes: join("note"), tags: join("tag"), images: join("image"), flicks, every: Math.min(30, Math.floor(90 / flicks)) };
      }`,
      starter: (d) => {
        const list = (k: string) => String(d[k] ?? "").split("|");
        const [titles, notes, tags, images] = [
          "titles",
          "notes",
          "tags",
          "images",
        ].map(list);
        return Array.from({ length: 6 }, (_, i) => ({
          title: titles[i] ?? "",
          note: notes[i] ?? "",
          tag: tags[i] ?? "",
          image: images[i] ?? "",
        }));
      },
      fields: {
        title: {
          label: "Title",
          type: "text",
          from: "titles",
          sep: "|",
          node: "title",
        },
        note: {
          label: "Small print",
          type: "text",
          from: "notes",
          sep: "|",
          node: "note",
        },
        tag: {
          label: "Tag",
          type: "text",
          from: "tags",
          sep: "|",
          node: "tag",
        },
        image: {
          label: "Image",
          type: "image",
          from: "images",
          sep: "|",
          node: "src",
        },
      },
    },
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
    items: {
      noun: "Message",
      nameFrom: "text",
      // The scene drops a blank one; so does the stage, so the rest keep their outlines.
      keep: `(x) => Boolean(x.text?.trim())`,
      // A line box is set solid, so descenders hang below it.
      outline: "content",
      fields: {
        text: {
          label: "Message",
          type: "text",
          from: "script",
          node: "children",
        },
        author: { label: "Author", type: "text", from: "people" },
        time: { label: "Time", type: "text" },
        avatar: { label: "Avatar", type: "image", from: "avatars" },
      },
      // Consecutive messages from one author are one group: `;` between groups,
      // `|` between a group's lines; `people` and `avatars` carry one per group.
      build: `(o) => {
        const groups: { author: string; time: string; avatar: string; lines: string[] }[] = [];
        for (const x of o) {
          const last = groups[groups.length - 1];
          // A message joins the group above only if it has the same header, so a
          // time or avatar set on any message is one that shows.
          if (last && last.author === (x.author ?? "") && last.time === (x.time ?? "") && last.avatar === (x.avatar ?? "")) last.lines.push(clean(x.text, "|;"));
          else groups.push({ author: x.author ?? "", time: x.time ?? "", avatar: x.avatar ?? "", lines: [clean(x.text, "|;")] });
        }
        return {
          script: groups.map((g) => g.lines.join("|")).join(";"),
          // A name runs to the first space; a two-word name keeps its space as a
          // no-break one.
          people: groups.map((g) => \`\${clean(g.author, ";").split(" ").join("\\u00A0")} \${clean(g.time, ";")}\`.trim()).join(";"),
          avatars: groups.map((g) => g.avatar).join("|"),
          // One landing and one opening frame per message: the four measured
          // ones, then a message every 24 frames, typing for 12 before it.
          beats: o.map((_, i) => [0, 12, 60, 84][i] ?? 84 + 24 * (i - 3)).join(","),
          opens: o.map((_, i) => [0, 12, 37, 72][i] ?? 72 + 24 * (i - 3)).join(","),
        };
      }`,
      starter: (d) => {
        const heads = String(d.people ?? "")
          .split(";")
          .map((p) => p.trim());
        const pics = String(d.avatars ?? "")
          .split("|")
          .map((a) => a.trim());
        return String(d.script ?? "")
          .split(";")
          .flatMap((g, i) => {
            const head = heads[i] ?? "";
            const cut = head.indexOf(" ");
            const author = cut < 0 ? head : head.slice(0, cut);
            const time = cut < 0 ? "" : head.slice(cut + 1);
            return g
              .split("|")
              .map((m) => m.trim())
              .filter(Boolean)
              .map((text) => ({ text, author, time, avatar: pics[i] ?? "" }));
          });
      },
    },
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
    items: {
      noun: "Card",
      fields: {
        image: { label: "Image", type: "image", from: "cards" },
      },
    },
    props: { background: "transparent", cards: PHOTOS },
  },
  "follower-rush": {
    // Cropped to the ink it draws over its whole run, measured, 16px clear.
    box: [1280, 305],
    stage: [1280, 720],
    at: [0, 209],
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
    controls: ["heading", "fontFamily"],
    items: {
      noun: "Card",
      fields: { image: { label: "Image", type: "image" } },
      // The left card zooms in from full frame, inside its box.
      outline: "content",
      // Two cards, left and right: one card fills both, a third has nowhere to go.
      build: `(o) => ({ image1: o[0]?.image || undefined, image2: o[1 % Math.max(o.length, 1)]?.image || undefined })`,
      starter: (d) => [
        { image: String(d.image1) },
        { image: String(d.image2) },
      ],
    },
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
      images: PHOTOS,
    },
    items: {
      noun: "Image",
      // The ring's cards cycle the images: a blank one would be a card with no picture.
      keep: `(x) => Boolean(x.image?.trim())`,
      fields: { image: { label: "Image", type: "image", from: "images" } },
      // Ten cards is the ring's density; past ten, a card per image so every image rides it.
      build: `(o) => ({ images: o.map((x) => x.image ?? ""), count: Math.max(10, o.length) })`,
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
    items: {
      noun: "Shot",
      // The scene drops a blank one; so does the stage, so the rest keep their outlines.
      keep: `(x) => Boolean(x.image?.trim())`,
      fields: {
        image: {
          label: "Image",
          type: "image",
          from: "images",
          sep: "|",
          node: "src",
        },
      },
      // A shot past the sixth has no hold of its own and would never show.
      build: `(o) => ({ images: o.map((x) => x.image ?? "").join("|"), holds: o.map((_, i) => [1, 5, 5, 4, 2, 5][i] ?? 5).join(",") })`,
    },
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
    items: {
      noun: "Tile",
      nameFrom: "label",
      fields: {
        glyph: { label: "Glyph", type: "text" },
        label: { label: "Label", type: "text" },
      },
      // Each tile keeps its place and paint from the scene's own stack.
      build: `(o) => ({ tiles: o.map((x, i) => ({ ...SNAPCN_STACK[i % SNAPCN_STACK.length], glyph: x.glyph ?? "", label: x.label || undefined })) })`,
      starter: (d) =>
        (d.tiles as { glyph: string; label?: string }[]).map((t) => ({
          glyph: t.glyph,
          label: t.label ?? "",
        })),
    },
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
      images: PHOTOS,
    },
    // The pictures flash two frames each: not objects to select, so numbered
    // picture fields rather than one per call site.
    slots: { prop: "images", key: "image", count: 8, label: "Image" },
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
      images: PHOTOS,
    },
    // Eight slots swap through the photos, one object each; the hero stays
    // its own control.
    items: {
      noun: "Photo",
      fields: { image: { label: "Photo", type: "image", from: "images" } },
      keep: `(x) => Boolean(x.image?.trim())`,
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
      // Its own default is a set of picsum.photos URLs: another site's, and
      // random. The neutral photos every other Element starts with.
      images: PHOTOS,
    },
    // The spiral repeats its photos to fill its slots; each photo outlines its
    // largest copy in frame.
    items: {
      noun: "Photo",
      fields: { image: { label: "Photo", type: "image", from: "images" } },
      keep: `(x) => Boolean(x.image?.trim())`,
    },
  },
  "roster-grant": {
    box: [1280, 720],
    clip: true,
    controls: ["label", "accentColor", "fontFamily", "speed"],
    drop: ["theme"],
    items: {
      noun: "Entry",
      nameFrom: "title",
      fields: {
        // `from` only marks `rows` as an item prop; `build` regroups it.
        title: { label: "Name", type: "text", from: "rows" },
        role: { label: "Role", type: "text", from: "rows" },
      },
      // The scene draws three rows: the flat list, cut into three in order.
      build: `(o) => {
        const e = o.map((x) => ({ name: x.title ?? "", role: x.role ?? "" }));
        const n = Math.ceil(e.length / 3);
        return { rows: [e.slice(0, n), e.slice(n, 2 * n), e.slice(2 * n)] };
      }`,
      // Each row pans three entries across the frame; a fourth never arrives.
      starter: (defaults) =>
        ((defaults.rows ?? []) as { name: string; role: string }[][])
          .flatMap((row) => row.slice(0, 3))
          .map((e) => ({ title: e.name, role: e.role })),
    },
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
    items: {
      noun: "Chip",
      nameFrom: "label",
      // The scene drops a blank one; so does the stage, so the rest keep their outlines.
      keep: `(x) => Boolean(x.label?.trim())`,
      fields: {
        label: { label: "Label", type: "text", from: "chips", sep: ", " },
      },
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
    items: {
      noun: "Line",
      nameFrom: "text",
      // A row is the column's width; the outline is the text typed so far.
      outline: "content",
      fields: {
        text: { label: "Text", type: "text", from: "lines" },
        type: {
          label: "Kind",
          type: "enum",
          options: ["command", "log", "success", "error"],
        },
      },
      // A line's lead-in is its kind's: a command follows its prompt at once,
      // output takes a beat, a plain log line a longer one. The first line
      // starts as the camera lands.
      build: `(o) => ({
        lines: o.map((x, i) => {
          const type = (x.type ?? "command") as "command" | "log" | "success" | "error";
          return { text: x.text ?? "", type, delay: i === 0 ? 0 : { command: 4, success: 6, error: 6, log: 10 }[type] };
        }),
      })`,
      starter: [
        { text: "{labels: ['bug']})", type: "log" },
        { text: "→   label added", type: "success" },
        { text: "$", type: "log" },
        { text: "One task", type: "command" },
      ],
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
    items: {
      noun: "Card",
      nameFrom: "title",
      fields: {
        // `from` only marks `cards` as an item prop; `build` assembles the objects.
        title: { label: "Title", type: "text", from: "cards" },
        body: { label: "Body", type: "text", from: "cards" },
        // "auto" keeps the scene's own icon for the card's position.
        icon: {
          label: "Icon",
          type: "enum",
          options: ["auto", "pencil", "link", "shield", "globe"],
          from: "cards",
        },
      },
      build: `(o) => {
        const ICONS: Record<string, string> = {
          pencil: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z",
          link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19",
          shield: "M12 2 4 6v6c0 5 3.4 8.9 8 10 4.6-1.1 8-5 8-10V6l-8-4Z",
          globe: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z",
        };
        return {
          cards: o.map((x) => ({
            title: x.title ?? "",
            body: x.body ?? "",
            ...(x.icon && ICONS[x.icon] ? { icon: ICONS[x.icon] } : {}),
          })),
        };
      }`,
      // `cards` has no control, so the scene's own four are written out.
      starter: [
        {
          title: "Content",
          body: "Build pages around the exact questions buyers ask, so there is something accurate to cite.",
          icon: "auto",
        },
        {
          title: "Citations",
          body: "Run outreach to the sources that already get quoted for those questions.",
          icon: "auto",
        },
        {
          title: "Authority",
          body: "Earn links from the publishers the models already trust.",
          icon: "auto",
        },
        {
          title: "Coverage",
          body: "Place press so the name turns up wherever people go looking.",
          icon: "auto",
        },
      ],
    },
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
    items: {
      noun: "Chip",
      nameFrom: "label",
      // The scene drops a blank one; so does the stage, so the rest keep their outlines.
      keep: `(x) => Boolean(x.label?.trim())`,
      fields: {
        label: {
          label: "Label",
          type: "text",
          from: "chips",
          sep: ", ",
          node: "children",
        },
      },
    },
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

/**
 * Pro components that ship as Elements. Their payloads are the component's
 * whole source, so they are built into `registry/.private/elements/` — beside
 * the paid registry items, never under `public/` — and handed out by
 * `app/elements/[file]/route.ts` only to an account whose plan carries the
 * components. The committed list, `lib/studio-elements-pro.json`, is names
 * only: it tells a page to offer the button, and costs nothing to publish.
 *
 * Built straight from `registry/snap-cn-pro/<name>/index.tsx` and its
 * `config.ts`, which is why a config listed here must stand on its own in
 * plain Node (no import of the component). A checkout without the pro tier
 * skips this whole section and leaves the committed list alone.
 */
const PRO_ELEMENTS: Record<string, Studio> = {
  "glass-prompt": {
    // A whole scene: it paints the frame, so it is laid out at 1280x720 and
    // clipped to it.
    box: [1280, 720],
    clip: true,
    controls: [
      "prompt",
      "backdrop",
      "fontFamily",
      "textScale",
      "ink",
      "showCaret",
      "frost",
      "rim",
      "lensZoom",
      "focus",
      "motionBlur",
      "showPointer",
      "pointer",
      "pointerFill",
      "ringScale",
      "ringBlur",
      "tileRadius",
      "print",
      "printDark",
      "printMid",
      "printLight",
      "background",
      "speed",
    ],
    // The ring's nine pictures, one object each, back of the pile first.
    items: {
      noun: "Picture",
      fields: { image: { label: "Image", type: "image" } },
      // Nine tiles: fewer pictures go round again, more are left out.
      build: `(o) => Object.fromEntries(Array.from({ length: 9 }, (_, i) => [\`image\${i + 1}\`, o[i % Math.max(o.length, 1)]?.image || undefined]))`,
      starter: (d) =>
        Array.from({ length: 9 }, (_, i) => ({
          image: String(d[`image${i + 1}`]),
        })),
    },
    // Starter content that is not ours: a neutral prompt and generic photos
    // instead of snapcn's own posters (the Element guidelines).
    props: {
      prompt: "Turn this week's photos into a launch reel",
      ...Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => [
          `image${i + 1}`,
          PHOTOS[i % PHOTOS.length],
        ]),
      ),
    },
  },
};
const PRO_DIR = path.join(root, "registry", "snap-cn-pro");
const PRO_OUT = path.join(
  process.env.PRO_PRIVATE_DIR
    ? path.resolve(process.env.PRO_PRIVATE_DIR)
    : path.join(root, "registry", ".private"),
  "elements",
);

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

/** One Element payload: the component inlined, wrapped for the Studio, formatted. */
async function buildPayload(
  name: string,
  studio: Studio,
  item: Item,
  config: (typeof configs)[string] | undefined,
) {
  if (!config) throw new Error(`${name} has no config`);
  // The component stays as it is, under another name; its name goes to the
  // schema-enabled wrapper, which is the one export Studio imports.
  const own = config.componentName;
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
      (studio.items ? studioItemsWrapper : studioWrapper)({
        name: own,
        scene,
        title: item.title ?? name,
        studio: studio as Studio & { items: NonNullable<Studio["items"]> },
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
    {
      // A stock Remotion template compiles with \`lib: ["es2015"]\`: without
      // these the DOM types the scene uses do not exist there.
      input: `/// <reference lib="dom" />\n/// <reference lib="dom.iterable" />\n${hideLayers(element.sourceCode)}`,
      encoding: "utf8",
    },
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
    ...(studio.items
      ? // Its objects are call sites in the file, one outline each; Studio
        // puts the Sequence around it.
        { installationMode: "wrapped" as const, initialProps: null }
      : {
          installationMode: "component-owned-sequence" as const,
          // The starter content Studio writes onto the component, where the
          // Inspector edits it: the controls it shows, at the Element's values.
          initialProps: Object.fromEntries(
            [...studio.controls, ...slotKeys(studio)].flatMap((key) =>
              key in defaults
                ? [[key, defaults[key] as string | number | boolean]]
                : [],
            ),
          ),
        }),
  });

  return payload;
}

const built: string[] = [];
for (const [name, studio] of Object.entries(ELEMENTS)) {
  const payload = await buildPayload(
    name,
    studio,
    await readItem(`${name}.json`),
    configs[name],
  );
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

// ── The paid half ──────────────────────────────────────────────────────────
if (existsSync(PRO_DIR)) {
  await mkdir(PRO_OUT, { recursive: true });
  const proBuilt: string[] = [];
  for (const [name, studio] of Object.entries(PRO_ELEMENTS)) {
    const dir = path.join(PRO_DIR, name);
    const content = await readFile(path.join(dir, "index.tsx"), "utf8");
    const mod = await import(pathToFileURL(path.join(dir, "config.ts")).href);
    const config = Object.values(mod).find(
      (v): v is (typeof configs)[string] =>
        typeof v === "object" &&
        v !== null &&
        "controls" in v &&
        "componentName" in v,
    );
    const source: Item = JSON.parse(
      await readFile(path.join(PRO_DIR, "registry.json"), "utf8"),
    ).items.find((i: Item) => i.name === name);
    const item: Item = {
      name,
      title: source?.title ?? name,
      type: "registry:component",
      files: [
        {
          path: `${name}/index.tsx`,
          content,
          type: "registry:component",
          target: `components/snap-cn/${name}.tsx`,
        } as RegistryFile,
      ],
    };
    const payload = await buildPayload(name, studio, item, config);
    await writeFile(
      path.join(PRO_OUT, `${name}.json`),
      `${JSON.stringify(payload, null, 2)}\n`,
    );
    proBuilt.push(name);
  }
  await writeFile(
    path.join(root, "lib", "studio-elements-pro.json"),
    `${JSON.stringify(proBuilt, null, 2)}\n`,
  );
  console.log(
    `elements: built ${proBuilt.length} pro, into ${path.relative(root, PRO_OUT)}`,
  );
} else {
  console.log("elements: no pro tier here — pro Elements left as they were");
}
