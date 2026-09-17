import { PRO_NAMES } from "@/config/site";
import { GALLERY_COUNT, ITEM_BY_SLUG } from "@/lib/gallery-data";
import {
  CATALOGUE_PRICE,
  CATALOGUE_PROMISE,
  EARLY_BIRD,
  earlyBirdDaysLeft,
  PLANS,
  SEPTEMBER_BONUS,
  septemberBonusActive,
} from "@/lib/plans";
import { bearer, planForApiKey } from "@/lib/server/api-key";
import { readProItem } from "@/lib/server/pro-registry";

/**
 * The pro half of the registry.
 *
 * Free items are never routed here at all: `shadcn build` writes them into
 * `public/r/`, and Next serves a public file before it looks at a route. So the
 * free install path — the one carrying every visitor and every `llms.txt`
 * crawler — stays a static file on the CDN with no database and no cold start,
 * and this handler only ever runs for something somebody has to pay for.
 *
 * That is also why the split is a build step (`scripts/split-pro.mts`) rather
 * than a branch in here. A gate that has to remember to say no is one refactor
 * away from saying yes; a file that was never published cannot leak.
 */

export const runtime = "nodejs";

/**
 * `shadcn add` fetches `/r/<name>.json`. Anything that is not exactly that
 * shape — a traversal, a nested path, a second extension — is not a component
 * name, and the safest thing to do with it is to not touch the filesystem.
 */
function componentName(file: string): string | null {
  const match = file.match(/^([a-z0-9]([a-z0-9-]*[a-z0-9])?)\.json$/);
  return match?.[1] ?? null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const name = componentName((await params).file);
  if (!name) return new Response("Not found", { status: 404 });

  // Absent is not the same as unknown — see `listed` below.
  const body = await readProItem(name);

  /**
   * Is this a paid component at all?
   *
   * Two sources, deliberately, and the union of them. `registry/.private/` is
   * the built source and is **gitignored**, so a deployment built from the
   * public repo has none of it — which is why every pro fetch answered a plain
   * 404 in production and the 402 below had never once fired. Presence on disk
   * cannot be the definition of "this component exists".
   *
   * `PRO_NAMES` is read off the committed index and ships with the build, so it
   * answers correctly everywhere. The disk is still consulted first, and still
   * widens the answer: a checkout that HAS the pro tier can serve a component
   * that has not been listed in the index yet, which is how it behaved before
   * and how a pre-launch install has to keep working.
   */
  const listed = PRO_NAMES.includes(name);
  if (body === null && !listed) {
    // Not free (or it would have been served statically) and not pro. Gone.
    return new Response("Not found", { status: 404 });
  }

  const plan = await planForApiKey(bearer(req));
  // Entitlement, not truthiness. `planForApiKey` answers "which plan?", and
  // every paid plan used to pass this line — so the cheapest subscription on
  // the pricing page installed the components sold beside it. Which plans carry
  // them is a product decision, and it lives in the plan table.
  if (!plan || !PLANS[plan].components) {
    /**
     * 402, not 403. The shadcn CLI prints the body, so this string is the whole
     * upsell — read in a terminal by someone who has already decided they want
     * this component, which is the best moment this product ever gets.
     *
     * It names the price and the deadline, and links straight to the plans.
     * It used to name neither, on the grounds that a string printed into a
     * terminal cannot be edited afterwards and the price moves on a date — and
     * 48 people a day read it without one of them reaching the pricing page.
     * The string is built per request from `CATALOGUE_PRICE`, and it carries
     * its own date, so an old copy in someone's scrollback dates itself.
     *
     * `?ref=cli` is read by `NewsletterForm` in preference to its own default,
     * so an address won here is attributable to a failed install rather than to
     * somebody scrolling the landing page. The extra fields are for agents,
     * which read the body rather than the CLI's one-line rendering of it.
     */
    const page = ITEM_BY_SLUG.get(name)?.href ?? "/docs/pricing";
    return Response.json(
      {
        error: "pro_component",
        component: name,
        message: `@snapcn/${name} is a Pro component. Every Pro component, the MCP server and ${CATALOGUE_PROMISE.templates} templates: ${CATALOGUE_PRICE.annual}/yr or ${CATALOGUE_PRICE.lifetime} once${
          earlyBirdDaysLeft() > 0
            ? `, early-bird until ${EARLY_BIRD.endsOnShort}`
            : ""
        }.${septemberBonusActive() ? ` Buy by ${SEPTEMBER_BONUS.endsOnShort} and the Commercial licence is free.` : ""} Buy: https://snapcn.dev/docs/pricing?ref=cli#plans · Watch it: https://snapcn.dev${page}?ref=cli`,
        page: `https://snapcn.dev${page}?ref=cli`,
        pricing: "https://snapcn.dev/docs/pricing?ref=cli#plans",
        keys: "https://snapcn.dev/account",
        free: `${GALLERY_COUNT} components are free and install without a key: https://snapcn.dev/docs/components`,
      },
      { status: 402 },
    );
  }

  /**
   * Entitled, and the file is not on this server.
   *
   * Only reachable when the pro tier was not present at build time — see the
   * note on `listed`. It is a deployment fault, not a customer one, so it says
   * so rather than 404ing at somebody who has paid: a 404 here would send a
   * buyer to look for a name that is perfectly correct.
   */
  if (body === null) {
    return Response.json(
      {
        error: "pro_component_unavailable",
        component: name,
        message: `@snapcn/${name} exists and your key is valid, but this deployment was built without the Pro tier. This is our fault — mail hello@snapcn.dev.`,
      },
      { status: 503 },
    );
  }

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json",
      // Never shared, never edge-cached: the response depends on a key.
      "cache-control": "private, no-store",
    },
  });
}
