"use client";

import { ComponentCustomizer } from "@/components/docs/component-customizer";
import { ColorPicker } from "@/components/ui/color-picker";
import { ITEM_BY_SLUG } from "@/lib/gallery-data";
import {
  CANVAS,
  type Clip,
  DEFAULT_BACKGROUND,
  isHexColor,
} from "@/lib/video-editor/types";
import registry from "@/registry/__index__";
import { FontPicker } from "./font-picker";

export function PropertiesPanel({
  clip,
  maxFrames,
  onPropChange,
  onDurationChange,
  onBackgroundChange,
  onFontChange,
  videoFont,
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
  /** `null` clears the override and puts the clip back on the video's font. */
  onFontChange: (font: string | null) => void;
  /** What this clip inherits, so the row can say so instead of showing a lie. */
  videoFont: string;
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
        <ColorPicker
          id="clip-background"
          value={background}
          onValueChange={onBackgroundChange}
          className="flex items-center gap-2"
        >
          <span className="font-medium font-mono text-foreground text-sm uppercase">
            {background}
          </span>
          <span
            aria-hidden="true"
            className="inline-flex size-5 shrink-0 rounded-lg border border-border/60"
            style={{ background }}
          />
        </ColorPicker>
      </div>

      {/* Typeface sits beside Background, and for the same reason: both belong
          to the clip rather than to the component, and both are things a person
          reaches for while looking at one scene. The video-wide picker in the
          status bar sets the default; this overrides it for this clip alone,
          which is what a title in one face over a body in another needs. */}
      <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-muted px-3.5 py-2.5">
        <span className="font-medium text-muted-foreground text-sm">Font</span>
        <span className="flex items-center gap-1.5">
          {clip.font && (
            <button
              type="button"
              onClick={() => onFontChange(null)}
              className="text-muted-foreground text-xs hover:text-foreground"
              title={`Back to the video font (${videoFont})`}
            >
              Reset
            </button>
          )}
          <FontPicker
            value={clip.font ?? videoFont}
            onChange={(next) => onFontChange(next)}
          />
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
