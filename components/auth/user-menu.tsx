"use client";

import {
  Clapperboard,
  Film,
  LogOut,
  Plus,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import Link from "next/link";
import { getProviders, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SignInButtons } from "@/components/showcase/sign-in-buttons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { identifyUser, resetUser, useTrackEvent } from "@/lib/analytics";
import { type AuthProviderId, EMAIL_PROVIDER_ID } from "@/lib/auth-providers";
import type { PlanName } from "@/lib/plans";
import { startCheckout } from "@/lib/upgrade";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/lib/video-editor/project";

/**
 * What each plan is called in the one place a person goes to ask.
 *
 * Named by what it *does*, not by a quota. The export counts are fair-use
 * ceilings nobody will meet, and putting one here would advertise a limit
 * instead of a capability — the opposite of what this row is for.
 */
const PLAN_LABEL: Record<PlanName, string> = {
  free: "Free — 720p, watermarked",
  starter: "Starter — 1080p, no watermark",
  pro: "Pro — 1080p, no watermark",
};

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
    <AccountMenu user={user} plan={plan} className={className} />
  ) : (
    <SignInDialog className={className} />
  );
}

function SignInDialog({ className }: { className?: string }) {
  const [providers, setProviders] = useState<{
    oauth: AuthProviderId[];
    email: boolean;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const trackEvent = useTrackEvent();

  // Fetched on first open, not on mount: most visitors never open this, and the
  // list cannot change while the page is up.
  useEffect(() => {
    if (!open || providers) return;
    let cancelled = false;
    void getProviders().then((map) => {
      if (cancelled) return;
      const ids = Object.keys(map ?? {});
      setProviders({
        oauth: ids.filter(
          (id): id is AuthProviderId => id !== EMAIL_PROVIDER_ID,
        ),
        email: ids.includes(EMAIL_PROVIDER_ID),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open, providers]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) trackEvent("sign_in_opened", { surface: "header" });
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className={className}>
            Sign in
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign in to snapcn</DialogTitle>
          <DialogDescription>
            Removes the watermark from video-editor exports and lets you post to
            the showcase. Nothing else changes — the components stay MIT and a
            local render is never marked.
          </DialogDescription>
        </DialogHeader>

        {providers === null ? (
          <div className="h-24 animate-pulse rounded-lg bg-muted" />
        ) : (
          <SignInButtons
            providers={providers.oauth}
            emailEnabled={providers.email}
            callbackUrl="/"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Enough of the list to be useful without turning the menu into a page. */
const RECENT_VIDEOS = 5;

function AccountMenu({
  user,
  plan,
  className,
}: {
  plan: PlanName;
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    isAdmin?: boolean;
  };
  className?: string;
}) {
  const trackEvent = useTrackEvent();
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  async function upgrade() {
    // Guarded: this is a button someone will click twice, and two checkout
    // sessions is two chances to pay for the same month.
    if (starting) return;
    setStarting(true);
    trackEvent("upgrade_started", { from: "account_menu" });
    try {
      await startCheckout("starter");
      // `startCheckout` navigates away, so the spinner is cleared by the
      // teardown rather than by us.
    } catch (err) {
      setStarting(false);
      toast.error(
        err instanceof Error ? err.message : "Couldn't start checkout.",
      );
    }
  }
  // `null` while unknown, `false` once we know there is nothing to show — a
  // deployment with no database answers 503 here, and a section that cannot
  // work should be absent rather than empty.
  const [videos, setVideos] = useState<ProjectSummary[] | null>(null);
  const [videosAvailable, setVideosAvailable] = useState(true);

  // Same stitch the showcase header makes, for the same reason: `identifyUser`
  // is idempotent and returns true only on the anonymous→known transition, so
  // this can run on every render and still fire `signed_in` exactly once.
  useEffect(() => {
    if (!user.id) return;
    const promoted = identifyUser(user.id, {
      email: user.email ?? undefined,
      name: user.name ?? undefined,
    });
    if (promoted) trackEvent("signed_in");
  }, [user.id, user.email, user.name, trackEvent]);

  // Fetched on first open, like the provider list: this menu is mounted on
  // every page including the statically rendered landing page, and most views
  // of it are never opened.
  useEffect(() => {
    if (!open || videos) return;
    let cancelled = false;
    void fetch("/api/projects")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body: { projects: ProjectSummary[] }) => {
        if (!cancelled) setVideos(body.projects);
      })
      .catch(() => {
        if (!cancelled) setVideosAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, videos]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        aria-label="Account"
        className={cn(
          "grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground transition-colors hover:text-foreground",
          className,
        )}
      >
        <Avatar user={user} size={32} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-muted text-muted-foreground">
            <Avatar user={user} size={36} />
          </span>
          <span className="min-w-0">
            {user.name && (
              <span className="block truncate text-sm font-medium text-foreground">
                {user.name}
              </span>
            )}
            {user.email && (
              <span className="block truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            )}
          </span>
        </div>

        {/* What this account currently is. It used to read "Watermark-free
            exports" for everybody, which was true when signing in was the only
            tier and became a lie the moment one cost money — a menu that
            overstates the plan is how someone discovers their real plan at the
            worst possible moment, halfway through an export. */}
        <div className="flex items-center gap-2 px-3 pb-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
            <Film className="size-3" />
            {PLAN_LABEL[plan]}
          </span>
          {plan === "free" && (
            <button
              type="button"
              onClick={upgrade}
              disabled={starting}
              className="cursor-pointer text-[0.6875rem] font-medium text-primary underline-offset-2 hover:underline disabled:cursor-wait disabled:opacity-60"
            >
              {starting ? "Opening…" : "Upgrade"}
            </button>
          )}
        </div>

        <DropdownMenuSeparator />

        {videosAvailable && (
          <>
            <DropdownMenuGroup className="max-h-64 overflow-y-auto">
              <DropdownMenuLabel>Your videos</DropdownMenuLabel>

              {videos === null ? (
                <div className="space-y-1 px-3 pb-1">
                  <div className="h-4 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                </div>
              ) : videos.length === 0 ? (
                <p className="px-3 pb-2 text-xs text-muted-foreground">
                  Nothing saved yet — the editor keeps a video as soon as it has
                  a clip.
                </p>
              ) : (
                videos.slice(0, RECENT_VIDEOS).map((video) => (
                  <DropdownMenuItem
                    key={video.id}
                    render={
                      <Link href={`/docs/video-editor?project=${video.id}`} />
                    }
                  >
                    <Clapperboard className="size-4" />
                    <span className="min-w-0 flex-1 truncate">
                      {video.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {video.clipCount}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuGroup>

            <DropdownMenuItem
              render={<Link href="/docs/video-editor?project=new" />}
            >
              <Plus className="size-4" />
              New video
            </DropdownMenuItem>

            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href="/docs/showcase" />}>
            <Film className="size-4" />
            Showcase
          </DropdownMenuItem>

          {/* Only rendered for an admin, and the page checks again on the
              server — this is discovery, not the permission. */}
          {user.isAdmin && (
            <DropdownMenuItem render={<Link href="/docs/showcase/admin" />}>
              <ShieldCheck className="size-4" />
              Review submissions
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            // `redirectTo` explicitly: without it the browser lands back on
            // whatever page it was on, which for a statically rendered route is
            // served from cache still showing the signed-in header.
            void signOut({ redirectTo: "/" });
            // After, and guarded. A shared machine must not merge the next
            // person's events onto this identity — but a tracker that throws
            // must not be able to swallow the sign-out either, which is exactly
            // what running it first did.
            try {
              resetUser();
            } catch {
              // no-op: an uninitialised tracker is not a sign-out failure.
            }
          }}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Avatar({
  user,
  size,
}: {
  user: { image?: string | null };
  size: number;
}) {
  if (!user.image) return <UserIcon className="size-4" />;
  return (
    // biome-ignore lint/performance/noImgElement: a 32px third-party avatar gains nothing from the optimiser, and next/image would need every provider's CDN in next.config.
    <img
      src={user.image}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      className="size-full object-cover"
    />
  );
}
