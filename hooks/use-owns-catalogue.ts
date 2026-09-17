"use client";

import { useSession } from "next-auth/react";
import { PLANS } from "@/lib/plans";

/**
 * Whether the signed-in reader's plan installs the Pro components — so a paid
 * customer is shown their install, not the paywall they already paid past.
 *
 * Client-side because the surfaces that sell Pro are static: the gallery and
 * the Pro docs pages are built once for everybody, so the server cannot know
 * who is looking. `session.user.plan` is resolved by `planFor` on every session
 * read (`auth.ts`), so it follows a purchase or a lapse without a deploy.
 *
 * `null` while the session is still loading: a caller hides the Pro call to
 * action until then, so a paying reader never sees it flash.
 */
export function useOwnsCatalogue(): boolean | null {
  const { data, status } = useSession();
  if (status === "loading") return null;
  const plan = data?.user?.plan;
  return Boolean(plan && PLANS[plan]?.components);
}
