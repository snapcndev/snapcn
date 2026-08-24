"use client";

import { ComponentCustomizer } from "@/components/docs/component-customizer";
import { ITEM_BY_SLUG } from "@/lib/gallery-data";
import {
  CANVAS,
  type Clip,
  DEFAULT_BACKGROUND,
  isHexColor,
} from "@/lib/video-editor/types";
import registry from "@/registry/__index__";

export function PropertiesPanel({
  clip,
  maxFrames,
  onPropChange,
  onDurationChange,
  onBackgroundChange,
}: {
  clip: Clip | null;
  /**
   * Longest this clip may run: the per-clip ceiling, or what the timeline's
   * frame budget has left once the other clips are paid for — whichever is
   * smaller. Capping the control matters more than clamping the value: a
   * slider that silently snaps back reads as broken.
   */
  maxFrames: number;
  onPropChange: (key: string, value: unknown) => void;
  onDurationChange: (frames: number) => void;
  onBackgroundChange: (background: string) => void;
}) {
  if (!clip) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Select a clip on the timeline to edit its text, images, and length.
      </div>
    );
  }

  const entry = registry[clip.slug];
  if (!entry) return null;
  const name = ITEM_BY_SLUG.get(clip.slug)?.name ?? clip.slug;
  const secs = clip.durationInFrames / CANVAS.fps;
  // `<input type="color">` silently resets to #000000 on a value it cannot
  // parse, so never hand it anything but a hex string.
  const background = isHexColor(clip.background)
    ? clip.background
    : DEFAULT_BACKGROUND;

  return (
    <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto p-4">
      <h3 className="text-sm font-semibold text-foreground">{name}</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Edits preview live. Upload your own images with the Upload button.
      </p>

      <div className="mb-4">
        <label
          htmlFor="clip-duration"
          className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground"
        >
          <span>Duration</span>
          <span className="font-mono text-foreground">{secs.toFixed(1)}s</span>
        </label>
        <input
          id="clip-duration"
          type="range"
          min={0.5}
          max={maxFrames / CANVAS.fps}
          step={0.5}
          value={secs}
          onChange={(e) =>
            onDurationChange(Math.round(Number(e.target.value) * CANVAS.fps))
          }
          style={{ accentColor: "var(--primary)" }}
          className="w-full"
        />
      </div>

      {/* Background sits above the component's own controls, not inside them:
          it belongs to the clip, not to the component, and every clip has one
          whether or not its component takes a background prop. Markup mirrors
          the customizer's `color` row so the two read as one panel. */}
      <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-muted px-3.5 py-2.5">
        <label
          htmlFor="clip-background"
          className="text-sm font-medium text-muted-foreground"
        >
          Background
        </label>
        <span className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium uppercase text-foreground">
            {background}
          </span>
          <span className="relative inline-flex size-5 shrink-0 overflow-hidden rounded-lg border border-border/60">
            <input
              id="clip-background"
              type="color"
              value={background}
              onChange={(e) => onBackgroundChange(e.target.value)}
              className="absolute top-1/2 left-1/2 size-[200%] -translate-x-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0"
            />
          </span>
        </span>
      </div>

      <ComponentCustomizer
        controls={entry.config.controls}
        values={clip.props}
        onChange={onPropChange}
        columns={1}
      />
    </div>
  );
}
