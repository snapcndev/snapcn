import { NewsletterForm } from "@/components/newsletter-form";

/**
 * The ask, at the foot of every docs page.
 *
 * The capture existed on one URL — the home page — while every component page
 * is its own landing page for its own search ("remotion karaoke captions") and
 * asked the reader for nothing. Somebody who arrived cold on `text-reveal`,
 * copied the install line and left was never given a way to hear about the next
 * component, and that is most of the traffic this site gets.
 *
 * Deliberately a quiet strip rather than a second hero: it sits under
 * `RelatedComponents` at the end of the prose, where a reader who got this far
 * has already had the thing they came for. A docs page that opens with a
 * capture band is a docs page people stop linking to.
 *
 * `defaultSource: "docs"` so the list can be split by the surface that earned
 * it. `?ref=` still overrides — the `shadcn add` string links here with
 * `?ref=cli`, and a CLI-won address should not be filed as a docs one.
 */
export function DocsNewsletterCta() {
  return (
    <aside className="mt-14 rounded-lg border border-border bg-muted/30 p-6">
      <h2 className="font-medium text-foreground text-sm">
        Get the next component in your inbox
      </h2>
      <p className="mt-1.5 max-w-[52ch] text-muted-foreground text-sm leading-relaxed">
        New free components as they ship, and the pro pack first when it lands.
        One email a week at most, never a sponsored one.
      </p>
      <NewsletterForm
        defaultSource="docs"
        id="docs-newsletter-email"
        buttonLabel="Join"
        className="mt-4 max-w-md"
      />
    </aside>
  );
}
