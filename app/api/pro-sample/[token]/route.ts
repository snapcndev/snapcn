import { after } from "next/server";
import { captureServer } from "@/lib/analytics-server";
import { PRO_SAMPLE } from "@/lib/plans";
import { readProItem } from "@/lib/server/pro-registry";
import { subscriberForSampleToken } from "@/lib/server/pro-sample";

export const runtime = "nodejs";

/**
 * `npx shadcn@latest add https://snapcn.dev/api/pro-sample/<id>.<sig>` — the
 * free pro component, for a confirmed subscriber.
 *
 * A URL rather than `@snapcn/<name>`, because the registry namespace answers by
 * name and this answers by person. The CLI fetches any URL that returns a
 * registry item, so nothing has to be configured to use it.
 *
 * Errors are JSON with a `message`, because that is the field the shadcn CLI
 * prints — the same reason the 402 in `app/r/[file]` is shaped the way it is.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const subscriber = await subscriberForSampleToken((await params).token);
  if (!subscriber) {
    return Response.json(
      {
        error: "sample_link_invalid",
        message:
          "This free-component link is not valid, or its address unsubscribed or never confirmed. Get a fresh one at https://snapcn.dev/docs/pricing#free",
      },
      { status: 403 },
    );
  }

  const body = await readProItem(PRO_SAMPLE.name);
  if (!body) {
    return Response.json(
      {
        error: "sample_unavailable",
        message:
          "The free component is not on this server right now. This is our fault — mail hello@snapcn.dev.",
      },
      { status: 503 },
    );
  }

  after(() =>
    captureServer("registry_pro_sample_fetched", `subscriber_${subscriber}`, {
      component: PRO_SAMPLE.name,
    }),
  );

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "private, no-store",
    },
  });
}
