"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Member = { id: string; email: string; createdAt: string; joined: boolean };

/**
 * The people on a Commercial licence: invite by email, remove with a second
 * click. An invitee has Pro the moment they sign in with the address — the
 * email says so — and loses it, keys and all, the moment they are removed.
 */
export function Team({
  initial,
  seats,
}: {
  initial: Member[];
  /** Seats on the licence, the owner's included. */
  seats: number;
}) {
  const [members, setMembers] = useState(initial);
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const free = seats - 1 - members.length;

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (adding) return;
    setAdding(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Couldn't add them.");
      setMembers((list) => [...list, body as Member]);
      setEmail("");
      toast.success(`Invited ${(body as Member).email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add them.");
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    setRemoving(id);
    try {
      const res = await fetch(`/api/team/${id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Couldn't remove them.");
      }
      setMembers((list) => list.filter((m) => m.id !== id));
      toast.success("Removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove them.");
    } finally {
      setRemoving(null);
      setConfirming(null);
    }
  }

  return (
    <div className="mt-4">
      {members.length > 0 ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground text-sm">
                  {m.email}
                </p>
                <p className="mt-0.5 text-muted-foreground text-xs">
                  {m.joined ? "Signed in" : "Invited — not signed in yet"}
                </p>
              </div>
              {confirming === m.id ? (
                <span className="flex items-center gap-1">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={removing === m.id}
                    onClick={() => remove(m.id)}
                  >
                    {removing === m.id ? (
                      <Loader2 className="animate-spin" />
                    ) : null}
                    Remove
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
                  aria-label={`Remove ${m.email}`}
                  onClick={() => setConfirming(m.id)}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {free > 0 ? (
        <form onSubmit={add} className="mt-3 flex gap-2">
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            aria-label="Teammate's email"
            className="flex-1"
          />
          <Button type="submit" disabled={adding}>
            {adding ? <Loader2 className="animate-spin" /> : null}
            Invite
          </Button>
        </form>
      ) : null}
      <p className="mt-2 text-muted-foreground text-xs">
        {free > 0
          ? `${free} of ${seats - 1} seats free. They sign in with the address you invite and get their own keys.`
          : `All ${seats} seats are taken, yours included.`}
      </p>
    </div>
  );
}
