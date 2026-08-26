import "server-only";

/**
 * Collapses a burst of search-as-you-type requests into the one query the
 * person actually stopped on.
 *
 * ## The bug
 *
 * fumadocs fires a request per keystroke, so one search arrived as one event
 * per character. Thirty days of real data was thirteen events describing five
 * searches:
 *
 *     combo · combob · comboboc · combobox
 *     dropd · dropdo · dropdown · dropdown'
 *     mai · mais        syna · synam        prest
 *
 * The route already dropped queries under three characters, which removes the
 * first two keystrokes and nothing else. Every prefix from three up still
 * landed, and each one counted as its own zero-result "component request" —
 * so the signal the route exists to collect said "people want `combo`" four
 * times and "people want `combobox`" once.
 *
 * ## The rule
 *
 * A search replaces the one that person made moments ago; only what survives
 * {@link IDLE_MS} of quiet is emitted. Last-write-wins rather than
 * longest-prefix-wins, because a correction is not a prefix — `comboboc` →
 * `combobox` diverges at the final character, and prefix matching would have
 * emitted both.
 *
 * Merging two deliberate searches made inside the window is the failure mode
 * this accepts. It is the right way round: emitting a half-typed word is the
 * bug being fixed, and losing the first of two rapid searches costs one data
 * point of the same kind.
 *
 * ## Why it survives being deployed
 *
 * The buffer is in-process, which is exact on the single container this runs on
 * and degrades to today's behaviour if it were ever spread across instances —
 * some prefixes leak through, nothing breaks.
 *
 * Flushing is driven two ways on purpose. `sweep` runs on every incoming
 * search, so the buffer drains without needing a live timer; the caller may
 * also arm one for timeliness. Neither is required for correctness, because an
 * emitted event carries the timestamp of the *search*, not of the flush — a
 * query that sits in the buffer overnight still lands on the right day.
 */

/** How long a person must stop typing before their query counts as intent. */
export const IDLE_MS = 2500;

/** A ceiling so a flood cannot grow the buffer without bound. */
const MAX_PENDING = 500;

export interface PendingSearch {
  distinctId: string;
  query: string;
  results: number;
  /** When the search happened — not when it was flushed. */
  at: number;
}

const pending = new Map<string, PendingSearch>();

/** Everything that has gone quiet, oldest first. Removes what it returns. */
function sweep(now: number): PendingSearch[] {
  const out: PendingSearch[] = [];
  for (const [id, p] of pending) {
    if (now - p.at >= IDLE_MS) {
      out.push(p);
      pending.delete(id);
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * Record a search. Returns the searches that are now settled and should be
 * sent — which is usually nothing, and never the one just passed in.
 */
export function recordSearch(
  search: PendingSearch,
  now: number = Date.now(),
): PendingSearch[] {
  // Sweep first: if this person's previous query has already gone quiet it is a
  // separate search, not a keystroke, and it goes out rather than being
  // overwritten by this one.
  const settled = sweep(now);

  pending.set(search.distinctId, { ...search, at: now });

  // Oldest out first if the buffer is somehow full. Cannot happen at this
  // traffic; it is here so it cannot happen at any traffic.
  while (pending.size > MAX_PENDING) {
    const oldest = [...pending.values()].reduce((a, b) =>
      b.at < a.at ? b : a,
    );
    pending.delete(oldest.distinctId);
    settled.push(oldest);
  }

  return settled;
}

/** Drain everything quiet right now. For a timer, or a shutdown. */
export function flushSettled(now: number = Date.now()): PendingSearch[] {
  return sweep(now);
}

/** Test seam — the buffer is module state and each test needs its own. */
export function __resetSearchLog(): void {
  pending.clear();
}
