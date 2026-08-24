"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  clearDraft,
  type EditorDraft,
  loadDraft,
  reviveDraft,
  saveDraft,
} from "@/lib/video-editor/draft";
import { DEFAULT_TITLE, type ProjectSummary } from "@/lib/video-editor/project";
import registry from "@/registry/__index__";

/**
 * Where the timeline lives between sessions.
 *
 * Signed out — or on a deployment with no database — that is the same
 * `localStorage` draft as before: one timeline, this browser only. Signed in it
 * is a row per project in Postgres, which is what makes a *history* possible:
 * the editor's export is scratch (the MP4 is deleted as it downloads), so the
 * only durable thing worth keeping is the few KB of JSON that can re-render it.
 *
 * The two modes are resolved once, on mount, and the local draft is migrated
 * into a row the first time someone signs in — which is the flow `draft.ts` was
 * built for and the reason it has anything to migrate.
 */

/** Long enough that a drag doesn't PATCH per frame, short enough to feel saved. */
const SAVE_DEBOUNCE_MS = 1200;

/** Sonner dedupes on id, so a failing autosave stacks one toast, not forty. */
const SAVE_TOAST_ID = "project-save";

type Mode = "local" | "remote";

const isKnownSlug = (slug: string) => Boolean(registry[slug]);

export interface UseProjects {
  /** Server-backed projects are available (signed in, database reachable). */
  enabled: boolean;
  projects: ProjectSummary[];
  currentId: string | null;
  title: string;
  saving: boolean;
  /** Restore finished; the editor's state is the one that should be saved. */
  ready: boolean;
  refresh: () => void;
  setTitle: (title: string) => void;
  commitTitle: () => void;
  newProject: () => Promise<void>;
  openProject: (id: string) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
}

export function useProjects({
  signedIn,
  clips,
  audio,
  font,
  onRestore,
}: {
  signedIn: boolean;
  clips: EditorDraft["clips"];
  audio: EditorDraft["audio"];
  font: string;
  /** Push a loaded timeline into the editor. `null` clears it. */
  onRestore: (draft: EditorDraft | null) => void;
}): UseProjects {
  const [mode, setMode] = useState<Mode | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [title, setTitleState] = useState(DEFAULT_TITLE);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  // Written by the effects, read inside queued saves — a save that starts while
  // the user keeps typing has to act on the project that is open *now*, not the
  // one that was open when its timer was set.
  const idRef = useRef<string | null>(null);
  const titleRef = useRef(DEFAULT_TITLE);
  const latestRef = useRef<EditorDraft>({ clips, audio, font });
  // One save at a time, in order. Two overlapping saves of a project that has
  // no row yet would otherwise each create one.
  const queue = useRef<Promise<void>>(Promise.resolve());

  const setTitle = useCallback((next: string) => {
    titleRef.current = next;
    setTitleState(next);
  }, []);

  const persist = useCallback(
    (patch: { data?: EditorDraft; title?: string }): Promise<void> => {
      queue.current = queue.current.then(async () => {
        const id = idRef.current;
        // Nothing to create from: an empty timeline is not a project, and a
        // rename before the first clip is kept in `titleRef` until there is.
        if (!id && (patch.data?.clips.length ?? 0) === 0) return;

        setSaving(true);
        try {
          const res = id
            ? await fetch(`/api/projects/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
              })
            : await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  title: titleRef.current,
                  data: patch.data,
                }),
              });
          if (!res.ok) throw new Error(await readError(res));
          if (!id) {
            const { id: created } = (await res.json()) as { id: string };
            idRef.current = created;
            setCurrentId(created);
          }
        } catch (err) {
          toast.error("Couldn't save this video.", {
            id: SAVE_TOAST_ID,
            description: err instanceof Error ? err.message : String(err),
          });
        } finally {
          setSaving(false);
        }
      });
      return queue.current;
    },
    [],
  );

  const refresh = useCallback(() => {
    void fetch("/api/projects")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { projects: ProjectSummary[] } | null) => {
        if (body) setProjects(body.projects);
      })
      .catch(() => {
        // A stale list is not worth a toast — the next open refetches.
      });
  }, []);

  /**
   * Decide where this session's work lives, and restore it.
   *
   * Runs once. `signedIn` is resolved on the server and handed down, so it
   * cannot change without a navigation; the ref guards React's double-invoke in
   * development rather than a real second run.
   */
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    const draft = loadDraft(isKnownSlug);

    const finish = (next: Mode) => {
      setMode(next);
      setReady(true);
    };

    // No account: the draft is all there is, exactly as before.
    if (!signedIn) {
      onRestore(draft);
      finish("local");
      return;
    }

    void (async () => {
      let list: ProjectSummary[] | null = null;
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          list = ((await res.json()) as { projects: ProjectSummary[] })
            .projects;
        }
      } catch {
        list = null;
      }

      // Signed in but the endpoint is unavailable (no DATABASE_URL): fall back
      // to the draft rather than dropping the work on the floor.
      if (!list) {
        onRestore(draft);
        finish("local");
        return;
      }
      setProjects(list);

      // The migration `draft.ts` exists for: whatever was built before signing
      // in becomes this account's first project, and the browser copy goes.
      if (draft) {
        onRestore(draft);
        finish("remote");
        await persist({ data: draft });
        // Only once the row exists. Clearing on a failed save would delete the
        // only copy of work that was never stored anywhere else.
        if (idRef.current) clearDraft();
        refresh();
        return;
      }

      // `?project=` is how the account menu opens one of these from anywhere on
      // the site: an id to open it, `new` for an empty timeline. Anything else
      // (or nothing) means pick up where they left off — the most recently
      // edited one.
      const requested = new URLSearchParams(window.location.search).get(
        "project",
      );
      if (requested === "new") {
        // Dropped from the URL so a reload doesn't blank the editor a second
        // time, by which point this video has a row of its own.
        window.history.replaceState(null, "", window.location.pathname);
        finish("remote");
        return;
      }

      const target = requested ?? list[0]?.id;
      if (target) {
        try {
          const res = await fetch(`/api/projects/${target}`);
          if (res.ok) {
            const project = (await res.json()) as {
              id: string;
              title: string;
              data: unknown;
            };
            idRef.current = project.id;
            setCurrentId(project.id);
            setTitle(project.title);
            onRestore(reviveDraft(project.data, isKnownSlug));
          }
        } catch {
          // Opening the last project is a convenience; failing it must not stop
          // the editor from starting empty.
        }
      }
      finish("remote");
    })();
  }, [signedIn, onRestore, persist, refresh, setTitle]);

  /**
   * Autosave. Local mode writes the draft synchronously (it always did);
   * remote mode debounces, because every keystroke in a text prop lands here.
   */
  useEffect(() => {
    if (!ready) return;
    const draft: EditorDraft = { clips, audio, font };
    latestRef.current = draft;

    if (mode !== "remote") {
      saveDraft(draft);
      return;
    }
    const timer = setTimeout(
      () => void persist({ data: draft }),
      SAVE_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [ready, mode, clips, audio, font, persist]);

  const newProject = useCallback(async () => {
    // Flush first: the pending debounce belongs to the project being left, and
    // `persist` runs queued in order, so this lands before the id is cleared.
    await persist({ data: latestRef.current });
    idRef.current = null;
    setCurrentId(null);
    setTitle(DEFAULT_TITLE);
    onRestore(null);
    refresh();
  }, [onRestore, persist, refresh, setTitle]);

  const openProject = useCallback(
    async (id: string) => {
      if (id === idRef.current) return;
      await persist({ data: latestRef.current });
      try {
        const res = await fetch(`/api/projects/${id}`);
        if (!res.ok) throw new Error(await readError(res));
        const project = (await res.json()) as {
          id: string;
          title: string;
          data: unknown;
        };
        idRef.current = project.id;
        setCurrentId(project.id);
        setTitle(project.title);
        onRestore(reviveDraft(project.data, isKnownSlug));
      } catch (err) {
        toast.error("Couldn't open that video.", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [onRestore, persist, setTitle],
  );

  const removeProject = useCallback(
    async (id: string) => {
      // Detach *before* the request: a debounced save still holding this id
      // would otherwise PATCH a row that is on its way out.
      if (idRef.current === id) {
        idRef.current = null;
        setCurrentId(null);
        setTitle(DEFAULT_TITLE);
        onRestore(null);
      }
      try {
        const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(await readError(res));
        setProjects((prev) => prev.filter((p) => p.id !== id));
      } catch (err) {
        toast.error("Couldn't delete that video.", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [onRestore, setTitle],
  );

  const commitTitle = useCallback(() => {
    if (mode !== "remote") return;
    void persist({ title: titleRef.current });
    refresh();
  }, [mode, persist, refresh]);

  return {
    enabled: mode === "remote",
    projects,
    currentId,
    title,
    saving,
    ready,
    refresh,
    setTitle,
    commitTitle,
    newProject,
    openProject,
    removeProject,
  };
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body?.error) return body.error;
  } catch {
    // non-JSON
  }
  return `Request failed (${res.status})`;
}
