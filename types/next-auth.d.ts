import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * Expose the database user id — and whether this account is an admin — on
   * the session (both set in `auth.ts` callbacks).
   */
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }
}
