"use client";

import { Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CopyButton } from "@/components/docs/copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Key = { id: string; name: string; key: string; createdAt: string };

const DATE = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** `sk_AbCd…WxYz` — enough to tell two keys apart, not enough to use one. */
const mask = (key: string) => `${key.slice(0, 7)}…${key.slice(-4)}`;

/**
 * The owner's keys: create one with a label, reveal or copy any, delete any.
 *
 * Delete asks once, inline — a second click on the same row — rather than in a
 * dialog. It is the one destructive act here, and an install that starts
 * failing is the consequence, so it gets a pause; a modal would be more
 * ceremony than a key is worth. `router.refresh()` after each change, so the
 * setup steps above pick up the new first key.
 */
export function ApiKeys({
  initial,
  canCreate,
}: {
  initial: Key[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [keys, setKeys] = useState(initial);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Couldn't create a key.");
      setKeys((list) => [...list, body as Key]);
      setRevealed((body as Key).id);
      setName("");
      toast.success("Key created — copy it into your .env.local");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't create a key.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn't delete that key.");
      }
      setKeys((list) => list.filter((k) => k.id !== id));
      toast.success("Key deleted");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't delete that key.",
      );
    } finally {
      setDeleting(null);
      setConfirming(null);
    }
  }

  return (
    <div className="mt-4">
      {keys.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground text-sm">
                  {k.name}
                </p>
                <p className="mt-0.5 break-all font-mono text-muted-foreground text-xs">
                  {revealed === k.id ? k.key : mask(k.key)}
                  <span className="font-sans">
                    {" · "}created {DATE.format(new Date(k.createdAt))}
                  </span>
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={revealed === k.id ? "Hide key" : "Show key"}
                onClick={() => setRevealed(revealed === k.id ? null : k.id)}
              >
                {revealed === k.id ? <EyeOff /> : <Eye />}
              </Button>
              <CopyButton value={k.key} />
              {confirming === k.id ? (
                <span className="flex items-center gap-1">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={deleting === k.id}
                    onClick={() => remove(k.id)}
                  >
                    {deleting === k.id ? (
                      <Loader2 className="animate-spin" />
                    ) : null}
                    Delete key
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirming(null)}
                  >
                    Cancel
                  </Button>
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${k.name}`}
                  onClick={() => setConfirming(k.id)}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-border border-dashed p-4 text-muted-foreground text-sm">
          No keys. Create one to install Pro components.
        </p>
      )}

      {canCreate ? (
        <form onSubmit={create} className="mt-3 flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name it — laptop, CI, a teammate"
            maxLength={40}
            aria-label="Key name"
          />
          <Button type="submit" disabled={creating} className="shrink-0">
            {creating ? <Loader2 className="animate-spin" /> : null}
            Create key
          </Button>
        </form>
      ) : null}
    </div>
  );
}
