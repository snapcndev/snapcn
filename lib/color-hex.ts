/**
 * Hex ⇄ HSV, and the parse that tolerates a half-typed value.
 *
 * Split from the picker component because it is the part worth testing and the
 * part other surfaces want: `culori` is already a dependency and handles oklch
 * for the registry, but it has no opinion about a string somebody is still in
 * the middle of typing — which is the only interesting case here.
 */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * A hex string, or null while it is still being typed.
 *
 * Accepts a missing hash and the three-digit form, because both are what people
 * paste out of a brand document — and returns null for everything else rather
 * than guessing, so a half-typed value never becomes a colour.
 */
export function normalizeHex(raw: string): string | null {
  const body = raw.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(body)) return `#${body.toUpperCase()}`;
  if (/^[0-9a-f]{3}$/i.test(body)) {
    return `#${body
      .split("")
      .map((c) => c + c)
      .join("")
      .toUpperCase()}`;
  }
  return null;
}

export function hexToHsv(hex: string): Hsv {
  const normalized = normalizeHex(hex) ?? "#000000";
  const r = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const g = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const b = Number.parseInt(normalized.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    // Deliberately NOT rounded. `hsvToHex` is the exact inverse of this, and a
    // hue rounded to the nearest degree comes back a channel off — #F8371A
    // round-tripped to #F8381A, which is one silent corruption per open of the
    // picker on a colour somebody had already chosen. Round for display only.
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  const hex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}
