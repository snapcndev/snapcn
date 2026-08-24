"use client";

import { PreviewStage } from "@/lib/ui-preview-internals";
import registry from "@/registry/__index__";

/**
 * The interactive half of a docs preview, in its own chunk.
 *
 * This is the only module on a component page that imports
 * `registry/__index__` — and therefore every scene and the whole of Remotion.
 * `ComponentPreview` loads it with `next/dynamic` when the reader actually asks
 * for the live player, so the page itself ships none of it.
 */
export default function ComponentPreviewStage({
  name,
  values,
}: {
  name: string;
  values: Record<string, unknown>;
}) {
  const entry = registry[name];
  if (!entry) return null;

  const { Component, config } = entry;
  return (
    <PreviewStage
      name={name}
      Component={Component}
      inputProps={values}
      durationInFrames={config.durationInFrames}
      fps={config.fps}
      compositionWidth={config.compositionWidth}
      compositionHeight={config.compositionHeight}
      previewBackdrop={config.previewBackdrop}
    />
  );
}
