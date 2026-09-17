import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { subscribers } from "@/lib/db/schema";
import { getDb, isDbConfigured } from "@/lib/server/db";
import { TOKEN_RE } from "@/lib/server/subscription";

/**
 * The install link for the free pro component, as `<subscriber id>.<signature>`.
 *
 * Not the subscriber's `token`: that one unsubscribes, and this link is pasted
 * into terminals, READMEs and chat. A signed id can install one component and
 * do nothing else, so a link that leaks costs one free component.
 *
 * Signed with `AUTH_SECRET`, which every deployment already has for sessions;
 * without it there is no link rather than an unsigned one.
 */
const SECRET = process.env.AUTH_SECRET;
const SITE =
  process.env.EMAIL_SITE_URL?.trim().replace(/\/+$/, "") ||
  "https://snapcn.dev";

function signature(id: string): string {
  return createHmac("sha256", SECRET ?? "")
    .update(`pro-sample:${id}`)
    .digest("base64url")
    .slice(0, 32);
}

/** `npx shadcn@latest add <this>` installs the sample. Null without a secret. */
export function sampleInstallUrl(subscriberId: string): string | null {
  if (!SECRET) return null;
  return `${SITE}/api/pro-sample/${subscriberId}.${signature(subscriberId)}`;
}

/**
 * The subscriber a sample link belongs to, if the link is genuine and the
 * address is still confirmed and subscribed. Unsubscribing ends the sample link
 * too: it was the price of the address, and the address was withdrawn.
 */
export async function subscriberForSampleToken(
  token: string,
): Promise<string | null> {
  if (!SECRET || !isDbConfigured) return null;
  const [id, sig] = token.split(".");
  if (!id || !sig || !TOKEN_RE.test(id)) return null;
  const expected = Buffer.from(signature(id));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  const [row] = await getDb()
    .select({ id: subscribers.id })
    .from(subscribers)
    .where(
      and(
        eq(subscribers.id, id),
        isNotNull(subscribers.confirmedAt),
        isNull(subscribers.unsubscribedAt),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}
