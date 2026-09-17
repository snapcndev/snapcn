import type { DefaultSession } from "next-auth";
import type { PlanName } from "@/lib/plans";

declare module "next-auth" {
  /**
   * Expose the database user id and the billing plan on the session (both set
   * in `auth.ts` callbacks).
   */
  interface Session {
    user: {
      id: string;
      plan: PlanName;
    } & DefaultSession["user"];
  }
}
