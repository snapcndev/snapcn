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
     * The upsell — read in a terminal by someone who has already decided they
     * want this component, which is the best moment this product ever gets.
     *
     * It names the price and the deadline, and links straight to the plans.
     * It used to name neither, on the grounds that a string printed into a
     * terminal cannot be edited afterwards and the price moves on a date. The
     * string is built per request from `CATALOGUE_PRICE`, and it carries its
     * own date, so an old copy in someone's scrollback dates itself.
     *
     * `?ref=cli` is read by `NewsletterForm` in preference to its own default,
     * so an address won here is attributable to a failed install rather than to
     * somebody scrolling the landing page.
     */
    const page = `https://snapcn.dev${ITEM_BY_SLUG.get(name)?.href ?? "/docs/pricing"}?ref=cli`;
    const pricing = "https://snapcn.dev/docs/pricing?ref=cli#plans";
    const offer = `Every Pro component, the MCP server and ${CATALOGUE_PROMISE.templates} templates: ${CATALOGUE_PRICE.annual}/yr or ${CATALOGUE_PRICE.lifetime} once${
      earlyBirdDaysLeft() > 0
        ? `, early-bird until ${EARLY_BIRD.endsOnShort}`
        : ""
    }.${septemberBonusActive() ? ` Buy by ${SEPTEMBER_BONUS.endsOnShort} and the Commercial licence is free.` : ""}`;

    /**
     * The shadcn CLI never prints an error body. Every non-2xx renders as
     * "Failed to fetch from registry (402) … Check your request parameters"
     * (shadcn 4.21.0 files the body under `responseBody` and prints only its
     * own string), so for its whole life this upsell read as a broken registry:
     * ~120 CLI users a month hit it and one reached the site.
     *
     * The one thing the CLI does print is a registry item's `docs`, after a
     * successful install. So the CLI gets a 200 — an item with no files whose
     * `docs` is the upsell. Nothing lands in their project, and a free
     * component named in the same `add` now installs instead of failing with it.
     *
     * Only the CLI, which sends `User-Agent: shadcn`. Everything else keeps the
     * 402: the MCP server reads that status as "this key was refused", and
     * agents read the JSON body below.
     */
    if (/^shadcn\b/i.test(req.headers.get("user-agent") ?? "")) {
      return Response.json(
        {
          name,
          type: "registry:component",
          files: [],
          docs: [
            `@snapcn/${name} is a Pro component — nothing was installed.`,
            offer,
            `Buy:         ${pricing}`,
            `Watch it:    ${page}`,
            `Have a key?  https://snapcn.dev/account`,
          ].join("\n"),
        },
        // Depends on the key, so never shared or edge-cached.
        { headers: { "cache-control": "private, no-store" } },
      );
    }

    return Response.json(
      {
        error: "pro_component",
        component: name,
        message: `@snapcn/${name} is a Pro component. ${offer} Buy: ${pricing} · Watch it: ${page}`,
        page,
        pricing,
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
