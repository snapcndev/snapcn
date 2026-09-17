/**
 * Which demos are allowed to play, and which are allowed to stay in memory.
 *
 * `/docs/components` is 76 cards and every one of them is a video. Measured on
 * the built site at 1440x900, before this file existed:
 *
 *   24 videos playing at once (8 of them off-screen), 76 elements all holding a
 *   src after one scroll to the bottom, 270 seconds of buffered video retained,
 *   and 18.7MB of mp4 pulled for a single visit.
 *
 * Three separate faults, and the ranking below fixes them in one place because
 * they are one decision: what is this element for, right now.
 *
 *  - **Off-screen playback.** Each card observed itself with a 200px margin and
 *    played on intersect, so the band above and below the fold ran too.
 *  - **No cap.** Everything visible played. macOS gives Chrome a limited number
 *    of hardware decode sessions; past it the rest fall back to *software*
 *    decode, which is the fan. A cap is not a nicety, it is the difference
 *    between 12 cheap streams and 24 expensive ones.
 *  - **Nothing was ever released.** A card scrolled past kept its src, its
 *    buffer and its decoder for the life of the page.
 *
 * And one thing that is not a fault but costs the same: a fast scroll to the
 * bottom used to start every video it swept past. Playback now waits for the
 * card to still be there a moment later, so flicking through the grid downloads
 * nothing.
 *
 * Pure and DOM-free so it can be tested without a browser — the observer that
 * feeds it lives in `rendered-demos.tsx`.
 */

/** How many may decode at once. Chosen to stay inside hardware decode. */
export const MAX_PLAYING = 12;

/** How long a card must stay on screen before it is worth starting. */
export const SETTLE_MS = 180;

/** What a demo element should be doing. */
export type DemoState =
  /** On screen and within the cap: decoding. */
  | "play"
  /** On screen but over the cap: loaded, so it shows a frame, but not decoding. */
  | "hold"
  /** Near the viewport: metadata only, so arriving is instant and cheap. */
  | "ready"
  /** Far away: no src, no buffer, no decoder. */
  | "release";

export interface DemoView {
  /** Fraction of the element inside the viewport, 0 when outside it. */
  ratio: number;
  /** Whether it is inside the wider band we keep loaded. */
  near: boolean;
  /**
   * The demo the reader opened — the gallery's detail overlay. Ranked ahead of
   * every card: IntersectionObserver cannot see that a modal covers the grid,
   * so the twelve cards behind it all read as fully on screen and took every
   * slot, and the one video the reader had just asked for sat paused on its
   * first frame.
   */
  priority?: boolean;
}

/**
 * The state every element should be in, keyed the same way as the input.
 *
 * Ranked by priority (see `DemoView.priority`), then by how much of the card
 * is on screen, so the ones that lose are the slivers at the top and bottom
 * edges rather than whatever happened to mount first. Ties break on key, so the result is stable across scroll frames and a
 * card does not flicker between playing and held while the ratios wobble.
 */
export function planDemos<K>(
  views: Map<K, DemoView>,
  cap: number = MAX_PLAYING,
): Map<K, DemoState> {
  const ranked = [...views.entries()]
    .filter(([, v]) => v.ratio > 0)
    .sort(
      (a, b) =>
        Number(b[1].priority ?? false) - Number(a[1].priority ?? false) ||
        b[1].ratio - a[1].ratio ||
        String(a[0]).localeCompare(String(b[0])),
    );
  const playing = new Set(ranked.slice(0, cap).map(([key]) => key));

  // Built in the caller's own key order, not in rank order: the result is read
  // against the previous plan element by element, and an order that reshuffles
  // every scroll frame would make that comparison meaningless.
  const plan = new Map<K, DemoState>();
  for (const [key, view] of views) {
    if (playing.has(key)) plan.set(key, "play");
    else if (view.ratio > 0) plan.set(key, "hold");
    else plan.set(key, view.near ? "ready" : "release");
  }
  return plan;
}
