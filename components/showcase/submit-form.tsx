"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTrackEvent } from "@/lib/analytics";

/** Post a new showcase submission. Lands as `pending` for admin review. */
export function SubmitForm({ onDone }: { onDone?: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const trackEvent = useTrackEvent();
  const [title, setTitle] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [description, setDescription] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/showcase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, postUrl, description }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't submit — please try again.");
        return;
      }
      trackEvent("showcase_submitted", { source: "gallery" });
      toast.success("Submitted! We'll review it shortly.");
      setTitle("");
      setPostUrl("");
      setDescription("");
      onDone?.();
    } catch {
      toast.error("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sc-title">Title</Label>
        <Input
          id="sc-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Product launch teaser"
          required
          maxLength={120}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sc-url">Link to your post</Label>
        <Input
          id="sc-url"
          type="url"
          value={postUrl}
          onChange={(e) => setPostUrl(e.target.value)}
          placeholder="https://x.com/you/status/…"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sc-desc">
          Description{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="sc-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A few words about how you made it"
          maxLength={500}
        />
      </div>
      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Submitting…" : "Submit for review"}
      </Button>
    </form>
  );
}
