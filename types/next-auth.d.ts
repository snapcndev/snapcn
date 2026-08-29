import type { DefaultSession } from "next-auth";
import type { PlanName } from "@/lib/plans";

declare module "next-auth" {
  /**
   * Expose the database user id, whether this account is an admin, and the
   * billing plan on the session (all set in `auth.ts` callbacks).
   */
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
      plan: PlanName;
    } & DefaultSession["user"];
  }
}
