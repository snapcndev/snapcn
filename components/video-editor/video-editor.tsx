"use client";

import { Download, LayoutGrid, Loader2, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChromeControls } from "@/components/docs/gallery/chrome-controls";
import { GallerySidebarMobile } from "@/components/docs/gallery/gallery-sidebar";
import { PanelToggleIcon } from "@/components/icons/panel-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { useTrackEvent } from "@/lib/analytics";
import type { AuthProviderId } from "@/lib/auth-providers";
import { getDefaults } from "@/lib/customizer-config";
import { cn } from "@/lib/utils";
import type { EditorDraft } from "@/lib/video-editor/draft";
import { DEFAULT_FONT } from "@/lib/video-editor/fonts";
import { moveItem } from "@/lib/video-editor/reorder";
import {
  DEFAULT_PX_PER_SECOND,
  fitPxPerSecond,
} from "@/lib/video-editor/timeline-zoom";
import {
  type AudioTrack,
  CANVAS,
  type Clip,
  DEFAULT_BACKGROUND,
  isHexColor,
  MAX_CLIP_FRAMES,
  MAX_CLIPS,
  MAX_TOTAL_FRAMES,
  maxFramesForClip,
  remainingFrames,
  totalDuration,
} from "@/lib/video-editor/types";
import registry from "@/registry/__index__";
import { AudioTrackRow } from "./audio-track-row";
import { EditorPlayer, type EditorPlayerHandle } from "./editor-player";
import { EditorStatusBar } from "./editor-status-bar";
import { LibraryPanel } from "./library-panel";
import { ProjectMenu } from "./project-menu";
import { PropertiesPanel } from "./properties-panel";
import { SubmitToShowcase } from "./submit-to-showcase";
import { TimelineStrip } from "./timeline-strip";
import { useEditorExport } from "./use-editor-export";
import { useProjects } from "./use-projects";
import { WatermarkBadge } from "./watermark-badge";

let clipCounter = 0;
function nextClipId() {
  clipCounter += 1;
  return `clip-${clipCounter}`;
}

export function VideoEditor({
  signedIn = false,
  providers = [],
  emailEnabled = false,
}: {
  /** Resolved on the server by the page; no SessionProvider round-trip. */
  signedIn?: boolean;
  providers?: AuthProviderId[];
  emailEnabled?: boolean;
} = {}) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [pxPerSecond, setPxPerSecond] = useState(DEFAULT_PX_PER_SECOND);
  // Defaults to false even when signed in — the mark comes off on purpose or
  // not at all. The server re-derives this from the session; it is a request.
  const [removeWatermark, setRemoveWatermark] = useState(false);
  const [audio, setAudio] = useState<AudioTrack | null>(null);
  const [font, setFont] = useState<string>(DEFAULT_FONT);
  const [currentFrame, setCurrentFrame] = useState(0);
  const playerRef = useRef<EditorPlayerHandle | null>(null);
  const trackShellRef = useRef<HTMLDivElement | null>(null);
  const { exporting, progress, download } = useEditorExport();
  const trackEvent = useTrackEvent();

  // Opened vs. exported is the editor's only funnel — how many people reach it
  // and then build nothing tells us whether the empty state is the problem.
  useEffect(() => {
    trackEvent("editor_opened");
  }, [trackEvent]);

  /**
   * What the timeline looked like when somebody gave up on it.
   *
   * Read through refs rather than state: this fires from a `pagehide` listener
   * that is registered once, and a listener registered once closes over the
   * state of the first render forever. The refs are written on every render, so
   * the handler always sees the timeline as it actually was.
   */
  const shape = useRef({ clips: 0, previewed: false, audio: false });
  shape.current.clips = clips.length;
  shape.current.audio = Boolean(audio);
  const openedAt = useRef(Date.now());
  const exported = useRef(false);
  // Set the moment a render is requested, not when it finishes: somebody who
  // pressed export and closed the tab while it ran has not abandoned anything.
  if (exporting) exported.current = true;

  useEffect(() => {
    const onLeave = () => {
      // Leaving after you got the file is not abandonment.
      if (exported.current) return;
      trackEvent("editor_abandoned", {
        clip_count: shape.current.clips,
        previewed: shape.current.previewed,
        had_audio: shape.current.audio,
        seconds: Math.round((Date.now() - openedAt.current) / 1000),
      });
    };
    // `pagehide`, not `beforeunload`: the latter never fires on a discarded
    // mobile tab, which is exactly where a half-built video gets abandoned.
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [trackEvent]);

  /**
   * Load a stored timeline into the editor. `null` empties it — a new video.
   *
   * Stable, and it must stay that way: `useProjects` restores through this on
   * mount and every time a project is opened.
   */
  const restore = useCallback((draft: EditorDraft | null) => {
    setClips(draft?.clips ?? []);
    setAudio(draft?.audio ?? null);
    setFont(draft?.font ?? DEFAULT_FONT);
    setSelectedId(null);
  }, []);

  /**
   * Persistence, and the history behind it. Signed out this is the same
   * `localStorage` draft as before — the timeline has to outlive the page
   * because OAuth is a full-page redirect, and signing in from the watermark
   * badge used to throw away everything the user had built. Signed in, that
   * draft becomes the account's first project and every later one is a row.
   */
  const projects = useProjects({
    signedIn,
    clips,
    audio,
    font,
    onRestore: restore,
  });

  // The guard reads `clips` from the closure rather than the updater's `prev`,
  // because the tracking call has to live OUTSIDE the state updater: React
  // double-invokes updaters under StrictMode, and a side effect in there fires
  // twice. `addClip` is only ever called from a click, so the closure is current.
  const addClip = useCallback(
    (slug: string) => {
      const entry = registry[slug];
      if (!entry) return;

      // Both refusals speak. The bug this replaces was a bare `return`: the
      // tile was clickable, the click did nothing, and there was no way to
      // learn why. The library dims what will not fit, and clicking it anyway
      // says which limit stopped it — a `disabled` tile cannot explain itself,
      // and its tooltip does not exist on a touch screen.
      if (clips.length >= MAX_CLIPS) {
        toast.error(`That's the maximum of ${MAX_CLIPS} clips.`, {
          description: "Remove a clip to make room for another.",
        });
        return;
      }
      const left = remainingFrames(clips);
      if (entry.config.durationInFrames > left) {
        toast.error(
          `Only ${(left / CANVAS.fps).toFixed(1)}s left of the ${
            MAX_TOTAL_FRAMES / CANVAS.fps
          }s timeline.`,
          {
            description: `This clip is ${(
              entry.config.durationInFrames / CANVAS.fps
            ).toFixed(1)}s. Shorten or remove one to fit it.`,
          },
        );
        return;
      }
      // The backdrop its author already picked for the docs preview is the
      // right first guess for the canvas — a clip should land looking the way
      // the gallery showed it, not on an arbitrary black.
      const backdrop = entry.config.previewBackdrop;
      const clip: Clip = {
        id: nextClipId(),
        slug,
        props: getDefaults(entry.config.controls),
        durationInFrames: entry.config.durationInFrames,
        background:
          backdrop?.type === "color" && isHexColor(backdrop.value)
            ? backdrop.value
            : DEFAULT_BACKGROUND,
      };
      setClips((prev) => [...prev, clip]);
      setSelectedId(clip.id);
      // Which components people reach for when composing a real video — a
      // different ranking from which docs pages get read.
      trackEvent("editor_clip_added", {
        component: slug,
        clip_count: clips.length + 1,
      });
    },
    [clips, trackEvent],
  );

  const updateProp = useCallback(
    (key: string, value: unknown) => {
      setClips((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? { ...c, props: { ...c.props, [key]: value } }
            : c,
        ),
      );
    },
    [selectedId],
  );

  const reorderClip = useCallback((from: number, to: number) => {
    setClips((prev) => moveItem(prev, from, to));
  }, []);

  const updateBackground = useCallback(
    (background: string) => {
      setClips((prev) =>
        prev.map((c) => (c.id === selectedId ? { ...c, background } : c)),
      );
    },
    [selectedId],
  );

  const updateDuration = useCallback(
    (frames: number) => {
      if (!selectedId) return;
      // Against the whole-timeline budget, not only `MAX_CLIP_FRAMES`: a clip
      // stretched to 60s used to be accepted here and rejected by the server at
      // export, after the render had already been waited on.
      const ceiling = maxFramesForClip(clips, selectedId);
      const clamped = Math.min(ceiling, Math.max(1, frames));
      setClips((prev) =>
        prev.map((c) =>
          c.id === selectedId ? { ...c, durationInFrames: clamped } : c,
        ),
      );
    },
    [clips, selectedId],
  );

  const removeClip = useCallback((id: string) => {
    setClips((prev) => prev.filter((c) => c.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, []);

  const moveClip = useCallback((id: string, dir: -1 | 1) => {
    setClips((prev) => {
      const i = prev.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  const selected = clips.find((c) => c.id === selectedId) ?? null;
  const totalFrames = totalDuration(clips);
  const totalSeconds = (totalFrames / CANVAS.fps).toFixed(1);
  // What a *new* clip may occupy: the frames left, or none at all once the
  // clip count is spent. The library dims anything longer than this; the
  // reason for a zero is `addClip`'s to tell.
  const budgetFrames = clips.length >= MAX_CLIPS ? 0 : remainingFrames(clips);
  const selectedMaxFrames = selected
    ? maxFramesForClip(clips, selected.id)
    : MAX_CLIP_FRAMES;

  const seek = useCallback((frame: number) => {
    playerRef.current?.seekTo(frame);
  }, []);

  // Fit measures the track's own scroll shell rather than the window: the rail
  // collapses and the properties panel is a fixed column, so the space the
  // timeline actually gets is not something we can derive from the viewport.
  const fitToWidth = useCallback(() => {
    const width = trackShellRef.current?.clientWidth ?? 0;
    setPxPerSecond(fitPxPerSecond(totalFrames / CANVAS.fps, width));
  }, [totalFrames]);

  return (
    // `h-full`, not `h-dvh`: `GalleryFrame fill` owns the viewport and the rail
    // beside it, so this fills whatever it is given. Every panel scrolls inside
    // itself — the shell itself never does.
    <div className="flex h-full flex-col overflow-hidden bg-muted/40">
      {/* Top bar */}
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-background px-3 py-2">
        <GallerySidebarMobile />

        <div className="min-w-0">
          {projects.enabled ? (
            <ProjectMenu
              title={projects.title}
              saving={projects.saving}
              projects={projects.projects}
              currentId={projects.currentId}
              onTitleChange={projects.setTitle}
              onTitleCommit={projects.commitTitle}
              onRefresh={projects.refresh}
              onNew={() => void projects.newProject()}
              onOpen={(id) => void projects.openProject(id)}
              onDelete={(id) => void projects.removeProject(id)}
            />
          ) : (
            <p className="truncate text-sm font-medium text-foreground">
              {projects.title}
            </p>
          )}
          <p className="hidden truncate font-mono text-[0.6875rem] tabular-nums text-muted-foreground sm:block">
            {clips.length} {clips.length === 1 ? "clip" : "clips"} ·{" "}
            {totalSeconds}s of {MAX_TOTAL_FRAMES / CANVAS.fps}s · {CANVAS.width}
            ×{CANVAS.height}
          </p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <WatermarkBadge
            signedIn={signedIn}
            providers={providers}
            emailEnabled={emailEnabled}
            removeWatermark={removeWatermark}
            onRemoveWatermarkChange={setRemoveWatermark}
          />
          <SubmitToShowcase
            clips={clips}
            font={font}
            audio={audio}
            signedIn={signedIn}
            providers={providers}
            emailEnabled={emailEnabled}
            exporting={exporting}
            progress={progress}
            download={download}
          />
          <Button
            size="sm"
            onClick={() => download(clips, { removeWatermark, font, audio })}
            disabled={exporting || clips.length === 0}
            className="gap-2"
          >
            {exporting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {Math.round(progress * 100)}%
              </>
            ) : (
              <>
                <Download className="size-4" />
                Export
              </>
            )}
          </Button>

          {/* Last in the row, so theme and account stay pinned to the right
              edge however many editor controls appear to their left. The same
              component the docs top bar mounts, in the same corner. */}
          <ChromeControls className="ml-1 border-l border-border pl-2.5" />
        </div>
      </header>

      {/* Library · stage · properties */}
      <div className="flex min-h-0 flex-1">
        <div className="relative hidden shrink-0 md:flex">
          <aside
            className={cn(
              "flex flex-col overflow-hidden border-r border-border bg-background transition-[width] duration-200",
              libraryOpen ? "w-64 xl:w-80" : "w-0 border-r-0",
            )}
            aria-hidden={!libraryOpen}
          >
            <LibraryPanel onAdd={addClip} budgetFrames={budgetFrames} />
          </aside>

          {/* Open, the handle straddles the seam so it reads as belonging to
              the edge rather than to either side of it. Collapsed, the rail is
              `w-0` and there is no seam to straddle — a negative offset then
              pushes half the circle off the left of the screen, which is what
              the clipped handle was. So it moves *inside* the stage instead. */}
          <button
            type="button"
            onClick={() => setLibraryOpen((v) => !v)}
            aria-label={
              libraryOpen ? "Hide component library" : "Show component library"
            }
            aria-expanded={libraryOpen}
            className={cn(
              "absolute top-1/2 z-10 grid size-7 -translate-y-1/2 place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-[color,left,right,background-color] hover:bg-muted hover:text-foreground",
              libraryOpen ? "-right-3.5" : "left-2.5",
            )}
          >
            <PanelToggleIcon className="size-[17px]" />
          </button>
        </div>

        {/* The stage. A tinted ground so the canvas reads as a sheet lying on
            it — the same reason a design tool never puts artwork on white. */}
        <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-4 xl:p-6">
          <EditorPlayer
            clips={clips}
            watermark={!(signedIn && removeWatermark)}
            audio={audio}
            font={font}
            playerRef={playerRef}
            onFrame={setCurrentFrame}
            onPlay={() => {
              shape.current.previewed = true;
            }}
          />
        </div>

        <aside className="hidden w-64 shrink-0 flex-col overflow-hidden border-l border-border bg-background lg:flex xl:w-80">
          <PropertiesPanel
            clip={selected}
            maxFrames={selectedMaxFrames}
            onPropChange={updateProp}
            onDurationChange={updateDuration}
            onBackgroundChange={updateBackground}
          />
        </aside>
      </div>

      {/* Timeline, full width under everything — the way an editor reads. */}
      <div
        ref={trackShellRef}
        className="shrink-0 border-t border-border bg-background px-2 pt-2 pb-1.5 sm:px-4 sm:pt-3 sm:pb-2"
      >
        <TimelineStrip
          clips={clips}
          selectedId={selectedId}
          pxPerSecond={pxPerSecond}
          currentFrame={currentFrame}
          onSelect={setSelectedId}
          onRemove={removeClip}
          onMove={moveClip}
          onReorder={reorderClip}
          onSeek={seek}
        />
        <AudioTrackRow
          audio={audio}
          onChange={setAudio}
          pxPerSecond={pxPerSecond}
          videoSeconds={totalFrames / CANVAS.fps}
          currentSeconds={currentFrame / CANVAS.fps}
        />
        <EditorStatusBar
          font={font}
          onFontChange={setFont}
          pxPerSecond={pxPerSecond}
          onZoom={setPxPerSecond}
          onFit={fitToWidth}
          currentFrame={currentFrame}
          totalFrames={totalFrames}
          fps={CANVAS.fps}
          clipCount={clips.length}
        />
      </div>

      {/* Small screens get the library as a sheet rather than a squeezed rail:
          a 288px panel beside a 288px panel on a phone leaves nothing for the
          canvas, which is the whole point of the screen. */}
      <div className="lg:hidden">
        <MobilePanels
          onAdd={addClip}
          budgetFrames={budgetFrames}
          clip={selected}
          maxFrames={selectedMaxFrames}
          onPropChange={updateProp}
          onDurationChange={updateDuration}
          onBackgroundChange={updateBackground}
        />
      </div>

      <Toaster />
    </div>
  );
}

/** Library + properties as bottom sheets, for viewports with no room to dock. */
function MobilePanels({
  onAdd,
  budgetFrames,
  clip,
  maxFrames,
  onPropChange,
  onDurationChange,
  onBackgroundChange,
}: {
  onAdd: (slug: string) => void;
  budgetFrames: number;
  clip: Clip | null;
  maxFrames: number;
  onPropChange: (key: string, value: unknown) => void;
  onDurationChange: (frames: number) => void;
  onBackgroundChange: (background: string) => void;
}) {
  return (
    <div className="flex shrink-0 gap-2 border-t border-border bg-background p-2">
      <Sheet>
        <SheetTrigger
          render={
            <Button variant="outline" size="sm" className="flex-1 gap-2" />
          }
        >
          <LayoutGrid className="size-4" />
          Components
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[70dvh] bg-background p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Components</SheetTitle>
          </SheetHeader>
          <LibraryPanel onAdd={onAdd} budgetFrames={budgetFrames} />
        </SheetContent>
      </Sheet>

      <Sheet>
        <SheetTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              disabled={!clip}
            />
          }
        >
          <SlidersHorizontal className="size-4" />
          Edit clip
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[70dvh] bg-background p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Clip properties</SheetTitle>
          </SheetHeader>
          <PropertiesPanel
            clip={clip}
            maxFrames={maxFrames}
            onPropChange={onPropChange}
            onDurationChange={onDurationChange}
            onBackgroundChange={onBackgroundChange}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
