/**
 * Search-result lengths for `<title>` and `<meta name="description">`.
 *
 * Google cuts a title at ~600px (~60–65 characters) and a snippet at ~160
 * characters. Past that the tail is an ellipsis the reader never sees — and in
 * a title the tail is ` · snapcn`, the root layout's template, which pushed 19
 * otherwise-fitting post titles over the line. Measured on the live sitemap:
 * 32 of 153 titles and 88 of 153 descriptions ran long. Every route's metadata
 * goes through these two, so a new page cannot quietly add to either count.
 */

const SUFFIX = " · snapcn";
export const TITLE_MAX = 65;
export const DESCRIPTION_MAX = 160;
const DESCRIPTION_MIN = 70;

/** The title, with the site suffix only when it still fits. */
export function metaTitle(title: string): string | { absolute: string } {
  return title.length + SUFFIX.length <= TITLE_MAX
    ? title
    : { absolute: title };
}

/**
 * The description, cut to fit: as many whole sentences as fit in 160; if that
 * says too little (one long first sentence), the longest word-boundary cut.
 */
export function metaDescription(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= DESCRIPTION_MAX) return clean;
  let out = "";
  for (const sentence of clean.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? []) {
    const next = `${out}${sentence}`.trim();
    if (next.length > DESCRIPTION_MAX) break;
    out = `${next} `;
  }
  out = out.trim();
  if (out.length >= DESCRIPTION_MIN) return out;
  const cut = clean.slice(0, DESCRIPTION_MAX - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:—–-]+$/, "")}…`;
}
