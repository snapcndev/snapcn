/**
 * The small flag beside a nav item that carries one — "New", "Beta".
 *
 * One component for all three surfaces that show it (the header's desktop nav,
 * the header's mobile sheet, and the docs rail) so a flag cannot mean one thing
 * in one place and something else two clicks away.
 *
 * A **solid** chip, not a tinted one. The first version painted sky text on a
 * 10% sky wash, which is what the gallery's filter pill does — but that pill is
 * the size of a button and this is ten pixels of type next to thirteen. It read
 * as a smudge. A flag nobody notices is not a quieter flag, it is no flag.
 *
 * Two recipes, because one solid cannot serve both grounds — the same reason
 * the gallery's pill carries a sky-700/sky-400 pair. Measured, chip against the
 * page and type against the chip:
 *
 * | | chip vs page | type on chip |
 * | --- | --- | --- |
 * | old, 10% wash | **1.11:1** | 5.37 / 8.30:1 |
 * | sky-700 on white | 5.93:1 | 5.93:1 |
 * | sky-400 on near-black | 9.24:1 | 6.48:1 |
 *
 * 1.11:1 is the whole story of the first version: the type on it was perfectly
 * legible, and the chip itself was not there. It read as faint blue words, not
 * as a flag. Both replacements clear AA for small text, which sky-600 (4.10:1)
 * does not.
 *
 * No margin of its own: every call site puts it in a `flex items-center
 * gap-1.5`, so the spacing belongs to the row, not to the flag.
 */
export function NavBadge({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-sky-700 px-1.5 py-0.5 font-semibold text-[0.6875rem] text-white uppercase leading-[1.35] tracking-wide dark:bg-sky-400 dark:text-sky-950">
      {children}
    </span>
  );
}
