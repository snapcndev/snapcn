"use client";

import { Share2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useTrackEvent } from "@/lib/analytics";
import type { AuthProviderId } from "@/lib/auth-providers";
import type { AudioTrack, Clip } from "@/lib/video-editor/types";

/**
 * Put the video you just made into the showcase queue.
 *
 * It renders first, then submits — the gallery entry has to be a file, and the
 * editor holds only a timeline. That means the wait is a full export, which is
 * why the button carries the render progress rather than a spinner.
 *
 * The render is deliberately *not* watermark-free even for a signed-in user:
 * every gallery entry carries the mark, because the gallery is the advert.
 */
export function SubmitToShowcase({
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
  const [description, setDescription] = useState("");
  const trackEvent = useTrackEvent();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    await download(clips, {
      removeWatermark: false,
      font,
      audio: audio
        ? {
            uploadId: audio.uploadId,
            volume: audio.volume,
            trimStart: audio.trimStart,
          }
        : null,
      // Runs instead of the download, with the MP4 still on the server.
      onDone: async (jobId) => {
        try {
          const res = await fetch("/api/showcase", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ jobId, title, description }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          if (!res.ok) {
            toast.error(data.error ?? "Couldn't submit — please try again.");
            return;
          }
          trackEvent("showcase_submitted", { source: "editor" });
          toast.success("Submitted! We'll review it shortly.");
          setTitle("");
          setDescription("");
          setOpen(false);
        } catch {
          toast.error("Network error — please try again.");
        }
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
        <Share2 className="size-4" />
        <span className="hidden sm:inline">Submit</span>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit to the showcase</DialogTitle>
          <DialogDescription>
            {signedIn
              ? "We'll render your video and put it in the review queue. It stays private until we approve it."
              : "Sign in first — a submission is attached to your account."}
          </DialogDescription>
        </DialogHeader>

        {signedIn ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sub-title">Title</Label>
              <Input
                id="sub-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Product launch teaser"
                required
                maxLength={120}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sub-desc">
                Description{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="sub-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A few words about how you made it"
                maxLength={500}
              />
            </div>
            <Button type="submit" disabled={exporting} className="w-full">
              {exporting
                ? `Rendering… ${Math.round(progress * 100)}%`
                : "Submit for review"}
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
