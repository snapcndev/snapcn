import { readFile } from "node:fs/promises";
import path from "node:path";
import { bearer, planForApiKey } from "@/lib/server/api-key";

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

/** Where `split-pro` parks the paid items. Outside `public/`, deliberately. */
const PRIVATE_DIR = path.join(process.cwd(), "registry", ".private");

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

  let body: string;
  try {
    body = await readFile(path.join(PRIVATE_DIR, `${name}.json`), "utf8");
  } catch {
    // Not free (or it would have been served statically) and not pro. Gone.
    return new Response("Not found", { status: 404 });
  }

  const plan = await planForApiKey(bearer(req));
  if (!plan) {
    /**
     * 402, not 403. The shadcn CLI prints the body, so this string is the whole
     * upsell — it is read in a terminal by someone who has already decided they
     * want this component, which is the best moment this product ever gets.
     */
    return Response.json(
      {
        error: "pro_component",
        component: name,
        message: `@snapcn/${name} is a Pro component. Get a key at https://snapcn.dev/pricing, then set SNAPCN_API_KEY.`,
      },
      { status: 402 },
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
