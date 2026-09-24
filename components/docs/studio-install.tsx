"use client";

import type { InstallInStudioResult } from "@remotion/studio-protocol";
import { CheckIcon, Loader2, MonitorPlay } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CommandLine } from "@/components/command-line";
import { useTrackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * "Add to Remotion Studio": the component, sent over the Remotion Studio
 * Protocol to a Studio running on this machine, which shows the source and
 * installs it on confirmation. No CLI and no `components.json` — the one setup
 * step the install block has to warn about.
 *
 * The payload (`public/elements/<name>.json`, built by `registry:build`) and
 * the protocol package are both loaded on click. The payload runs 30–50KB and
 * this renders for every component in the gallery overlay, so nobody pays for
 * a Studio handoff they never ask for — the same reasoning as ComponentSource.
 *
 * Quiet until it has something to say. The button is the secondary action and
 * explains itself in its tooltip, not in a paragraph under it; the answer to a
 * click lands in the label, where the eye already is — Sending…, then Sent —
 * and only a click that needs a next step opens a note, with the command in it.
 */
type Outcome =
  | { kind: "sent"; project: string | null }
  | { kind: "no-studio" }
  | { kind: "upgrade" }
  | { kind: "blocked" }
  | { kind: "locked"; message: string; url: string }
  | { kind: "failed"; message: string };

function outcomeOf(result: InstallInStudioResult): Outcome {
  if (result.success) {
    return { kind: "sent", project: result.target.projectName };
  }
  switch (result.code) {
    case "no-compatible-studio":
    case "no-installable-target":
    case "target-expired":
      return { kind: "no-studio" };
    case "studio-upgrade-required":
    case "unsupported-protocol":
      return { kind: "upgrade" };
    case "loopback-network-permission-denied":
      return { kind: "blocked" };
    default:
      return { kind: "failed", message: result.message };
  }
}

const HOW = "/docs/remotion-studio";
/** A note arriving under the button: in from just above, never from nowhere. */
const ENTER =
  "animate-in fade-in-0 slide-in-from-top-1 duration-200 ease-out motion-reduce:animate-none";

export function StudioInstall({
  name,
  surface,
  block = false,
}: {
  name: string;
  surface: "docs" | "gallery";
  /** Full width, for the gallery panel's column of actions. */
  block?: boolean;
}) {
  const trackEvent = useTrackEvent();
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const send = async () => {
    setPending(true);
    try {
      const [{ installInStudio }, res] = await Promise.all([
        import("@remotion/studio-protocol"),
        fetch(`/elements/${name}.json`),
      ]);
      // A Pro Element is the component's source, handed out only to an
      // account that owns it: the route answers 401/402 with where to go.
      if (res.status === 401 || res.status === 402) {
        const why = await res.json().catch(() => ({}));
        setOutcome({
          kind: "locked",
          message: why.message ?? "This one comes with the Pro catalogue.",
          url: why.url ?? "/docs/pricing#plans",
        });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const payload = await res.json();
      const result = await installInStudio({ payload });
      trackEvent("studio_install_requested", {
        component: name,
        result: result.success ? result.status : result.code,
        surface,
      });
      setOutcome(outcomeOf(result));
    } catch {
      setOutcome({
        kind: "failed",
        message: "Could not load this component. Try again.",
      });
    } finally {
      setPending(false);
    }
  };

  const sentTo = !pending && outcome?.kind === "sent" ? outcome : null;
  const state = pending ? "pending" : sentTo ? "sent" : "idle";
  const Icon = pending ? Loader2 : sentTo ? CheckIcon : MonitorPlay;
  const label = pending
    ? "Sending…"
    : sentTo
      ? `Sent${sentTo.project ? ` to ${sentTo.project}` : ""}`
      : "Add to Remotion Studio";
  const note = pending ? null : outcome;

  const how = (
    <Link
      href={HOW}
      className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
    >
      How it works
    </Link>
  );

  return (
    // not-prose: on a docs page this sits inside MDX, whose code styling
    // would box the command a second time.
    <div className={cn("not-prose", block ? "w-full" : "mt-3")}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={pending}
          title="Sends it to the Remotion Studio running on this computer"
          className={cn(
            "inline-flex items-center justify-center rounded-lg font-medium text-sm transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] disabled:cursor-default motion-reduce:transition-none",
            block
              ? "h-11 w-full rounded-xl border border-border bg-muted/20 text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] hover:bg-muted/60"
              : "h-8 border border-border px-3 text-foreground hover:bg-muted",
          )}
        >
          {/* Keyed on the state so each label arrives rather than swaps. */}
          <span
            key={state}
            className="inline-flex items-center gap-2 animate-in fade-in-0 duration-150 ease-out motion-reduce:animate-none"
          >
            <Icon
              className={cn(
                "size-4",
                pending && "animate-spin",
                sentTo && "text-primary",
              )}
              aria-hidden="true"
            />
            {label}
          </span>
        </button>
        {!block && outcome === null && <span className="text-xs">{how}</span>}
      </div>

      <div aria-live="polite" className="text-xs">
        {note?.kind === "sent" && (
          <p className={cn("mt-2 text-muted-foreground", ENTER)}>
            Confirm the install in Studio.
          </p>
        )}
        {note?.kind === "no-studio" && (
          <div className={cn("mt-3", ENTER)}>
            <p className="font-medium text-foreground">
              Open Remotion Studio first
            </p>
            <p className="mt-1 text-muted-foreground">
              Run this in your Remotion project (4.0.524 or newer), open a
              composition, then click again.
            </p>
            <CommandLine command="npx remotion studio" className="mt-2" />
            <p className="mt-2">{how}</p>
          </div>
        )}
        {note?.kind === "upgrade" && (
          <div className={cn("mt-3", ENTER)}>
            <p className="font-medium text-foreground">
              Needs Remotion 4.0.524 or newer
            </p>
            <CommandLine command="npx remotion upgrade" className="mt-2" />
          </div>
        )}
        {note?.kind === "blocked" && (
          <p className={cn("mt-2 text-muted-foreground", ENTER)}>
            Your browser blocked access to localhost — allow local network
            access for this site, then try again. {how}
          </p>
        )}
        {note?.kind === "locked" && (
          <p className={cn("mt-2 text-muted-foreground", ENTER)}>
            {note.message}{" "}
            <Link
              href={note.url.replace("https://snapcn.dev", "")}
              className="text-foreground underline underline-offset-4"
            >
              Continue
            </Link>
          </p>
        )}
        {note?.kind === "failed" && (
          <p className={cn("mt-2 text-muted-foreground", ENTER)}>
            {note.message} {how}
          </p>
        )}
      </div>
    </div>
  );
}
