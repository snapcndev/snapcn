import { after, type NextRequest, NextResponse } from "next/server";
import {
  ALL_COMPONENT_NAMES,
  INSTALL_ALL_NAMES,
  PRO_NAMES,
} from "@/config/site";
import {
  anonymousId,
  captureServer,
  classifyClient,
  distinctIdFromCookie,
} from "@/lib/analytics-server";
import { MEDIA_BASE } from "@/lib/demo-urls";
import { suggestComponents } from "@/lib/registry-suggest";

/**
 * Every component that actually exists, from the same manifests the registry is
 * built from — so a name can never be live here and missing there.
 *
 * Middleware runs *before* the static file is served and only ever sees the
 * request, so a fetch of a component we do not have is indistinguishable from a
 * real install unless we check the name ourselves. Both manifests together are
 * ~17KB, which is nothing against the Edge bundle limit.
 */
const KNOWN_COMPONENTS = new Set(ALL_COMPONENT_NAMES);

/**
 * The paid half of the above. Needed here and not just in the route because the
 * route cannot report: middleware fires on the way IN, so it is the only place
 * that sees every registry request, and it has to tell an install apart from a
 * paywall hit before either has a status code.
 */
const PRO_COMPONENTS = new Set(PRO_NAMES);

/**
 * Tracks the two things that happen *outside the browser*, and are therefore
 * invisible to every client-side analytics tool.
 *
 * ## Why this file exists
 *
 * snapcn's product is not the website. The website is a brochure; the product
 * ships when someone runs
 *
 *     npx shadcn@latest add @snapcn/orbit-gallery
 *
 * which the CLI resolves through the shadcn registry directory into a plain GET
 * to `/r/orbit-gallery.json` from a terminal — so the namespace form is counted
 * exactly like the URL form it replaced. No JS, no
 * cookie, no pageview. Before this file, the closest thing we had to a
 * conversion metric was `install_command_copied` — "someone put a string on
 * their clipboard" — and the gap between that and an actual install was
 * unmeasured. Copy-to-install is the single most important ratio in this repo
 * and it needed a server to observe it.
 *
 * The second thing is `/llms.txt`, which is fetched almost exclusively by coding
 * agents. Pair it with the `client` property on the registry event and you can
 * read what share of installs an AI agent performed rather than a human — for a
 * shadcn registry in 2026 that is a channel, not a curiosity.
 *
 * ## Cost
 *
 * The matcher is a handful of paths (plus `/demos/*`, which only redirects).
 * Middleware does not run on the landing page, the docs, `/_next/*`, or any
 * other request, so this adds nothing to the site's latency. On the paths it does match, `after()` runs the capture once the
 * response has already been handed back, so the CLI waits on nothing either.
 */

/**
 * `/r/<name>.json` → `<name>`, or null if this is not a component fetch.
 *
 * `registry.json` is excluded deliberately: it is the whole-registry manifest
 * the shadcn CLI resolves *before* it fetches the component, so counting it
 * would put a phantom component named "registry" at the top of the install
 * chart and inflate the total by one on every real install. (Verified against a
 * running build — the CLI requests both.)
 */
function componentFromPath(pathname: string): string | null {
  const match = /^\/r\/([a-z0-9-]+)\.json$/.exec(pathname);
  if (!match || match[1] === "registry") return null;
  return match[1];
}

/**
 * The demos moved to `media.snapcn.dev` (R2 behind Cloudflare; `MEDIA_BASE` in
 * lib/demo-urls.ts). `/demos/...` still answers, with a permanent redirect to
 * the same path there, query and all, because those URLs are out in the world:
 * in Studio Elements already installed in people's projects (the
 * screen-recording default was `snapcn.dev/demos/…mp4`), in posts, in caches.
 *
 * Here and not in `next.config` redirects, for one header: Studio reads that
 * footage with a cross-origin ranged `fetch()`, and CORS is checked on every
 * hop — a redirect without `Access-Control-Allow-Origin` fails the fetch before
 * it reaches the file. Config redirects cannot carry headers.
 */
const DEMO_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range",
  "Access-Control-Expose-Headers": "Content-Range, Content-Length",
};

function demoRedirect(request: NextRequest): NextResponse {
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: DEMO_CORS });
  }
  const { pathname, search } = request.nextUrl;
  return new NextResponse(null, {
    status: 308,
    headers: { ...DEMO_CORS, Location: `${MEDIA_BASE}${pathname}${search}` },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/demos/")) return demoRedirect(request);
  const requested = componentFromPath(pathname);
  // Answer the miss here rather than letting it fall through to the HTML 404.
  // The analytics below still runs either way — `after()` is attached to
  // whichever response we return.
  const response =
    requested && !KNOWN_COMPONENTS.has(requested)
      ? unknownComponent(requested, request.nextUrl.origin)
      : NextResponse.next();

  after(async () => {
    const ua = request.headers.get("user-agent");
    const client = classifyClient(ua);

    // A browser that already booted posthog-js hands us its identity in a
    // cookie, which stitches this event onto the same person as their pageviews.
    // A CLI has no cookie and gets a pseudonymous hash instead.
    const distinctId =
      distinctIdFromCookie(request.cookies) ??
      (await anonymousId(
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown",
        ua ?? "none",
      ));

    const shared = {
      client,
      user_agent: ua ?? "",
      referrer: request.headers.get("referer") ?? "",
      $current_url: request.nextUrl.href,
    };

    // Every agent-facing surface reports as one event so the channel reads as a
    // single number: the three plain-text indexes and the `.md` form of any
    // docs page. `file` keeps them apart when the breakdown is wanted.
    if (pathname.endsWith(".txt") || pathname.endsWith(".md")) {
      await captureServer("llms_txt_fetched", distinctId, {
        ...shared,
        file: pathname.slice(1),
      });
      return;
    }

    const component = componentFromPath(pathname);
    if (component) {
      // A pro name with no key cannot become an install, whatever the route
      // decides — so it must not be counted as one. With a key it might, and
      // is left in the conversion event rather than guessed at from here.
      const paywalled =
        PRO_COMPONENTS.has(component) && !request.headers.get("authorization");

      await captureServer(
        !KNOWN_COMPONENTS.has(component)
          ? "registry_component_missing"
          : paywalled
            ? "registry_pro_blocked"
            : "registry_component_fetched",
        distinctId,
        { ...shared, component },
      );
    }
  });

  return response;
}

/**
 * What a request for a component we do not have gets back.
 *
 * It used to get the site's HTML 404 — twenty-seven kilobytes of React shell
 * sent to a terminal, saying nothing a CLI or an agent could act on. That is
 * the wrong answer to what turned out to be a common question: thirty days of
 * traffic contained **208 requests for names that do not exist**, one for every
 * eight that worked, and they arrive from the most committed person in the
 * funnel — someone who has already typed `npx shadcn add`.
 *
 * So it answers in the language it was asked in. JSON, a few hundred bytes, and
 * the two things the caller actually needs: that the name is wrong, and where
 * the real ones are. `suggestComponents` offers alternatives only when it has a
 * genuine one; most invented names get none, which is the truthful reply.
 *
 * The agents inventing these names read response bodies, and this is the only
 * place we can talk to them at the moment it matters.
 *
 * `origin` comes off the request rather than a constant so a preview deployment
 * points at itself — and so this file imports nothing that would drag `node:fs`
 * into the Edge bundle.
 */
function unknownComponent(component: string, origin: string): NextResponse {
  const suggestions = suggestComponents(component, INSTALL_ALL_NAMES);
  return NextResponse.json(
    {
      error: `\`@snapcn/${component}\` does not exist.`,
      component,
      suggestions,
      message: suggestions.length
        ? `Did you mean ${suggestions.map((s) => `@snapcn/${s}`).join(", ")}?`
        : `snapcn has no component by that name. It has ${INSTALL_ALL_NAMES.length}; do not guess another spelling.`,
      components: INSTALL_ALL_NAMES,
      docs: `${origin}/docs/components`,
      llms: `${origin}/llms.txt`,
    },
    {
      status: 404,
      headers: {
        // Wrong names are stable and get retried; let the edge absorb them.
        "cache-control": "public, max-age=300, s-maxage=3600",
      },
    },
  );
}

/**
 * `/docs/:path*.md` is matched, plain `/docs/*` is not — so the HTML docs keep
 * costing nothing and only the agent-shaped request pays for the capture.
 */
export const config = {
  matcher: [
    "/demos/:path*",
    "/r/:path*",
    "/llms.txt",
    "/llms-full.txt",
    "/llms-components.txt",
    "/docs/:path*.md",
  ],
};
