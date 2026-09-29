"use client";

import { useSession } from "next-auth/react";
import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTrackEvent } from "@/lib/analytics";
import type { PlanName } from "@/lib/plans";
import { cn } from "@/lib/utils";

/**
 * Sign in / account control for the site header.
 *
 * Session comes from `useSession`, not from `auth()` in a server component, on
 * purpose: the landing page is statically rendered with a one-hour revalidate,
 * and reading the session upstream of it would turn every view of the busiest
 * page on the site into a function invocation. The cost of doing it here is one
 * `/api/auth/session` request after hydration, and a placeholder while it
 * resolves.
 *
 * The provider list is fetched with `getProviders()` when the dialog opens
 * rather than passed down, so nothing has to thread server-only env state
 * through the header — and an unconfigured deployment simply shows the
 * "not configured yet" copy `SignInButtons` already owns.
 */
export function UserMenu({ className }: { className?: string }) {
  const { data: session } = useSession();
  const user = session?.user;
  // `free` when the session predates the plan field — an old cookie must read
  // as the cheaper tier, never the more expensive one.
  const plan: PlanName = user?.plan ?? "free";

  // While the session is unknown, show the *button*, not a placeholder.
  //
  // A placeholder here is a trap: `useSession` sits in `loading` for as long as
  // `/api/auth/session` takes, and forever if it errors — so a hiccup in one
  // endpoint silently removes the only entry point to signing in, with no sign
  // that anything is wrong. Rendering the button by default costs a signed-in
  // reader one frame of the wrong label; hiding it costs everyone else the
  // feature. It also puts "Sign in" in the server-rendered HTML, which is what
  // makes this verifiable without a browser.
  return user ? (
    <Suspense fallback={<AvatarSlot className={className} />}>
      <AccountMenu user={user} plan={plan} className={className} />
    </Suspense>
  ) : (
    <SignIn className={className} />
  );
}

/**
 * The dialog, the dropdown and floating-ui are ~30KB gzipped — on every page,
 * for everyone, and in the first batch of scripts, where Lighthouse's mobile
 * LCP counts every byte. Most visitors never open either. So the header draws
 * the plain button (and the plain avatar), and the panels load when needed:
 * on the first hover or focus of "Sign in", and for a signed-in reader, once
 * the session says so.
 */
const loadPanels = () => import("./user-menu-panels");
const SignInDialog = lazy(() =>
  loadPanels().then((m) => ({ default: m.SignInDialog })),
);
const AccountMenu = lazy(() =>
  loadPanels().then((m) => ({ default: m.AccountMenu })),
);

function SignIn({ className }: { className?: string }) {
  const [asked, setAsked] = useState(false);
  const trackEvent = useTrackEvent();
  const button = (onClick?: () => void) => (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onPointerEnter={() => void loadPanels()}
      onFocus={() => void loadPanels()}
      onClick={onClick}
    >
      Sign in
    </Button>
  );
  if (!asked) {
    return button(() => {
      setAsked(true);
      trackEvent("sign_in_opened", { surface: "header" });
    });
  }
  return (
    <Suspense fallback={button()}>
      <SignInDialog className={className} defaultOpen />
    </Suspense>
  );
}

/** The account button's circle, while its menu loads. */
function AvatarSlot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-8 shrink-0 rounded-full border border-border bg-muted",
        className,
      )}
    />
  );
}
