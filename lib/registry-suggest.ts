/**
 * "Did you mean…" for a registry name that does not exist.
 *
 * Deliberately conservative. Most of what gets requested has no near match at
 * all — thirty days of misses included `blur-out-up`, `dynamic-grid`,
 * `shader-warp` and `number-wheel`, and the honest answer to every one of them
 * is "snapcn does not have that", not the least-bad name in the registry. A
 * confident wrong suggestion is worse than none: it sends someone to install a
 * component that does not do what they asked for.
 *
 * Two ways to qualify, because the misses come from two different mistakes:
 *
 *  - **A typo** — `text-revel`, `promt-send`. Caught by edit distance ≤ 2.
 *  - **A near-miss on wording** — `text-swap-words`, `reveal-text`. Caught by
 *    sharing at least half the hyphen-separated words.
 *
 * An invented name passes neither, which is the point.
 */

/** Edit distance, capped — anything past `max` is "far" and the value is unused. */
function editDistance(a: string, b: string, max = 3): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(
        (prev[j] as number) + 1,
        (row[j - 1] as number) + 1,
        (prev[j - 1] as number) + cost,
      );
      best = Math.min(best, row[j] as number);
    }
    // Whole remaining rows can only grow, so a row that is already too far ends it.
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length] as number;
}

/** Fraction of hyphen-separated words the two names share. */
function wordOverlap(a: string, b: string): number {
  const wa = new Set(a.split("-").filter(Boolean));
  const wb = new Set(b.split("-").filter(Boolean));
  if (!wa.size || !wb.size) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.max(wa.size, wb.size);
}

/**
 * The closest real names to `wanted`, best first — usually none.
 *
 * @param limit how many to offer; three is enough to be useful and few enough
 *              to read in a terminal.
 */
export function suggestComponents(
  wanted: string,
  known: readonly string[],
  limit = 3,
): string[] {
  const name = wanted.toLowerCase();
  return known
    .map((candidate) => {
      const distance = editDistance(name, candidate);
      const overlap = wordOverlap(name, candidate);
      // Rank by overlap first — a shared word means more than a shared letter —
      // and fall back to closeness for the pure-typo case.
      const score = overlap * 10 + (distance <= 2 ? 3 - distance : 0);
      return { candidate, score, distance, overlap };
    })
    .filter((c) => c.distance <= 2 || c.overlap >= 0.5)
    .sort((a, b) => b.score - a.score || a.candidate.localeCompare(b.candidate))
    .slice(0, limit)
    .map((c) => c.candidate);
}
