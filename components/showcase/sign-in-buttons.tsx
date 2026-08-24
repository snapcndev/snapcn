"use client";

import { Loader2, Mail } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type AuthProviderId,
  EMAIL_PROVIDER_ID,
  PROVIDER_LABELS,
} from "@/lib/auth-providers";

/**
 * The sign-in options: an email form, and one button per configured OAuth
 * provider. Both lists are computed from which credentials are actually set, so
 * this only ever renders working options.
 *
 * Email leads. It is the login that needs no OAuth app registered anywhere, so
 * on most deployments it is the one that works — and for a reader who does not
 * want to hand over a Google account it is the only one they want.
 */
export function SignInButtons({
  providers,
  emailEnabled = false,
  callbackUrl = "/docs/showcase",
}: {
  providers: AuthProviderId[];
  emailEnabled?: boolean;
  callbackUrl?: string;
}) {
  if (providers.length === 0 && !emailEnabled) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-sm font-medium text-foreground">
          Sign-in isn&apos;t switched on yet
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          No auth credentials are set on this deployment. It needs{" "}
          <code className="font-mono text-xs">AUTH_SECRET</code>, plus either{" "}
          <code className="font-mono text-xs">RESEND_API_KEY</code> for email
          sign-in or an{" "}
          <code className="font-mono text-xs">AUTH_&lt;PROVIDER&gt;_ID</code>/
          <code className="font-mono text-xs">_SECRET</code> pair for OAuth.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {emailEnabled && <EmailSignIn callbackUrl={callbackUrl} />}

      {emailEnabled && providers.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>
      )}

      {providers.length > 0 && (
        <div className="flex flex-col gap-2">
          {providers.map((id) => (
            <Button
              key={id}
              variant="outline"
              className="w-full justify-center"
              onClick={() => signIn(id, { callbackUrl })}
            >
              Continue with {PROVIDER_LABELS[id]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Email magic link. No password: there is nothing to store, nothing to leak,
 * and no reset flow to build — the link in the inbox *is* the reset flow.
 *
 * The success state is deliberately final rather than a toast. The next step
 * happens in another application, so the last thing this panel says has to be
 * the instruction to go and look there.
 */
function EmailSignIn({ callbackUrl }: { callbackUrl: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  if (state === "sent") {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-sm font-medium text-foreground">Check your inbox</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A sign-in link is on its way to {email}. It expires in 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (state === "sending") return;
        setState("sending");
        // `redirect: false` so a failure lands back here with a message rather
        // than on Auth.js's own error page, which loses the dialog entirely.
        const res = await signIn(EMAIL_PROVIDER_ID, {
          email,
          callbackUrl,
          redirect: false,
        });
        setState(res?.error ? "error" : "sent");
      }}
    >
      <Input
        type="email"
        required
        autoComplete="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={state === "sending"}
      />
      <Button
        type="submit"
        className="w-full justify-center gap-2"
        disabled={state === "sending"}
      >
        {state === "sending" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Mail className="size-4" />
        )}
        Email me a sign-in link
      </Button>
      {state === "error" && (
        <p className="text-sm text-destructive">
          Couldn&apos;t send the link. Check the address and try again.
        </p>
      )}
    </form>
  );
}
