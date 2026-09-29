import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The largest it is ever drawn (`h-8`), at the source's 464:409. `next/image`
 * builds its srcset from these, so they are the rendered size, not the file's:
 * at 464×409 it served a 1080px-wide PNG for a 32px mark, and with `priority`
 * on both twins it preloaded the hidden one too — two early, high-priority
 * requests on every page, racing the content for a phone's bandwidth.
 * `lazy` on both: the twin the theme hides is `display: none` and is never
 * fetched, and the visible one is in the viewport, so it loads at first layout.
 */
const WIDTH = 36;
const HEIGHT = 32;

/**
 * The snapcn mark, as a light/dark pair.
 *
 * The mark is a single flat colour on transparency, so it cannot be one file:
 * the dark mark vanishes on the dark theme and the white one vanishes on the
 * light theme. Both are rendered and CSS picks — which means no `useTheme()`,
 * no client boundary, and no flash of the wrong logo on first paint (a theme
 * read in React happens after hydration; this happens at first style).
 *
 * ponytail: two PNGs because the mark only exists as raster. Redraw it as an
 * SVG on `currentColor` and this collapses to one ~1KB file that is crisp at
 * every DPI and needs no pair at all.
 */
export function SnapCnLogo({ className }: { className?: string }) {
  const size = cn("h-7 w-auto", className);

  return (
    <>
      <Image
        src="/logo/snapcn.png"
        alt="snapcn"
        width={WIDTH}
        height={HEIGHT}
        loading="lazy"
        className={cn(size, "dark:hidden")}
      />
      {/* Decorative twin: the light copy above already carries the alt text, so
          announcing this one would read the logo out twice. */}
      <Image
        src="/logo/snapcn-white.png"
        alt=""
        aria-hidden
        width={WIDTH}
        height={HEIGHT}
        loading="lazy"
        className={cn(size, "hidden dark:block")}
      />
    </>
  );
}
