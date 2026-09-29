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
 * Two faults, fixed in one place because they are one decision: what is this element for, right now.
 *
 *  - **Off-screen playback.** Each card observed itself with a 200px margin and
 *    played on intersect, so the band above and below the fold ran too.
 *  - **There is deliberately no cap on what is on screen.** There was one
 *    (twelve), and it was the "only thumbnails" report: this grid shows 16–24
 *    cards on any desktop, so a third to half of what the reader was looking at
 *    sat frozen on its poster — and because the losers were picked by a string
 *    sort of numeric ids ("10" < "2"), a full row in the middle froze while
 *    slivers at the bottom played, which reads as broken, not as throttled.
 *    Visible means playing. Everything else below is what keeps that cheap.
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

/** How long a card must stay on screen before it is worth starting. */
export const SETTLE_MS = 180;

/** What a demo element should be doing. */
export type DemoState =
  /** On screen: decoding. */
  | "play"
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
   * The demo the reader opened — the gallery's detail overlay.
   * IntersectionObserver cannot see that a modal covers the grid, so the cards
   * behind it read as fully on screen; this is how the plan knows they are not.
   */
  priority?: boolean;
}

/** The state every element should be in, keyed the same way as the input. */
export function planDemos<K>(views: Map<K, DemoView>): Map<K, DemoState> {
  // The opened demo sits in a modal over the grid. The cards under it read as
  // on screen and are not: left in the plan they fetched and decoded behind
  // the modal and split the connection with the one video being watched —
  // which, on a slow link, is how the opened demo sat on its poster "loading"
  // while twelve hidden ones downloaded. Covered cards keep their src (so
  // closing the overlay is instant) and fetch nothing.
  const opened = [...views.values()].some((v) => v.priority && v.ratio > 0);

  // Built in the caller's own key order: the result is read against the
  // previous plan element by element.
  const plan = new Map<K, DemoState>();
  for (const [key, view] of views) {
    const covered = opened && !view.priority;
    if (view.ratio > 0 && !covered) plan.set(key, "play");
    else plan.set(key, view.near || view.ratio > 0 ? "ready" : "release");
  }
  return plan;
}
