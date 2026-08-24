import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { auth, getConfiguredProviders, isEmailSignInConfigured } from "@/auth";
import { SignInButtons } from "@/components/showcase/sign-in-buttons";
import { SnapCnLogo } from "@/components/snapcn-logo";

const TITLE = "Sign in";

export const metadata: Metadata = {
  title: TITLE,
  description: "Sign in to snapcn.",
  // A sign-in URL has nothing to offer a search engine and everything to lose
  // by being indexed with a `callbackUrl` in the query string.
  robots: { index: false, follow: false },
};

/**
 * Auth.js error codes, in the reader's language.
 *
 * The defaults are written for whoever configured the app, not for whoever is
 * trying to get in — "There is a problem with the server configuration" tells a
 * visitor nothing they can act on. Each of these ends with the next move.
 */
const ERROR_COPY: Record<string, string> = {
  Configuration:
    "Sign-in isn't set up correctly on this deployment. That's on us, not you — try again shortly.",
  AccessDenied:
    "That account can't sign in. If you're using Google, the app is still in testing and only approved addresses are allowed.",
  Verification:
    "That link has expired or was already used. Sign-in links work once — request a fresh one below.",
  OAuthAccountNotLinked:
    "That email is already on an account created with a different provider. Use the same one you signed up with, or the email option below.",
  OAuthSignin:
    "Couldn't reach that provider. Try again, or use another option.",
  OAuthCallback:
    "That provider didn't complete the sign-in. Try again, or use another option.",
  Default: "Something went wrong signing you in. Try again below.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    callbackUrl?: string;
    check?: string;
  }>;
}) {
  const { error, callbackUrl, check } = await searchParams;
  const session = await auth().catch(() => null);
  const providers = getConfiguredProviders();
  const emailEnabled = isEmailSignInConfigured();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <Link href="/" aria-label="snapcn home" className="mb-8">
        <SnapCnLogo className="h-8" />
      </Link>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm">
        {check ? (
          // `verifyRequest` lands here after a link is sent. It is its own state
          // rather than a toast because the next step happens in another app —
          // the last thing on screen has to be the instruction to go and look.
          <div className="text-center">
            <MailCheck className="mx-auto size-8 text-primary" />
            <h1 className="mt-4 text-lg font-semibold text-foreground">
              Check your inbox
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent you a sign-in link. It expires in 24 hours and works once.
            </p>
          </div>
        ) : session?.user ? (
          <div className="text-center">
            <h1 className="text-lg font-semibold text-foreground">
              You're already signed in
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              as {session.user.email ?? session.user.name}.
            </p>
            <Link
              href={callbackUrl ?? "/"}
              className="mt-4 inline-block text-sm text-primary underline underline-offset-4"
            >
              Continue
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-foreground">
              Sign in to snapcn
            </h1>
            <p className="mt-1.5 mb-5 text-sm text-muted-foreground">
              Removes the watermark from video-editor exports and lets you post
              to the showcase. The components stay MIT either way, and a local
              render is never marked.
            </p>

            {error && (
              <p
                role="alert"
                className="mb-4 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-sm text-destructive"
              >
                {ERROR_COPY[error] ?? ERROR_COPY.Default}
              </p>
            )}

            <SignInButtons
              providers={providers}
              emailEnabled={emailEnabled}
              callbackUrl={callbackUrl ?? "/"}
            />
          </>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        No password to forget. We only ever store your email and display name.
      </p>
    </main>
  );
}
