import { MAX_CLIPS } from "./types";

/**
 * A saved timeline, and the gate everything written to one has to pass.
 *
 * The stored blob is the same `{clips, audio, font}` the local draft holds, so
 * this deliberately does *not* re-validate every clip: the client revives a
 * project through `reviveDraft` exactly as it revives a draft, which is where a
 * stale slug or an impossible duration is dealt with. What is checked here is
 * what only the server can defend — the size of the thing being put in the
 * database, and how many rows one account may hold.
 */

/** Per user. A history, not a filesystem — high enough nobody sane hits it. */
export const MAX_PROJECTS = 50;

/** Fits the header input and any list row. */
export const MAX_TITLE_LEN = 80;

export const DEFAULT_TITLE = "Untitled video";

/**
 * Ceiling on one stored project.
 *
 * A clip's props may carry an uploaded image as a data URL (`/api/render`
 * allows 4 MB of props per clip), so this is not a tight bound on a normal
 * timeline — it is the bound that stops one account turning autosave into
 * unbounded database growth.
 */
const MAX_PROJECT_BYTES = 5_000_000;

/** What the list endpoint returns — light enough to send every row of it. */
export interface ProjectSummary {
  id: string;
  title: string;
  clipCount: number;
  updatedAt: string;
}

export class ProjectInputError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ProjectInputError";
    this.status = status;
  }
}

/** Trim to something displayable; empty falls back rather than 400s. */
export function parseTitle(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new ProjectInputError("title must be a string");
  }
  const title = raw.trim().slice(0, MAX_TITLE_LEN);
  return title || DEFAULT_TITLE;
}

/** Validate the blob an autosave wants to store. Returns it unchanged. */
export function parseProjectData(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ProjectInputError("data must be an object");
  }
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.clips)) {
    throw new ProjectInputError("data.clips must be an array");
  }
  if (data.clips.length > MAX_CLIPS) {
    throw new ProjectInputError(
      `data.clips exceeds the ${MAX_CLIPS}-clip limit`,
    );
  }
  if (JSON.stringify(data).length > MAX_PROJECT_BYTES) {
    throw new ProjectInputError("this project is too large to save", 413);
  }
  return data;
}
