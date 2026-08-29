import { loadFont as loadGeist } from "@remotion/google-fonts/Geist";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { AbsoluteFill, Composition, registerRoot } from "remotion";
import { getDefaults } from "@/lib/customizer-config";
import registry from "@/registry/__index__";
// Resolved to `no-pro.ts` when the pro tier is not checked out — see the note in
// the pro barrel for why it is not merged into the shipped registry map.
import proRegistry from "@/registry/snap-cn-pro/__index__";

/**
 * Bundle root for `scripts/dev/render-one.mts`: every registry component, at its
 * config defaults, as its own composition.
 *
 * `demos-root` registers the site's example scenes and `previews-root` only the
 * slugs in `RENDERED_DEMOS`. Neither can see a component that is still being
 * built, which is exactly when you most want to render it and measure the frames.
 * This root is for that and is not used by the site or by any shipped script.
 */
const { fontFamily: INTER } = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
const { fontFamily: GEIST } = loadGeist("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

// A Remotion bundle has none of the app's CSS, so the `--font-*` variables the
// registry components reference resolve to nothing here unless they are defined.
const FONT_VARS = {
  ["--font-sans" as string]: GEIST,
  ["--font-geist-sans" as string]: GEIST,
  fontFamily: INTER,
} as const;

const allComponents = { ...registry, ...proRegistry };

// The Stage takes its props instead of closing over the defaults, and the
// defaults are declared on the `<Composition>` — so `inputProps` can reach a
// component. Without that, `renderFrames({ inputProps })` is silently ignored
// and every stress render comes back as the default copy: clean and wrong.
function stageFor(slug: string) {
  const { Component } = allComponents[slug];
  return function Stage(props: Record<string, unknown>) {
    return (
      <AbsoluteFill style={FONT_VARS}>
        <Component {...props} />
      </AbsoluteFill>
    );
  };
}

export function DevRoot() {
  return (
    <>
      {Object.entries(allComponents).map(([slug, entry]) => (
        <Composition
          key={slug}
          id={slug}
          component={stageFor(slug)}
          defaultProps={getDefaults(entry.config.controls)}
          durationInFrames={entry.config.durationInFrames}
          fps={entry.config.fps}
          width={entry.config.compositionWidth}
          height={entry.config.compositionHeight}
        />
      ))}
    </>
  );
}

registerRoot(DevRoot);
