"use client";

import { Loader2, Music, Upload, Volume2, X } from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { formatTimecode } from "@/lib/video-editor/timeline-zoom";
import {
  AUDIO_MIME,
  type AudioTrack,
  DEFAULT_AUDIO_VOLUME,
  MAX_AUDIO_BYTES,
} from "@/lib/video-editor/types";

const MB = 1024 * 1024;

/**
 * The soundtrack track.
 *
 * Laid out on the same pixel-per-second scale as the clips above it, so the
 * block you drag *is* the window of the file that plays. A numeric "start at"
 * field would have been less code and would have meant reading a number to
 * understand a position. It carries the playhead for the same reason: audio
 * has to read as part of the timeline, not as a form control underneath it.
 */
export function AudioTrackRow({
  audio,
  onChange,
  pxPerSecond,
  videoSeconds,
  currentSeconds,
}: {
  audio: AudioTrack | null;
  /**
   * Accepts an updater as well as a value. Two async callbacks race after a
   * file is picked — the metadata probe and the upload — and each used to
   * write a snapshot taken before either had finished, so whichever landed
   * last erased the other's field. An updater lets each patch only its own.
   */
  onChange: Dispatch<SetStateAction<AudioTrack | null>>;
  pxPerSecond: number;
  videoSeconds: number;
  currentSeconds: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState<{ x: number; from: number } | null>(null);

  /**
   * A restored track has to prove the file is still there.
   *
   * `src` is an object URL while the tab that uploaded it is alive, and on
   * reload the draft rebuilds it as `/api/audio/<uploadId>` instead. If that
   * upload has since been reclaimed the row comes back looking completely
   * normal — name, volume, trim, the block on the timeline — with a 404 behind
   * it, and the first anyone hears of it is silence during playback or a
   * finished export with no sound.
   *
   * So: probe once, and if it is gone say so and clear the row. Losing the trim
   * they set is worse than nothing, but not nearly as bad as keeping a control
   * that lies about what it is going to do.
   */
  const probed = useRef<string | null>(null);
  useEffect(() => {
    const src = audio?.src;
    if (!src || src.startsWith("blob:") || probed.current === src) return;
    probed.current = src;

    let cancelled = false;
    void fetch(src, { method: "HEAD" })
      .then((res) => {
        if (cancelled || res.ok) return;
        onChange((cur) => (cur?.src === src ? null : cur));
        toast.error("That soundtrack is no longer available.", {
          description:
            "Uploads are cleared once nothing is using them. Add it again to keep it.",
        });
      })
      .catch(() => {
        // Offline or a blocked request is not proof the file is gone. Leave the
        // row alone; the export checks again server-side before it runs.
      });
    return () => {
      cancelled = true;
    };
  }, [audio?.src, onChange]);

  /** How far the head can move before the file runs out under the video. */
  const maxTrim = Math.max(0, (audio?.durationSeconds ?? 0) - videoSeconds);

  const accept = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      // `file.type` is empty for some recordings, so fall back to the extension
      // rather than rejecting a file the browser can actually play.
      const looksAudio =
        AUDIO_MIME.includes(file.type) ||
        /\.(mp3|wav|m4a|aac|ogg|webm)$/i.test(file.name);
      if (!looksAudio) {
        toast.error("That doesn't look like an audio file.");
        return;
      }
      if (file.size > MAX_AUDIO_BYTES) {
        toast.error(
          `That file is ${(file.size / MB).toFixed(1)}MB. The limit is ${MAX_AUDIO_BYTES / MB}MB.`,
        );
        return;
      }

      if (audio?.src.startsWith("blob:")) URL.revokeObjectURL(audio.src);
      const src = URL.createObjectURL(file);
      onChange({
        src,
        uploadId: null,
        name: file.name,
        volume: audio?.volume ?? DEFAULT_AUDIO_VOLUME,
        trimStart: 0,
        durationSeconds: 0,
      });

      /**
       * Patch the track *this* call created, and only while it is still the one
       * loaded.
       *
       * Both callbacks below used to write `{ ...track }` — a snapshot taken
       * before either had run. If the upload finished before the header parsed,
       * the metadata callback wrote that snapshot back and put `uploadId` to
       * null: the file was sitting on the server, the editor believed it was
       * not, and the export dropped the soundtrack while telling the user it
       * had. Patching current state instead makes the two order-free, and keeps
       * a volume or trim the user changed while they were in flight.
       *
       * The `src` check is the other half: if a different file has since been
       * picked, a late callback from the abandoned one must not touch it.
       */
      const patch = (fields: Partial<AudioTrack>) =>
        onChange((cur) =>
          cur && cur.src === src ? { ...cur, ...fields } : cur,
        );

      // Duration is only knowable once the browser has parsed the header, and
      // it is what bounds the crop — without it the block could be dragged past
      // the end of its own file.
      const probe = new window.Audio();
      probe.preload = "metadata";
      probe.src = src;
      probe.addEventListener("loadedmetadata", () => {
        if (!Number.isFinite(probe.duration)) return;
        patch({ durationSeconds: probe.duration });
      });

      // The object URL plays immediately; the upload is what lets the *render*
      // reach the same bytes. Not awaited before showing the track — waiting on
      // a 12MB POST before you can hear your own file is the worse trade.
      setUploading(true);
      const body = new FormData();
      body.append("file", file);
      fetch("/api/audio", { method: "POST", body })
        .then(async (res) => {
          if (!res.ok) throw new Error(String(res.status));
          const { id } = (await res.json()) as { id: string };
          patch({ uploadId: id });
        })
        .catch(() => {
          toast.error("Couldn't upload the soundtrack.", {
            description: "It will play in the preview but won't be exported.",
          });
        })
        .finally(() => setUploading(false));
    },
    [audio, onChange],
  );

  if (!audio) {
    return (
      /* A drop target, not a control. Its only handlers are drag ones, which
         have no keyboard equivalent to give it — and the row already carries a
         real "Add audio" button that does. A role here would announce a
         control that does nothing on Enter, which is worse than none. */
      // biome-ignore lint/a11y/noStaticElementInteractions: drag-only target; the sibling button is the accessible path
      <div
        className="mt-2 flex h-11 items-center gap-2 rounded-lg border border-dashed border-border bg-gallery-card/40 px-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          accept(e.dataTransfer.files[0]);
        }}
      >
        <Music className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-xs text-muted-foreground">
          Drop an audio file here, or
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Upload className="size-3.5" />
          Add audio
        </button>
        <FileInput inputRef={inputRef} onPick={accept} />
      </div>
    );
  }

  const trackWidth = Math.max(videoSeconds * pxPerSecond, 1);
  const percent = videoSeconds > 0 ? (currentSeconds / videoSeconds) * 100 : 0;
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div className="mt-2">
      <div
        className="relative h-11 overflow-hidden rounded-lg border border-border bg-primary/10"
        style={{ width: trackWidth }}
      >
        <button
          type="button"
          aria-label={`Soundtrack ${audio.name} — drag to crop`}
          className={cn(
            "absolute inset-0 flex touch-none items-center gap-2 px-2 text-left",
            maxTrim > 0 ? "cursor-ew-resize" : "cursor-default",
          )}
          onPointerDown={(e) => {
            if (maxTrim <= 0) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag({ x: e.clientX, from: audio.trimStart });
          }}
          onPointerMove={(e) => {
            if (!drag) return;
            // Dragging left moves *into* the file, so the offset grows as the
            // pointer travels back — the block behaves like film under a head.
            const seconds = (drag.x - e.clientX) / pxPerSecond;
            onChange({
              ...audio,
              trimStart: Math.min(maxTrim, Math.max(0, drag.from + seconds)),
            });
          }}
          onPointerUp={(e) => {
            e.currentTarget.releasePointerCapture(e.pointerId);
            setDrag(null);
          }}
          onPointerCancel={() => setDrag(null)}
        >
          <Music className="size-3.5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
            {audio.name}
          </span>
          {uploading && (
            <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
          )}
          <span className="shrink-0 font-mono text-[0.625rem] tabular-nums text-muted-foreground">
            {formatTimecode(audio.trimStart)}
            {audio.durationSeconds > 0 &&
              ` / ${formatTimecode(audio.durationSeconds)}`}
          </span>
        </button>

        {/* Played-so-far fill, and the playhead riding on top of it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 bg-primary/20"
          style={{ width: `${clamped}%` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px bg-primary"
          style={{ left: `${clamped}%` }}
        />
      </div>

      {/* Controls sit under the block, not inside it: the block is a position
          on a timeline, and a slider inside one reads as part of the audio. */}
      <div className="mt-1.5 flex items-center gap-2">
        <Volume2 className="size-3.5 shrink-0 text-muted-foreground" />
        <div className="w-20 shrink-0 sm:w-24">
          <Slider
            value={[Math.round(audio.volume * 100)]}
            min={0}
            max={100}
            step={1}
            aria-label="Soundtrack volume"
            onValueChange={(v) =>
              onChange({
                ...audio,
                volume: (Array.isArray(v) ? (v[0] ?? 0) : v) / 100,
              })
            }
          />
        </div>

        {maxTrim > 0 && (
          <span className="text-[0.6875rem] text-muted-foreground">
            Drag the bar to crop
          </span>
        )}

        <button
          type="button"
          aria-label="Remove soundtrack"
          onClick={() => {
            if (audio.src.startsWith("blob:")) URL.revokeObjectURL(audio.src);
            onChange(null);
          }}
          className="ml-auto grid size-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:text-destructive"
        >
          <X className="size-3.5" />
        </button>
        <FileInput inputRef={inputRef} onPick={accept} />
      </div>
    </div>
  );
}

function FileInput({
  inputRef,
  onPick,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (file: File | undefined) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="audio/*"
      className="sr-only"
      onChange={(e) => {
        onPick(e.target.files?.[0]);
        // Reset, or picking the same file twice in a row fires nothing.
        e.target.value = "";
      }}
    />
  );
}
