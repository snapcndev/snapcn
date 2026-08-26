import { createFromSource } from "fumadocs-core/search/server";
import { after } from "next/server";
import {
  anonymousId,
  captureServer,
  distinctIdFromCookie,
} from "@/lib/analytics-server";
import { recordSearch } from "@/lib/server/search-log";
import { source } from "@/source";

/**
 * Docs search, wrapped so that every query is recorded with its result count.
 *
 * ## Why here and not in the search dialog
 *
 * The dialog is fumadocs'. Instrumenting it would mean forking a component we
 * otherwise get for free, and re-forking it on every fumadocs upgrade. This
 * route is the one thing every search — from the dialog, from `⌘K`, from a
 * direct hit — necessarily passes through, and wrapping it is nine lines.
 *
 * ## Why it is worth recording at all
 *
 * A query that returns **zero results is a component request written by a user
 * who did not know they were filing one.** Someone typing "confetti", "ken
 * burns", "waveform" into a registry that has none of them is the single
 * highest-signal input to what gets built next, and it is invisible in every
 * other event on the site — they search, find nothing, and leave without
 * clicking anything we could have measured.
 *
 * ## Why the query is not sent from here
 *
 * Because a request per keystroke means an event per keystroke, and the first
 * thirty days of this collected thirteen events describing five searches — four
 * of them prefixes of `combobox`. The length guard below removes two characters
 * of that and no more. {@link recordSearch} holds each query until the person
 * stops typing and emits only what they settled on; see the note there for why
 * the rule is last-write-wins rather than longest-prefix.
 */
const { GET: search } = createFromSource(source);

export async function GET(request: Request) {
  const response = await search(request);

  const query = new URL(request.url).searchParams.get("query")?.trim();
  // Fumadocs fires a request per keystroke. One- and two-character queries are
  // never intent, so they are dropped before they can even take a slot in the
  // buffer; everything longer is debounced by `recordSearch`.
  if (query && query.length >= 3) {
    // `clone()`: the body can only be read once, and the caller needs it.
    const results = await response
      .clone()
      .json()
      .then((r: unknown) => (Array.isArray(r) ? r.length : 0))
      .catch(() => 0);

    after(async () => {
      const ua = request.headers.get("user-agent");
      const distinctId =
        distinctIdFromCookie(cookieJar(request)) ??
        (await anonymousId(
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "unknown",
          ua ?? "none",
        ));
      // Returns the *earlier* searches this one has settled, never itself.
      const settled = recordSearch({
        distinctId,
        query: query.toLowerCase(),
        results,
        at: Date.now(),
      });

      for (const s of settled) {
        await captureServer(
          "docs_searched",
          s.distinctId,
          {
            query: s.query,
            results: s.results,
            // The property to build the "what are we missing" insight on.
            zero_results: s.results === 0,
          },
          new Date(s.at).toISOString(),
        );
      }
    });
  }

  return response;
}

/** `distinctIdFromCookie` wants a `cookies.get(name)` shape; Request has a header. */
function cookieJar(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  return {
    get(name: string) {
      for (const part of header.split(";")) {
        const eq = part.indexOf("=");
        if (eq === -1) continue;
        if (part.slice(0, eq).trim() === name) {
          return { value: part.slice(eq + 1).trim() };
        }
      }
      return undefined;
    },
  };
}
