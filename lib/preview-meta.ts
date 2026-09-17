import { CONFIGS } from "@/registry/__configs__";

/**
 * A preview's shape and length, without its code.
 *
 * Deliberately not `resolvePreview` — that returns the *component*, so importing
 * it pulls `registry/__index__` and with it all 41 component sources and
 * `@remotion/player`. Measured on the built gallery: 599KB of the page's 2,691KB
 * of JavaScript was Remotion, on a page that mounts exactly zero Players,
 * because every component in the grid ships a rendered mp4 and the live-Player
 * branch is dead code there.
 *
 * `registry/__configs__` is the same information minus the components: plain
 * objects importing nothing but types. A card needs an aspect ratio and the
 * overlay needs a duration; neither needs the scene.
 */
export interface PreviewMeta {
  width: number;
  height: number;
  durationInFrames: number;
  fps: number;
}

export function previewMeta(slug: string): PreviewMeta | null {
  const config = CONFIGS[slug];
  if (!config) return null;
  return {
    width: config.compositionWidth,
    height: config.compositionHeight,
    durationInFrames: config.durationInFrames,
    fps: config.fps,
  };
}
