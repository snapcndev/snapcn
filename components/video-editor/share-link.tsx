"use client";

import { Check, Copy, Link2 } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthProviderId } from "@/lib/auth-providers";
import type { AudioTrack, Clip } from "@/lib/video-editor/types";

/**
 * Turn the timeline into a page at `/v/<id>` that anyone can open.
 *
 * ## Why this is a separate button and not part of Export
 *
 * The download route deletes the MP4 as it streams — an export is scratch by
 * design. Keeping the file has to happen *instead of* downloading it, which is
 * what `onDone` is for, and that makes it a second action rather than a
 * follow-up offer on the first. Nothing is lost by it: the video is playable and
 * downloadable from the share page afterwards, so one render still gets you both
 * a link and a file.
 *
 * ## The sign-in
 *
 * This is the only place in the export flow that requires an account, and it is
 * the right place: the file needs no owner, a permanent URL does — somebody has
 * to be able to delete it, and that account is what carries the upgrade later.
 * Gating the export itself lost two of every three people before they had
 * anything (3 sign-ins opened, 1 completed, over the editor's first month).
 */
export function ShareLink({
  clips,
  font,
  audio,
  signedIn,
  providers,
  emailEnabled,
  exporting,
  progress,
  download,
}: {
  clips: Clip[];
  font: string;
  audio: AudioTrack | null;
  signedIn: boolean;
  providers: AuthProviderId[];
  emailEnabled: boolean;
  exporting: boolean;
  progress: number;
  /** The editor's one `useEditorExport` instance, shared rather than a second. */
  download: (
    clips: Clip[],
    opts: {
      removeWatermark?: boolean;
      font?: string;
      audio?: {
        uploadId: string | null;
        volume: number;
        trimStart: number;
      } | null;
      onDone?: (jobId: string) => Promise<void> | void;
    },
  ) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    await download(clips, {
      // A shared page is an advert, so it carries the mark whatever the plan —
      // the same rule the showcase submission follows.
      removeWatermark: false,
      font,
      audio: audio
        ? {
            uploadId: audio.uploadId,
            volume: audio.volume,
            trimStart: audio.trimStart,
          }
        : null,
      onDone: async (jobId) => {
        try {
          const res = await fetch("/api/share", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jobId,
              title,
              // Slugs, so the page can name and link what built the video.
              componentsUsed: [...new Set(clips.map((clip) => clip.slug))],
            }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            url?: string;
            error?: string;
          };
          if (!res.ok || !data.url) {
            toast.error(data.error ?? "Couldn't create a link — try again.");
            return;
          }
          setUrl(`${window.location.origin}${data.url}`);
        } catch {
          toast.error("Network error — please try again.");
        }
      },
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked (insecure context, denied permission). The input
      // below is readable and selectable, so there is still a way to get it.
      toast.error("Couldn't copy — select the link and copy it.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // A closed dialog reopening onto the previous link would offer a stale
        // URL for a timeline that has since changed.
        if (!next) {
          setUrl(null);
          setTitle("");
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={clips.length === 0}
          />
        }
      >
        <Link2 className="size-4" />
        <span className="hidden sm:inline">Get a link</span>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {url ? "Your link is ready" : "Get a shareable link"}
          </DialogTitle>
          <DialogDescription>
            {url
              ? "Anyone with this link can watch it. Paste it instead of attaching the file."
              : signedIn
                ? "We'll render your video and host it at a permanent URL you can send to anyone."
                : "Sign in to keep the link — a hosted video is attached to your account."}
          </DialogDescription>
        </DialogHeader>

        {url ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button
                variant="outline"
                onClick={copy}
                aria-label="Copy link"
                className="shrink-0"
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
            <Button
              variant="outline"
              nativeButton={false}
              // `Link`, not a bare `<a>`: the anchor-content lint cannot see
              // that `Button` injects the label through `render`, and every
              // other link in this codebase goes through `Link` anyway.
              render={<Link href={url} target="_blank" rel="noreferrer" />}
            >
              Open the page
            </Button>
          </div>
        ) : signedIn ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="share-title">Title</Label>
              <Input
                id="share-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Product launch teaser"
                required
                maxLength={120}
              />
            </div>
            <Button type="submit" disabled={exporting} className="w-full">
              {exporting
                ? `Rendering… ${Math.round(progress * 100)}%`
                : "Create link"}
            </Button>
          </form>
        ) : (
          <SignInButtons
            providers={providers}
            emailEnabled={emailEnabled}
            callbackUrl="/docs/video-editor"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
