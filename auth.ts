import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Facebook from "next-auth/providers/facebook";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import Twitter from "next-auth/providers/twitter";
import type { AuthProviderId } from "@/lib/auth-providers";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";
import { getDb, isDbConfigured } from "@/lib/server/db";
import {
  magicLinkEmail,
  sendEmail,
  welcomeUserEmail,
} from "@/lib/server/email";

const PROVIDER_ENV: Record<AuthProviderId, [idKey: string, secretKey: string]> =
  {
    google: ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"],
    github: ["AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"],
    twitter: ["AUTH_TWITTER_ID", "AUTH_TWITTER_SECRET"],
    facebook: ["AUTH_FACEBOOK_ID", "AUTH_FACEBOOK_SECRET"],
  };

/**
 * Which OAuth providers actually have credentials set. Drives both the
 * registered providers below and the sign-in UI, so the app builds and boots
 * with zero OAuth setup (the sign-in menu simply shows nothing).
 */
export function getConfiguredProviders(): AuthProviderId[] {
  return (Object.keys(PROVIDER_ENV) as AuthProviderId[]).filter((id) => {
    const [idKey, secretKey] = PROVIDER_ENV[id];
    return Boolean(process.env[idKey] && process.env[secretKey]);
  });
}

/**
 * Email sign-in needs no OAuth app — just the Resend key the welcome mail
 * already uses, and the `verificationToken` table the adapter already created.
 * It is the one login that works on a fresh deployment with a single env var.
 */
export function isEmailSignInConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * The comma-separated allow-list in `ADMIN_EMAILS`, normalised.
 *
 * Exported because nothing in the repo could *enumerate* admins — only ask
 * whether a given address was one — and a submission notification needs the
 * list. Empty when unset, which means no mail is sent rather than a crash.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Comma-separated allow-list of admin emails (`ADMIN_EMAILS`). */
export function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

/**
 * One provider, configured.
 *
 * A switch rather than a lookup table with an options object spread over it:
 * the factories have incompatible call signatures, so an indexed call does not
 * typecheck — and this way the one fact that matters is visible per line.
 *
 * `allowDangerousEmailAccountLinking` merges a new provider onto an existing
 * account with the same address. It is "dangerous" because linking on a merely
 * *claimed* address lets anyone who can put your email on their account walk
 * into yours. Google and GitHub both prove it first: Google issues an
 * `email_verified` claim (re-checked in the `signIn` callback, since the
 * linking code does not enforce it), and Auth.js's GitHub provider reads
 * `/user/emails` and takes the address marked primary *and* verified.
 *
 * Twitter and Facebook are left unlinked deliberately — Twitter often returns
 * no email at all, and neither gives a verification signal we can check.
 * Without linking, signing up with Google and later clicking GitHub with the
 * same address dead-ends on `OAuthAccountNotLinked`, which asks people to
 * remember which button they pressed months ago.
 */
function providerFor(id: AuthProviderId) {
  const linkVerified = { allowDangerousEmailAccountLinking: true };
  switch (id) {
    case "google":
      return Google(linkVerified);
    case "github":
      return GitHub(linkVerified);
    case "twitter":
      return Twitter;
    case "facebook":
      return Facebook;
  }
}

function providers() {
  // Each provider auto-reads its `AUTH_<NAME>_ID/_SECRET` env pair.
  const configured: NextAuthConfig["providers"] =
    getConfiguredProviders().map(providerFor);

  // `apiKey`/`from` passed explicitly rather than left to Auth.js's own
  // `AUTH_RESEND_KEY`/`AUTH_EMAIL_FROM` lookup, so one `RESEND_API_KEY` and one
  // `EMAIL_FROM` drive both the magic link and the welcome mail. Two env vars
  // for the same sender is how they drift.
  if (isEmailSignInConfigured()) {
    configured.push(
      Resend({
        apiKey: process.env.RESEND_API_KEY,
        from: process.env.EMAIL_FROM ?? "snapcn <hello@snapcn.dev>",
        // Auth.js's built-in link email is unbranded and reads like phishing.
        // A sign-in link is the most security-sensitive mail we send, so it is
        // the one that most has to look unmistakably like us. Throwing on
        // failure is deliberate here — unlike the welcome mails, if this does
        // not go out the user is left waiting for a link that never arrives,
        // and Auth.js surfaces the failure instead of pretending it worked.
        async sendVerificationRequest({ identifier, url }) {
          const ok = await sendEmail(magicLinkEmail(identifier, url));
          if (!ok) throw new Error("Failed to send the sign-in link");
        },
      }),
    );
  }

  return configured;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Without a DB the adapter is omitted so construction can't throw pre-setup;
  // sign-in is also unavailable then (no providers), which is the intended
  // "not configured yet" state.
  adapter: isDbConfigured
    ? DrizzleAdapter(getDb(), {
        usersTable: users,
        accountsTable: accounts,
        sessionsTable: sessions,
        verificationTokensTable: verificationTokens,
      })
    : undefined,
  providers: providers(),
  // Our own pages instead of the ones Auth.js renders. Without this, every
  // failure redirects to an unstyled `/api/auth/error` that looks nothing like
  // the site — which for a sign-in flow reads as "this is broken" at best and
  // "this is not really snapcn" at worst.
  pages: {
    signIn: "/signin",
    error: "/signin",
    verifyRequest: "/signin?check=1",
  },

  // `createUser` fires once, the first time a row is written for an account —
  // so this is a welcome, not a "you signed in again". Auth.js awaits event
  // handlers, so it must not throw: `sendEmail` already swallows its own
  // failures, and the guard here covers a user record with no address (some
  // providers return none).
  events: {
    async createUser({ user }) {
      if (!user.email) return;
      await sendEmail(welcomeUserEmail(user.email, user.name));
    },
  },
  callbacks: {
    /**
     * The enforcement half of the linking decision above.
     *
     * `allowDangerousEmailAccountLinking` merges on a matching address and does
     * not itself look at whether the provider verified it, so Google's
     * `email_verified` claim is checked here. A Google account created against
     * an address the owner never confirmed must not be able to claim an
     * existing snapcn account.
     *
     * GitHub needs no check: its provider only ever returns an address that is
     * both primary and verified on the account.
     */
    signIn({ account, profile }) {
      if (account?.provider === "google")
        return profile?.email_verified === true;
      return true;
    },
    session({ session, user }) {
      // Database-session strategy: expose the user id to server code.
      if (session.user && user) {
        session.user.id = user.id;
        // And whether they are an admin, which until now only the server could
        // ask — so the review queue was a URL you had to know. It is derived
        // from `ADMIN_EMAILS` on every session read, never stored, so removing
        // an address from the list revokes it on the next request.
        session.user.isAdmin = isAdmin(user.email);
      }
      return session;
    },
  },
});
