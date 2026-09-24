import { auth } from "@/auth";
import { PLANS, type PlanName } from "@/lib/plans";
import { bearer, planForApiKey } from "@/lib/server/api-key";
import { readProElement } from "@/lib/server/pro-registry";
import PRO_ELEMENTS from "@/lib/studio-elements-pro.json";

/**
 * "Add to Remotion Studio" for a paid component.
 *
 * A free Element is a static file, `public/elements/<name>.json`, and Next
 * serves it before it looks at this route — the same split as `/r/`. A paid
 * one cannot be a static file: the payload *is* the component's source. So it
 * is built into `registry/.private/elements/` and handed out here, to the same
 * people `/r/[file]` hands the registry item to — an account whose plan carries
 * the components, or an API key that does — and to nobody else.
 *
 * The button runs in the page, so the page's session is the usual key. The
 * bearer is for everything that is not a browser.
 */

export const runtime = "nodejs";

function componentName(file: string): string | null {
  const match = file.match(/^([a-z0-9]([a-z0-9-]*[a-z0-9])?)\.json$/);
  return match?.[1] ?? null;
}

const entitled = (plan: PlanName | "anonymous" | null | undefined) =>
  Boolean(plan && plan !== "anonymous" && PLANS[plan]?.components);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  const name = componentName((await params).file);
  if (!name || !(PRO_ELEMENTS as string[]).includes(name)) {
    return new Response("Not found", { status: 404 });
  }

  const session = await auth().catch(() => null);
  const plan = session?.user?.plan ?? (await planForApiKey(bearer(req)));
  if (!entitled(plan)) {
    const signedIn = Boolean(session?.user);
    return Response.json(
      {
        error: signedIn ? "pro_component" : "sign_in",
        message: signedIn
          ? "This Element comes with the Pro catalogue."
          : "Sign in with the account that has the Pro catalogue.",
        url: signedIn
          ? "https://snapcn.dev/docs/pricing#plans"
          : "https://snapcn.dev/account",
      },
      {
        status: signedIn ? 402 : 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const body = await readProElement(name);
  if (body === null) {
    // Entitled, but this server was deployed without the pro volume.
    return Response.json(
      {
        error: "unavailable",
        message: "This Element is not on this server yet.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // Somebody's paid source: never in a shared cache.
      "Cache-Control": "private, no-store",
    },
  });
}
