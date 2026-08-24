"use client";

import { ChevronLeft, ChevronRight, GripVertical, Plus, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { ITEM_BY_SLUG } from "@/lib/gallery-data";
import { cn } from "@/lib/utils";
import { moveItem, slotAtX } from "@/lib/video-editor/reorder";
import { rulerTicks } from "@/lib/video-editor/timeline-zoom";
import { CANVAS, type Clip, totalDuration } from "@/lib/video-editor/types";

/** Clips narrower than this cannot hold a label, so they show only a tint. */
const LABEL_MIN_WIDTH = 56;

/**
 * Pixels of travel before a press counts as a drag.
 *
 * A click is never perfectly still — a mouse moves one or two pixels between
 * down and up, and a finger moves more. Treating that as a drag is what made
 * clips reorder when someone meant to select one.
 */
const DRAG_THRESHOLD = 5;

/**
 * The timeline: a time ruler, and one track of clips laid out *to scale*
 * beneath it.
 *
 * Width is the whole point. The old strip drew every clip as a fixed 160px
 * card, so a 0.5s sting and a 30s scene were the same size and the timeline
 * carried no information the clip list did not already have. Here a clip's
 * width is its duration, which is the only reason to draw a timeline at all.
 *
 * There is one track, not three. The reference this is modelled on has separate
 * rows for elements, media and audio; snapcn has one kind of clip, and drawing
 * two empty rows that accept nothing would be scenery.
 */
export function TimelineStrip({
  clips,
  selectedId,
  pxPerSecond,
  currentFrame,
  onSelect,
  onRemove,
  onMove,
  onReorder,
  onSeek,
}: {
  clips: Clip[];
  selectedId: string | null;
  pxPerSecond: number;
  currentFrame: number;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onReorder: (from: number, to: number) => void;
  onSeek: (frame: number) => void;
}) {
  // Pointer events, not HTML5 drag-and-drop: DnD gives no position updates on
  // mobile, ships a ghost image we would have to fight, and cannot be captured
  // — so a fast drag that leaves the element mid-gesture just stops. Capture
  // makes the track keep receiving moves until the finger lifts.
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{
    from: number;
    to: number;
    startX: number;
    /** Pixels the pointer has travelled since `startX`. */
    dx: number;
    /** False until the pointer has travelled far enough to mean it. */
    active: boolean;
  } | null>(null);

  const slotFromEvent = useCallback(
    (clientX: number) => {
      const box = trackRef.current?.getBoundingClientRect();
      if (!box) return 0;
      return slotAtX(clips, clientX - box.left, pxPerSecond);
    },
    [clips, pxPerSecond],
  );
  const totalSeconds = totalDuration(clips) / CANVAS.fps;
  const ticks = useMemo(
    () => rulerTicks(totalSeconds, pxPerSecond),
    [totalSeconds, pxPerSecond],
  );
  const trackWidth = totalSeconds * pxPerSecond;

  // Cumulative starts, so a clip knows where it begins without every render
  // re-summing the list inside the map.
  let elapsed = 0;
  const placed = clips.map((clip) => {
    const start = elapsed;
    const frames = Math.max(1, Math.round(clip.durationInFrames || 0));
    elapsed += frames;
    return { clip, start, frames };
  });

  /**
   * How far each clip has to slide, in pixels, to show where the dragged one
   * would land.
   *
   * Computed from the order the drop *would* produce rather than by animating
   * the real array: reordering state mid-gesture would move the element under
   * the pointer and the drag would chase itself. So `left` stays put for every
   * clip and the shift is a `translateX` — which also keeps the animation on
   * the compositor instead of relaying out the track on every pointer move.
   */
  const shifts = new Map<number, number>();
  if (drag?.active) {
    const order = moveItem(
      placed.map((_, i) => i),
      drag.from,
      drag.to,
    );
    let x = 0;
    for (const original of order) {
      const { start, frames } = placed[original];
      const baseLeft = (start / CANVAS.fps) * pxPerSecond;
      shifts.set(original, x - baseLeft);
      x += (frames / CANVAS.fps) * pxPerSecond;
    }
  }

  if (clips.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border bg-gallery-card/30">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Plus className="size-4" />
          Add a component from the left to start the timeline
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-gallery-card/30">
      <div
        className="relative min-w-full pb-3"
        style={{ width: Math.max(trackWidth, 1) }}
      >
        {/* Ruler. Seeking happens here rather than on the track, so clicking a
            clip selects it and clicking the ruler moves the playhead — two
            gestures that would otherwise fight over the same pixels. */}
        <button
          type="button"
          aria-label="Seek"
          onClick={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const seconds = (e.clientX - box.left) / pxPerSecond;
            onSeek(Math.round(seconds * CANVAS.fps));
          }}
          className="relative block h-7 w-full cursor-col-resize border-b border-border"
        >
          {ticks.map((tick) => (
            <span
              key={tick.seconds}
              style={{ left: tick.x }}
              className={cn(
                "absolute bottom-0 w-px bg-border",
                tick.major ? "h-3" : "h-1.5",
              )}
            >
              {tick.major && (
                <span className="absolute bottom-3.5 left-1 font-mono text-[0.625rem] tabular-nums whitespace-nowrap text-muted-foreground">
                  {tick.seconds}s
                </span>
              )}
            </span>
          ))}
        </button>

        {/* Track */}
        <div ref={trackRef} className="relative mt-2 h-16 px-0">
          {placed.map(({ clip, start, frames }, i) => {
            const name = ITEM_BY_SLUG.get(clip.slug)?.name ?? clip.slug;
            const width = (frames / CANVAS.fps) * pxPerSecond;
            const active = clip.id === selectedId;
            const roomy = width >= LABEL_MIN_WIDTH;
            const dragging = drag?.active === true && drag.from === i;

            return (
              <div
                key={clip.id}
                style={{
                  left: (start / CANVAS.fps) * pxPerSecond,
                  width: Math.max(width, 3),
                  // The dragged clip tracks the finger exactly and is lifted
                  // off the track; its neighbours slide to open the gap.
                  transform: dragging
                    ? `translateX(${drag.dx}px) scale(1.03)`
                    : `translateX(${shifts.get(i) ?? 0}px)`,
                  // No transition on the dragged one — a 150ms ease between the
                  // pointer and the card is lag, not polish.
                  transition: dragging
                    ? "none"
                    : "transform 160ms cubic-bezier(0.2, 0, 0, 1)",
                  zIndex: dragging ? 20 : undefined,
                  boxShadow: dragging
                    ? "0 12px 28px -8px rgba(0,0,0,0.35)"
                    : undefined,
                  cursor: dragging ? "grabbing" : undefined,
                }}
                className={cn(
                  "group absolute inset-y-0 overflow-hidden rounded-lg border transition-[border-color,background-color,opacity]",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-gallery-card hover:border-foreground/25",
                  // The clip being dragged fades and lifts; the slot it would
                  // land in is marked below. Two signals, so the gesture reads
                  // as "this is going there" rather than just "this is stuck".
                  // The card being carried stays fully opaque — it is the thing
                  // being looked at. The *gap* is the feedback, not a ghost.
                  dragging && "border-primary",
                )}
              >
                <button
                  type="button"
                  // Selection happens in `onPointerUp`, not here: a click fires
                  // after a drag too, so keeping both meant every reorder also
                  // selected whatever ended up under the cursor.
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onSelect(clip.id);
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setDrag({
                      from: i,
                      to: i,
                      startX: e.clientX,
                      dx: 0,
                      active: false,
                    });
                  }}
                  onPointerMove={(e) => {
                    if (!drag) return;
                    // Nothing happens until the pointer has moved DRAG_THRESHOLD.
                    // Without this, the few pixels of travel in an ordinary click
                    // register as a drag and the clip reorders instead of being
                    // selected — which reads as "selection stopped working".
                    const dx = e.clientX - drag.startX;
                    if (!drag.active && Math.abs(dx) < DRAG_THRESHOLD) return;
                    setDrag({
                      ...drag,
                      dx,
                      to: slotFromEvent(e.clientX),
                      active: true,
                    });
                  }}
                  onPointerUp={(e) => {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                    if (drag?.active && drag.to !== drag.from) {
                      onReorder(drag.from, drag.to);
                    } else {
                      // A press that never became a drag is a selection.
                      onSelect(clip.id);
                    }
                    setDrag(null);
                  }}
                  onPointerCancel={() => setDrag(null)}
                  // `touch-none`: without it a horizontal drag on a phone is
                  // claimed by the page scroller and the clip never moves.
                  className="absolute inset-0 flex cursor-grab touch-none flex-col items-start justify-start gap-0.5 p-2 text-left active:cursor-grabbing"
                >
                  {roomy && (
                    <>
                      <GripVertical className="absolute top-1.5 right-1.5 size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60" />
                      <span className="max-w-full truncate text-xs font-medium text-foreground">
                        {name}
                      </span>
                      <span className="font-mono text-[0.625rem] tabular-nums text-muted-foreground">
                        {(frames / CANVAS.fps).toFixed(1)}s
                      </span>
                    </>
                  )}
                </button>

                {/* Controls appear on hover so they never cover the clip's own
                    label at rest — a 56px clip has no room for both. */}
                <div className="absolute right-1 bottom-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => onMove(clip.id, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${name} earlier`}
                    className="grid size-5 place-items-center rounded bg-background/90 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(clip.id, 1)}
                    disabled={i === placed.length - 1}
                    aria-label={`Move ${name} later`}
                    className="grid size-5 place-items-center rounded bg-background/90 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(clip.id)}
                    aria-label={`Remove ${name}`}
                    className="grid size-5 place-items-center rounded bg-background/90 text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Playhead, spanning ruler and track. `pointer-events-none` so it never
            swallows a click meant for the clip underneath it. */}
        <div
          aria-hidden
          style={{ left: (currentFrame / CANVAS.fps) * pxPerSecond }}
          className="pointer-events-none absolute top-0 bottom-3 w-px bg-primary"
        >
          <span className="absolute -top-0.5 -left-[3px] size-[7px] rounded-full bg-primary" />
        </div>
      </div>
    </div>
  );
}
