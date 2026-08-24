"use client";

import { PreviewStage } from "@/lib/ui-preview-internals";
import { examples } from "./examples";

/**
 * The example's player and the example components themselves, in their own
 * chunk — `./examples` imports every one of them, and through `PreviewStage`
 * the whole Remotion runtime. `ComponentExample` is registered in
 * `mdx-components.tsx`, so a static import here landed all of it in *every*
 * docs page's bundle, including the ones with no example on them at all.
 */
export default function ComponentExampleStage({ name }: { name: string }) {
  const entry = examples[`${name}-example`];
  if (!entry) return null;

  return (
    <PreviewStage
      name={`${name}-example`}
      Component={entry.Component}
      inputProps={{}}
      durationInFrames={entry.durationInFrames}
      fps={entry.fps}
      compositionWidth={entry.width}
      compositionHeight={entry.height}
      previewBackdrop={entry.previewBackdrop}
    />
  );
}
