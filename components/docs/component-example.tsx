"use client";

import dynamic from "next/dynamic";
import { examples } from "./examples";

/**
 * The frame is ours; the player inside it arrives on its own.
 *
 * `next/dynamic` keeps `PreviewStage` — and the whole Remotion runtime behind
 * it — out of the bundle of every docs page that does not render an example.
 * This component is registered in `mdx-components.tsx`, so a static import was
 * charged to all of them. The map itself is cheap to keep here: looking a name
 * up decides whether to load anything at all.
 *
 * The placeholder is the same `aspect-video` box the stage occupies, so the
 * swap moves nothing.
 */
const ComponentExampleStage = dynamic(
  () => import("./component-example-stage"),
  {
    ssr: false,
    loading: () => (
      <div className="surface-card aspect-video w-full rounded-2xl" />
    ),
  },
);

export function ComponentExample({ name }: { name: string }) {
  if (!examples[`${name}-example`]) {
    return (
      <div className="not-prose mb-6 rounded-lg border border-fd-border p-4 text-sm text-fd-muted-foreground">
        Unknown example: <code>{name}</code>
      </div>
    );
  }

  return (
    <div className="not-prose mb-6">
      <ComponentExampleStage name={name} />
    </div>
  );
}
