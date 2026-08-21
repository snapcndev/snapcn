import { after, type NextRequest, NextResponse } from "next/server";
import { INSTALL_ALL_NAMES } from "@/config/site";
import {
  anonymousId,
  captureServer,
  classifyClient,
  distinctIdFromCookie,
} from "@/lib/analytics-server";

/**
 * Every component that actually exists, from the same manifests the registry is
 * built from — so a name can never be live here and missing there.
 *
 * Middleware runs *before* the static file is served and only ever sees the
 * request, so a fetch of a component we do not have is indistinguishable from a
 * real install unless we check the name ourselves. Both manifests together are
 * ~17KB, which is nothing against the Edge bundle limit.
 */
const KNOWN_COMPONENTS = new Set(INSTALL_ALL_NAMES);

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
 * The matcher is three paths. Middleware does not run on the landing page, the
 * docs, `/_next/*`, or any other request, so this adds nothing to the site's
 * latency. On the paths it does match, `after()` runs the capture once the
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

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

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

    if (pathname === "/llms.txt" || pathname === "/llms-full.txt") {
      await captureServer("llms_txt_fetched", distinctId, {
        ...shared,
        file: pathname.slice(1),
      });
      return;
    }

    const component = componentFromPath(pathname);
    if (component) {
      await captureServer(
        KNOWN_COMPONENTS.has(component)
          ? "registry_component_fetched"
          : "registry_component_missing",
        distinctId,
        { ...shared, component },
      );
    }
  });

  return response;
}

export const config = {
  matcher: ["/r/:path*", "/llms.txt", "/llms-full.txt"],
};
