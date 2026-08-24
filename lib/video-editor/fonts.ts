import { getAvailableFonts } from "@remotion/google-fonts";

/**
 * Typeface selection for the editor.
 *
 * Two kinds of value share one string field on the wire:
 *
 *  - a **built-in id** (`system`, `serif`, `mono`) — a stack of faces already on
 *    the machine, so nothing is fetched and nothing can fail to load.
 *  - a **Google family name** (`Inter`, `Playfair Display`, …) — fetched at
 *    render time from Google's CSS API.
 *
 * One field rather than a tagged union because it crosses to a server-side
 * renderer: a single string with one validation path is far easier to prove
 * safe than a shape with a discriminator that has to be checked twice.
 */

export const BUILT_IN_FONTS = {
  system: {
    label: "System",
    stack:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, sans-serif",
  },
  serif: {
    label: "Serif (system)",
    stack: "Georgia, 'Times New Roman', serif",
  },
  mono: {
    label: "Mono (system)",
    stack: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
} as const;

export type BuiltInFont = keyof typeof BUILT_IN_FONTS;

/** The registry's own face, and the editor's default. */
export const DEFAULT_FONT = "Geist";

/**
 * Every Google family the renderer can fetch, as a Set for O(1) validation.
 *
 * `getAvailableFonts()` is static data shipped inside `@remotion/google-fonts`
 * — no API key, no network call, and no chance of the picker offering a family
 * the renderer cannot then load.
 */
export const GOOGLE_FAMILIES: string[] = getAvailableFonts().map(
  (f) => f.fontFamily,
);
const GOOGLE_SET = new Set(GOOGLE_FAMILIES);

/** A font value the renderer will accept. Anything else is the default. */
export function isValidFont(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value in BUILT_IN_FONTS || GOOGLE_SET.has(value))
  );
}

export function normalizeFont(value: unknown): string {
  return isValidFont(value) ? value : DEFAULT_FONT;
}

export interface ResolvedFont {
  /** Value for `font-family`. */
  stack: string;
  /** Family to fetch from Google, or null when it is already on the machine. */
  googleFamily: string | null;
  label: string;
}

export function resolveFont(value: string): ResolvedFont {
  if (value in BUILT_IN_FONTS) {
    const b = BUILT_IN_FONTS[value as BuiltInFont];
    return { stack: b.stack, googleFamily: null, label: b.label };
  }
  const family = GOOGLE_SET.has(value) ? value : DEFAULT_FONT;
  // The generic fallback matters: it is what shows while the face is still
  // loading, and what shows forever if the fetch fails.
  return {
    stack: `'${family}', -apple-system, BlinkMacSystemFont, sans-serif`,
    googleFamily: family,
    label: family,
  };
}

/**
 * The stylesheet URL for a family.
 *
 * `display=block` rather than `swap`: a swap would render one frame in the
 * fallback and the next in the real face, which in a video is a visible flash
 * mid-shot. Blocking is correct when the renderer is waiting anyway.
 *
 * Weights are fixed to the four the components use. Requesting the full axis
 * for 1821 possible families would make every render fetch megabytes it never
 * draws with.
 */
export function googleFontHref(family: string): string {
  const name = family.trim().replace(/\s+/g, "+");
  return `https://fonts.googleapis.com/css2?family=${name}:wght@400;500;600;700&display=block`;
}
