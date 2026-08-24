import { CANVAS, type Clip } from "./types";

/**
 * Drag-to-reorder arithmetic, kept out of the component.
 *
 * Every bug in a reorder is an off-by-one that only shows up in one direction —
 * drag right and it lands a slot short, drag left and it lands a slot long —
 * and neither is visible from reading the JSX.
 */

/** `arr` with the item at `from` moved to `to`. Returns the input when unmoved. */
export function moveItem<T>(arr: readonly T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= arr.length ||
    to >= arr.length
  ) {
    return arr as T[];
  }
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Which slot a pointer at `x` (pixels from the track's left edge) is over.
 *
 * Compares against each clip's *midpoint*, not its leading edge: a clip should
 * take a slot once the pointer is more than halfway across the neighbour it is
 * displacing, which is the moment the swap stops feeling premature. Clamped to
 * the ends so dragging past either edge parks the clip there rather than
 * returning -1.
 */
export function slotAtX(
  clips: readonly Clip[],
  x: number,
  pxPerSecond: number,
): number {
  if (clips.length === 0) return 0;

  let left = 0;
  for (let i = 0; i < clips.length; i++) {
    const width =
      (Math.max(1, Math.round(clips[i].durationInFrames || 0)) / CANVAS.fps) *
      pxPerSecond;
    if (x < left + width / 2) return i;
    left += width;
  }
  return clips.length - 1;
}
