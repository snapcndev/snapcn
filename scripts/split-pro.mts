/**
 * Take the paid items back out of `public/`.
 *
 * `shadcn build` has one output directory and writes every item into it, which
 * for a registry with a paid half means the paid half ships to the CDN as
 * static files. This runs straight after the build and moves those files into
 * `registry/.private/`, where the `/r/[file]` route reads them behind a key.
 *
 * The index (`public/r/registry.json`) keeps its pro entries and gains
 * `meta.access = "pro"`. That is deliberate: the built index carries no
 * `files[].content`, so listing a pro component there leaks nothing and is the
 * only way anyone — the gallery, the MCP, an agent — can find out the component
 * exists in order to want it. A paywall nobody can see is a deleted feature.
 *
 * No pro registry yet? Then this is a no-op and the free build is untouched.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const PRO_SOURCE = path.join(root, "registry", "snap-cn-pro", "registry.json");
const PUBLIC_R = path.join(root, "public", "r");
const PRIVATE_DIR = path.join(root, "registry", ".private");

const readJson = async (p: string) => JSON.parse(await readFile(p, "utf8"));

const proNames: string[] = await readJson(PRO_SOURCE)
  .then(
    (r: { items?: { name: string }[] }) => r.items?.map((i) => i.name) ?? [],
  )
  .catch(() => []);

if (proNames.length === 0) {
  console.log("split-pro: no pro registry — nothing to move");
  process.exit(0);
}

await mkdir(PRIVATE_DIR, { recursive: true });

let moved = 0;
for (const name of proNames) {
  try {
    await rename(
      path.join(PUBLIC_R, `${name}.json`),
      path.join(PRIVATE_DIR, `${name}.json`),
    );
    moved++;
  } catch {
    // Already moved, or the build did not emit it. Either way there is nothing
    // public left to protect, which is the only thing this step guarantees.
  }
}

/**
 * Now put the pro items back into the *index* — metadata only.
 *
 * GATED, and off by default. The pro tier does not go public until 22 Oct 2026,
 * and an index row is not nothing: it publishes the component's name, title,
 * full description and dependency list as a static file on the CDN. That is the
 * catalogue, and the catalogue is the launch. Set SNAPCN_PRO_PUBLIC=1 to list
 * them; until then the moves above still happen, so the files are protected
 * either way and only the advertising waits.
 *
 * `shadcn build` emits an index entry with no `files[].content`, so listing a
 * paid component there gives away its name, description, props and dependency
 * list and none of its source. That is exactly the trade wanted: the gallery
 * can draw a locked card and the MCP can answer "orbit-gallery-pro exists, and
 * it needs a key" instead of "no such component". A paywall nobody can see is
 * a deleted feature.
 *
 * The entries are merged in rather than assumed present, because the pro
 * registry is built in its own repo — the free `shadcn build` here has never
 * heard of these names.
 */
if (process.env.SNAPCN_PRO_PUBLIC !== "1") {
  // "Not listed" has to be done, not just said. `shadcn build` indexed every
  // pro item as if it were free (see below), and exiting here left them there:
  // an unflagged build listed 48 pro names, 39 with no `meta.access`, so the
  // gallery, the MCP snapshot and every agent read them as free components
  // whose install answers 402.
  const indexPath = path.join(PUBLIC_R, "registry.json");
  const index = await readJson(indexPath);
  index.items = (index.items ?? []).filter(
    (i: { name: string }) => !proNames.includes(i.name),
  );
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  console.log(
    `split-pro: ${moved}/${proNames.length} pro items moved out of public/r, ` +
      `not listed (SNAPCN_PRO_PUBLIC unset)`,
  );
  process.exit(0);
}

const indexPath = path.join(PUBLIC_R, "registry.json");
const index = await readJson(indexPath);

/**
 * Only what has shipped. `lib/pro-catalogue.json` is the released catalogue —
 * every entry has a demo and a page — while the pro source also holds work in
 * progress. An unreleased name in the index is an advert for a 402 whose link
 * lands on nothing, and agents install whatever the index lists.
 */
const released = new Set(
  (
    (await readJson(path.join(root, "lib", "pro-catalogue.json")).catch(
      () => [],
    )) as { name: string }[]
  ).map((i) => i.name),
);
const proItems: Record<string, unknown>[] = (
  (await readJson(PRO_SOURCE)).items as { name: string }[]
).filter((i) => released.size === 0 || released.has(i.name));

/**
 * What an agent searches for, in front of what the component is.
 *
 * The shadcn MCP and `shadcn search` fuzzy-match a query against name, title
 * and description — nothing else. A pro description is a paragraph of
 * choreography ("A currency figure climbing on a bloom…") that never says
 * "counter", so "remotion counter animation" found nothing even though three
 * of these are exactly that. Prepended here, on the index entry only: the
 * catalogue prose on the site is left as written. Words taken from how
 * developers phrase these effects (keyword research, 2026-09-15) and from the
 * names agents guessed at in `registry_component_missing`.
 */
const SEARCH_LEADS: Record<string, string> = {
  "agent-chat":
    "AI agent chat animation: prompt typing, send and a streaming reply.",
  "agent-open":
    "AI prompt intro animation: kinetic text that becomes a typed prompt.",
  "agent-run":
    "AI agent run animation: a prompt sent and answered with visible tool steps.",
  "agent-tools": "AI agent tools animation for agent and MCP product demos.",
  "task-stream":
    "AI agent task list animation: steps stream in with spinners and tick off.",
  "glass-prompt":
    "AI prompt animation: a glass prompt bar, a send click and a dive into a ring of results.",
  "app-reveal":
    "App reveal animation: a wordmark folds into an app UI with a 3D camera move.",
  "brief-send": "Product demo scene: a project brief typed and sent.",
  "build-out":
    "App reveal from a button: zoom out of a send button into the app.",
  "chat-thread":
    "iMessage-style chat animation: message bubbles sending one by one.",
  "checkout-push":
    "Payment animation: a phone checkout with the amount landing and a camera push.",
  "comment-storm":
    "Comments animation: a flood of social comments and replies for launch hype.",
  "cross-out":
    "Strikethrough text animation: marker cross-out, then the replacement word.",
  "files-drop":
    "File drop animation: files dragged into an AI prompt and landing as attachments.",
  "focus-pull":
    "Blur-in text animation: phrases resolving from blur out of a gradient field.",
  "gallery-push":
    "Screenshot wall animation: a gallery of app screenshots opening column by column.",
  "hex-tally":
    "Chart animation: a hex unit chart filling in under a counting metric card, for stats and dashboards.",
  "laptop-open":
    "Laptop mockup animation: a MacBook opening with depth of field and a zoom into the screen.",
  "lcd-type":
    "Pixel screen typography: LCD-style typewriter text on a display.",
  "library-flight":
    "Product library fly-through: a wall of component screens and a closing subscription line.",
  "lockup-reveal": "Logo lockup reveal animation on a construction grid.",
  manifesto:
    "Kinetic typography statements: three text reveals with hard cuts, for manifesto and promo videos.",
  "metric-morph":
    "Bar chart animation: a button morphs into a stat and a histogram chart fills in.",
  "orbit-flow":
    "Orbit diagram animation: labelled steps riding orbits around a headline, for workflow explainers.",
  "pack-up":
    "Typewriter text animation into a 3D box: a headline types, then its words are packed into a cardboard carton.",
  "phone-pitch":
    "iPhone mockup scene: a headline and a phone placed into frame, the app pitch shot.",
  "phrase-swarm":
    "Text morph animation: one phrase breaks into letters that swarm into another.",
  "picker-commit":
    "iOS picker wheel animation that spins, settles and commits to a button.",
  "prompt-dive":
    "AI prompt animation: typing into an assistant and diving into the send button.",
  "proof-line":
    "Portfolio proof scene: shipped work cards collapsing into one sentence.",
  "read-through":
    "Word-by-word reading text animation: a huge sentence panned one word at a time.",
  "render-wall":
    "Code to showcase animation: loose code resolving into a wall of finished work.",
  "say-it":
    "Text to button animation: a word scrambles into a UI control that gets pressed.",
  "scatter-bloom":
    "Scatter plot chart animation: data points blooming onto a 3D plane, for data visualization.",
  "screen-wall":
    "Phone mockups tunnel: four phones around a headline with a camera pull-back.",
  "sentence-set":
    "Word-by-word text reveal: a sentence setting itself as each word darkens into place.",
  "showcase-drift":
    "Showcase wall animation: a scatter of work sliding in behind a headline.",
  "stretch-word":
    "Stretchy text animation: a repeating letter that stretches a word.",
  "string-hero":
    "Code typing animation: a line of code types and its string becomes the headline.",
  "tally-rise":
    "Counter animation: a currency count-up number, revenue and payout odometer.",
  "tap-through":
    "Phone feed tap animation: scroll a social feed and tap a button.",
  "thank-you-swarm":
    "Supporters animation: a notification wall of avatars, for thank-you and social proof.",
  "ticker-climb":
    "Line chart animation: a climbing trend line and a live number ticker counting up.",
  "vault-count":
    "Balance counter animation: a phone wallet balance counting up with payment cards.",
  "version-drop":
    "Version launch title: a product name typing and a big version number reveal.",
  "wall-cut":
    "LED wall text animation: a sentence read out on a pixel display.",
  "wire-feed":
    "News feed animation: a live changelog feed typing its newest item as the camera pulls back.",
  "word-montage":
    "Photo montage with rotating words: images gathering round a changing line.",
  "word-rush":
    "3D words fly-through: a camera flying through a field of words.",
  "word-settle":
    "Word-by-word text animation: words arrive in the accent colour and cool as they land.",
};

// `shadcn build` put every pro item in the index as if it were free, released
// or not. The unreleased ones come out entirely: left in, they read as free
// components whose install 404s.
if (released.size > 0) {
  index.items = (index.items ?? []).filter(
    (i: { name: string }) => !proNames.includes(i.name) || released.has(i.name),
  );
}

const byName = new Map<string, Record<string, unknown>>(
  (index.items ?? []).map((i: { name: string }) => [i.name, i]),
);

for (const item of proItems) {
  const lead = SEARCH_LEADS[(item as { name: string }).name];
  const description = (item as { description?: string }).description ?? "";
  if (lead && !description.startsWith(lead)) {
    (item as { description?: string }).description = `${lead} ${description}`;
  }
  const { files, ...meta } = item as { files?: unknown; name: string };
  // `files` carries the source paths; keep the entry shaped like every other
  // index row (path/type/target, no content) so nothing downstream special-cases
  // a pro item — the only difference between the two tiers is `meta.access`.
  const stripped = {
    ...meta,
    files: Array.isArray(files)
      ? files.map((f: Record<string, unknown>) => {
          const { content: _drop, ...rest } = f;
          return rest;
        })
      : undefined,
    meta: { access: "pro" },
  };
  const existing = byName.get(meta.name);
  if (existing) Object.assign(existing, stripped);
  else index.items.push(stripped);
}
await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);

console.log(
  `split-pro: ${moved}/${proNames.length} pro items moved out of public/r, ${proItems.length} listed in the index as locked`,
);
