"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTrackEvent } from "@/lib/analytics";

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
 */
export function StudioInstall({ name }: { name: string }) {
  const trackEvent = useTrackEvent();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const send = async () => {
    setPending(true);
    try {
      const [{ installInStudio }, payload] = await Promise.all([
        import("@remotion/studio-protocol"),
        fetch(`/elements/${name}.json`).then((res) => res.json()),
      ]);
      const result = await installInStudio({ payload });
      trackEvent("studio_install_requested", {
        component: name,
        result: result.success ? result.status : result.code,
      });
      setStatus(
        result.success ? "Sent — confirm it in Studio." : result.message,
      );
    } catch {
      setStatus("Could not load this component. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button variant="outline" size="sm" onClick={send} disabled={pending}>
        {pending ? "Sending…" : "Add to Remotion Studio"}
      </Button>
      <output aria-live="polite" className="text-muted-foreground text-xs">
        {status ??
          "No setup: sends it to a running Studio (Remotion 4.0.524+)."}
      </output>
    </div>
  );
}
