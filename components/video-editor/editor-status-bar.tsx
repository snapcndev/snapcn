"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import {
  clampZoom,
  formatTimecode,
  sliderToZoom,
  zoomToSlider,
} from "@/lib/video-editor/timeline-zoom";
import { FontPicker } from "./font-picker";

/**
 * The bar under the timeline: zoom, a fit-to-width button, and the clock.
 *
 * The zoom reads as a percentage of the slider's own travel, not as px/s —
 * "48 px/s" is a number only the person who wrote the timeline understands.
 */
export function EditorStatusBar({
  font,
  onFontChange,
  pxPerSecond,
  onZoom,
  onFit,
  currentFrame,
  totalFrames,
  fps,
  clipCount,
}: {
  font: string;
  onFontChange: (next: string) => void;
  pxPerSecond: number;
  onZoom: (pxPerSecond: number) => void;
  onFit: () => void;
  currentFrame: number;
  totalFrames: number;
  fps: number;
  clipCount: number;
}) {
  const slider = zoomToSlider(pxPerSecond);

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-2">
      <div className="flex items-center gap-2.5">
        <p className="text-xs text-muted-foreground">
          {clipCount} {clipCount === 1 ? "clip" : "clips"}
        </p>

        {/* Project-wide, beside the other whole-timeline controls — it
            restyles every scene at once, so it does not belong in a clip's
            properties. */}
        <FontPicker value={font} onChange={onFontChange} />
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => onZoom(clampZoom(pxPerSecond / 1.4))}
          className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
        >
          <Minus className="size-3.5" />
        </button>

        {/* Same reason as the soundtrack slider: the width has to live on a
            wrapper, because the Slider root's own `data-horizontal:w-full`
            overrides anything passed to it. */}
        <div className="w-20 shrink-0 sm:w-32">
          <Slider
            value={[slider]}
            min={0}
            max={100}
            step={1}
            onValueChange={(v) =>
              onZoom(sliderToZoom(Array.isArray(v) ? (v[0] ?? slider) : v))
            }
            aria-label="Timeline zoom"
          />
        </div>

        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => onZoom(clampZoom(pxPerSecond * 1.4))}
          className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="size-3.5" />
        </button>

        <span className="w-9 text-right font-mono text-xs tabular-nums text-muted-foreground">
          {slider}%
        </span>

        <button
          type="button"
          onClick={onFit}
          aria-label="Fit timeline to width"
          title="Fit to width"
          className="ml-1 grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
        >
          <Maximize2 className="size-3.5" />
        </button>

        <span className="ml-1 hidden font-mono text-xs tabular-nums whitespace-nowrap text-muted-foreground sm:inline">
          {formatTimecode(currentFrame / fps)} /{" "}
          {formatTimecode(totalFrames / fps)}
        </span>
      </div>
    </div>
  );
}
