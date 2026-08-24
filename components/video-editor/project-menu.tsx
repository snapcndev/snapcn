"use client";

import { Check, ChevronDown, FilePlus2, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { MAX_TITLE_LEN, type ProjectSummary } from "@/lib/video-editor/project";

/**
 * The editor's title, and the history behind it.
 *
 * Mounted only for a signed-in editor with projects available — signed out
 * there is exactly one timeline (the browser's draft) and a menu offering to
 * switch between saved videos would be lying about what it can do.
 *
 * The title is a bare input rather than a rename dialog: it is the one field
 * here, it is already the thing being looked at, and a dialog to change one
 * string is a click and a modal for nothing.
 */
export function ProjectMenu({
  title,
  saving,
  projects,
  currentId,
  onTitleChange,
  onTitleCommit,
  onRefresh,
  onNew,
  onOpen,
  onDelete,
}: {
  title: string;
  saving: boolean;
  projects: ProjectSummary[];
  currentId: string | null;
  onTitleChange: (title: string) => void;
  onTitleCommit: () => void;
  onRefresh: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex min-w-0 items-center gap-0.5">
      <input
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        onBlur={onTitleCommit}
        // Enter commits by leaving the field — the same path as clicking away,
        // so there is one save call and not two.
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        maxLength={MAX_TITLE_LEN}
        spellCheck={false}
        aria-label="Video title"
        className="-ml-1.5 min-w-0 flex-1 truncate rounded-md bg-transparent px-1.5 py-0.5 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
      />

      {/* Saving is deliberately quiet: a spinner where the chevron is, not a
          banner. It matters only when it fails, and failure is a toast. */}
      {saving && (
        <Loader2
          className="size-3.5 shrink-0 animate-spin text-muted-foreground"
          aria-label="Saving"
        />
      )}

      <DropdownMenu onOpenChange={(open) => open && onRefresh()}>
        <DropdownMenuTrigger
          aria-label="Your videos"
          className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronDown className="size-4" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuItem onClick={onNew}>
            <FilePlus2 className="size-4" />
            New video
          </DropdownMenuItem>

          {currentId && (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" />
              Delete this video
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* The label is a `Menu.GroupLabel`, which throws outside a group —
              so the list and its heading are one group, which is what they are. */}
          <DropdownMenuGroup className="max-h-72 overflow-y-auto">
            <DropdownMenuLabel>Your videos</DropdownMenuLabel>

            {projects.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Nothing saved yet — this one is kept as soon as it has a clip.
              </p>
            ) : (
              projects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onClick={() => onOpen(project.id)}
                  className="items-start gap-2"
                >
                  <Check
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      project.id !== currentId && "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{project.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {project.clipCount}{" "}
                      {project.clipCount === 1 ? "clip" : "clips"} ·{" "}
                      {ago(project.updatedAt)}
                    </span>
                  </span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The timeline is removed from your videos. Any MP4 you already
              exported is untouched — it is on your machine, not ours.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline">Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => currentId && onDelete(currentId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** Largest unit that fits, so a list of rows reads at a glance. */
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["minute", 60_000],
  ["hour", 3_600_000],
  ["day", 86_400_000],
  ["month", 2_592_000_000],
  ["year", 31_536_000_000],
];

function ago(iso: string): string {
  const elapsed = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 60_000) return "just now";
  for (let i = STEPS.length - 1; i >= 0; i -= 1) {
    const [unit, ms] = STEPS[i];
    if (elapsed >= ms) return RELATIVE.format(-Math.floor(elapsed / ms), unit);
  }
  return "just now";
}
