import proCatalogue from "@/lib/pro-catalogue.json";
import builtRegistry from "@/public/r/registry.json";
import snapCnRegistry from "@/registry/snap-cn/registry.json";
import snapCnUiRegistry from "@/registry/snap-cn-ui/registry.json";

/*
 * The catalogue: every component's name, and the Pro ones' titles and blurbs.
 *
 * Its own module, apart from `config/site`, because it is built out of the
 * registry JSON — ~230KB of it — and a bundler cannot shake a JSON import out
 * of a module that reads it at load time. While these lived in `config/site`,
 * every client component that imported a colour or a URL from there shipped the
 * whole registry to the browser, on every page. Import from here on the server;
 * a client component that needs a number from it should be handed that number.
 */

export const INSTALL_ALL_NAMES: string[] = [
  ...snapCnRegistry.items,
  ...snapCnUiRegistry.items,
].map((item) => item.name);

export interface ProItem {
  name: string;
  title: string;
  description: string;
  /** Day it joined the catalogue, when that was after the tier was first listed. */
  added?: string;
}

/**
 * The paid components.
 *
 * Read off two committed files, never off the pro manifest: `registry/snap-cn-pro/`
 * is gitignored, so a public checkout does not have it and an import of it would
 * not compile.
 *
 * `lib/pro-catalogue.json` is written by `scripts/pro-demos.mts` and lists every
 * paid component that has a demo video — that is the live list. `public/r/registry.json`
 * is the older source: correct, but only as current as the last build that ran
 * with `SNAPCN_PRO_PUBLIC=1`, which is how this came to advertise 14 of 35.
 *
 * Title and description come along because `/pro` has to describe what somebody
 * just failed to install. Carrying them is safe for the same reason listing the
 * row is: the built index has no `files[].content`, so this is the
 * advertisement and not the source.
 */
export const PRO_ITEMS: ProItem[] = (() => {
  const byName = new Map<string, ProItem>();
  // The catalogue first: it is written from the pro manifest itself and is the
  // only list that is current. The built index is a snapshot of whichever build
  // last ran with SNAPCN_PRO_PUBLIC=1, and it had drifted to 14 of 35 — so it
  // fills gaps here rather than deciding the set.
  for (const item of proCatalogue as ProItem[]) byName.set(item.name, item);
  for (const i of builtRegistry.items) {
    if ((i as { meta?: { access?: string } }).meta?.access !== "pro") continue;
    if (byName.has(i.name)) continue;
    byName.set(i.name, {
      name: i.name,
      title: (i as { title?: string }).title ?? i.name,
      description: (i as { description?: string }).description ?? "",
    });
  }
  return [...byName.values()];
})();

/** The same list, as bare names — what every gate and lookup actually wants. */
export const PRO_NAMES: string[] = PRO_ITEMS.map((i) => i.name);

/**
 * Every name that resolves to something, free or paid.
 *
 * Deliberately *not* `INSTALL_ALL_NAMES`. A pro component has to be a name the
 * site admits exists — the middleware's unknown-name 404 fires before the route
 * that would answer 402, so without this a paying customer's `shadcn add` is
 * told the component was never real. But it must stay out of the install-all
 * command, which would otherwise hand every free reader a line that fails
 * halfway through.
 */
export const ALL_COMPONENT_NAMES: string[] = [
  ...INSTALL_ALL_NAMES,
  ...PRO_NAMES,
];

export const INSTALL_ALL_COMMAND = `npx shadcn@latest add ${INSTALL_ALL_NAMES.map(
  (name) => `@snapcn/${name}`,
).join(" ")}`;
