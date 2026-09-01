"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useTrackEvent } from "@/lib/analytics";

/**
 * Ask for an email *after* the file has downloaded, never before.
 *
 * The site's list had five people on it against roughly a hundred and twenty
 * exports a month, because the only place that asked was a newsletter box at
 * the bottom of the home page — a stranger's least interested moment. This is
 * the most interested one: the video is made, it is theirs, it is already on
 * their disk. Nothing is being held back, so the ask can be honest and small
 * and take a no.
 *
 * Signed-in people never see it; their address is already in the users table
 * and asking again would read as not knowing who they are.
 */
const DISMISSED_KEY = "snapcn:export-email-asked";

/** Whether this browser has already answered, either way. */
export function hasAnsweredEmailPrompt(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    // Private windows and blocked site data throw on access rather than
    // returning null. Treating that as "not asked" shows the prompt once per
    // export in a browser that cannot remember — annoying, but a thrown error
    // here would take down the export flow, which is worse.
    return false;
  }
}

function remember() {
  try {
    localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // See above — a browser that will not store this still gets to say no.
  }
}

export function ExportEmailPrompt({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const trackEvent = useTrackEvent();
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  function close() {
    remember();
    onOpenChange(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !email.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // `source` is what makes this measurable against the home-page box:
        // two asks, two very different moments, and the split says which one
        // is worth keeping.
        body: JSON.stringify({ email: email.trim(), source: "export" }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "That didn't go through.");
      }
      trackEvent("email_subscribed", { source: "export" });
      toast.success("You're on the list.");
      close();
    } catch (err) {
      setSaving(false);
      toast.error(
        err instanceof Error ? err.message : "That didn't go through.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Your video is downloading</DialogTitle>
          <DialogDescription>
            New components land most weeks. Want an email when they do? No
            newsletter, just the additions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="mt-2 flex flex-col gap-3">
          <Input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            aria-label="Email address"
          />
          <div className="flex items-center justify-end gap-2">
            {/* A real way out, not a greyed-out corner. Someone who says no
                here is someone who might come back; someone who feels cornered
                is not. */}
            <Button type="button" variant="ghost" onClick={close}>
              No thanks
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Keep me posted
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
