/**
 * The two things every RSS feed on this site needs, defined once.
 *
 * Both were local to the changelog feed until the blog needed a feed too, and
 * an escaper that exists twice is an escaper that gets fixed once. `rfc822`
 * takes a `Date` rather than the changelog's ISO day string because a post
 * carries a real `Date` from its frontmatter — callers holding a `YYYY-MM-DD`
 * pass `new Date(`${day}T00:00:00Z`)` and keep the midnight-UTC convention the
 * changelog page prints.
 */

/** A date, as the RFC 822 string RSS requires. */
export function rfc822(date: Date): string {
  return date.toUTCString();
}

/**
 * XML-escape a text node or attribute value.
 *
 * `&` first, or every entity this function just wrote gets its ampersand
 * escaped a second time.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
