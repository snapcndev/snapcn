import type { ControlConfig } from "@/lib/customizer-config";
import { type Clip, MAX_CLIP_FRAMES, MAX_TOTAL_FRAMES } from "./types";

/**
 * One dial for how fast the whole video moves.
 *
 * ## Why it is not just a number written onto every clip
 *
 * 38 of the components take a `speed` prop, and **18 of them have `min: 1`** —
 * they were tuned to run at their own pace or faster, and slowing them was
 * never an option their author left open. A dial that wrote 0.5 onto all of
 * them would be writing a value the control refuses, so each clip is clamped to
 * its own control's range and the ones that cannot slow simply do not.
 *
 * ## Why the length moves with it
 *
 * `speed` scales the component's clock, not its sequence. Doubling it without
 * halving `durationInFrames` leaves the animation finished and the frame held —
 * dead air at the end of every clip, which reads as the video stalling rather
 * than as a faster cut.
 *
 * The length is scaled from the clip's CURRENT duration rather than recomputed
 * from the component's natural one, so a clip somebody trimmed by hand keeps
 * its trim: the ratio is what tempo changes, not the value.
 */
export const DEFAULT_TEMPO = 1;
export const MIN_TEMPO = 0.5;
export const MAX_TEMPO = 2;

export const isTempo = (v: unknown): v is number =>
  typeof v === "number" &&
  Number.isFinite(v) &&
  v >= MIN_TEMPO &&
  v <= MAX_TEMPO;

export const normalizeTempo = (v: unknown): number =>
  isTempo(v) ? v : DEFAULT_TEMPO;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/**
 * The `speed` this clip would run at, given the dial — its own control's range,
 * not the dial's. Null when the component has no speed control at all, which is
 * every device frame and every scene whose timing is its content's.
 */
function speedFor(
  controls: ControlConfig | undefined,
  tempo: number,
): number | null {
  const ctrl = controls?.speed;
  if (!ctrl || ctrl.type !== "number") return null;
  return clamp(tempo, ctrl.min, ctrl.max);
}

/**
 * Re-time every clip that can be re-timed.
 *
 * Slowing down can push the timeline past the frame budget the export enforces,
 * so growth is paid out of what is actually left — clips earlier on the
 * timeline get it first, and one that cannot be lengthened keeps the length it
 * has rather than making the video unexportable.
 */
export function applyTempo(
  clips: Clip[],
  tempo: number,
  controlsFor: (slug: string) => ControlConfig | undefined,
): Clip[] {
  let spent = 0;
  return clips.map((clip, i) => {
    const controls = controlsFor(clip.slug);
    const next = speedFor(controls, tempo);
    const current = clip.durationInFrames;
    if (next === null) {
      spent += current;
      return clip;
    }
    const prev =
      typeof clip.props.speed === "number" && clip.props.speed > 0
        ? clip.props.speed
        : ((controls?.speed as { default: number }).default ?? DEFAULT_TEMPO);
    if (prev === next) {
      spent += current;
      return clip;
    }
    // Everything after this clip still needs at least a frame each.
    const rest = clips.length - i - 1;
    const room = Math.max(1, MAX_TOTAL_FRAMES - spent - rest);
    const scaled = Math.round(current * (prev / next));
    const duration = clamp(scaled, 1, Math.min(MAX_CLIP_FRAMES, room));
    spent += duration;
    return {
      ...clip,
      props: { ...clip.props, speed: next },
      durationInFrames: duration,
    };
  });
}
