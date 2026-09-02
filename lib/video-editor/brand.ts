import type { ControlConfig } from "@/lib/customizer-config";
import { type Clip, isHexColor } from "./types";

/**
 * One accent and one logo, applied across every clip on the timeline.
 *
 * ## Why the knobs are declared and not detected
 *
 * The colour controls in this registry are called `accentColor`, `fieldColor`,
 * `titleColor`, `paperColor`, `voidColor`, `glowColorA` and plain `color`, and
 * a heuristic over those names puts `announce-title`'s title ink and its title
 * paper on the same hex — a headline that is invisible on its own background.
 * So each config marks its own knobs with `brand: "accent" | "logo"`, and this
 * file only ever moves what was marked. Ink is deliberately unmarked: text that
 * follows a brand colour is one pale palette away from unreadable.
 *
 * ## The typeface is not in here
 *
 * It is already a first-class field on the video (`font`) with a per-clip
 * override, both validated in `./fonts`. Duplicating it into the kit would give
 * "the video's font" two sources that can disagree.
 */
export interface BrandKit {
  /** Hex, or null for "every clip keeps its own accent". */
  accent: string | null;
  /** https: URL or a data: image, or null. */
  logo: string | null;
}

export const EMPTY_BRAND: BrandKit = { accent: null, logo: null };

export const hasBrand = (b: BrandKit): boolean =>
  Boolean(b.accent) || Boolean(b.logo);

/**
 * A logo the renderer will accept.
 *
 * This string reaches an `<img src>` inside a server-side render, and the
 * render takes a body from any client — the same reason `background` is
 * restricted to a literal hex in `./types`. `https:` and inline images only:
 * `javascript:` and `file:` are the two that matter, and an allowlist is the
 * only form of this check that stays correct as schemes are invented.
 */
export function isLogoSrc(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  return (
    value.startsWith("https://") ||
    /^data:image\/(png|jpeg|gif|webp|svg\+xml);/i.test(value)
  );
}

export function normalizeBrand(value: unknown): BrandKit {
  const v = (value ?? {}) as Record<string, unknown>;
  return {
    accent: isHexColor(v.accent) ? v.accent : null,
    logo: isLogoSrc(v.logo) ? v.logo : null,
  };
}

/**
 * Paint the kit onto every clip that declares a slot for it.
 *
 * `controlsFor` is passed in rather than imported: the registry barrel pulls in
 * every component in the library, and this module is also read by the render
 * validator, where none of that should be loaded to answer a question about
 * two strings.
 *
 * A null field is "leave it alone", not "clear it" — turning the accent off
 * must not wipe the colours somebody set by hand on a single clip.
 */
export function applyBrand(
  clips: Clip[],
  brand: BrandKit,
  controlsFor: (slug: string) => ControlConfig | undefined,
): Clip[] {
  if (!hasBrand(brand)) return clips;
  return clips.map((clip) => {
    const controls = controlsFor(clip.slug);
    if (!controls) return clip;
    let props = clip.props;
    for (const [key, ctrl] of Object.entries(controls)) {
      const role = "brand" in ctrl ? ctrl.brand : undefined;
      const next =
        role === "accent" ? brand.accent : role === "logo" ? brand.logo : null;
      if (next === null || props[key] === next) continue;
      // Copied on first write, so a timeline the kit does not touch keeps its
      // clip objects and React skips the re-render.
      if (props === clip.props) props = { ...clip.props };
      props[key] = next;
    }
    return props === clip.props ? clip : { ...clip, props };
  });
}
