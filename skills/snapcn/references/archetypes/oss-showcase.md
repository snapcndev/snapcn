# oss-showcase

**Family:** D. Developer/OSS · **Default duration:** ~13s (390f @30fps, scales with contributor count N) · **Format:** 16:9 · **Vibe:** tech

An OSS repo announcement: establish the repo name, count up stars and forks, reveal the contributor community, show the install command, close on a GitHub CTA. The traction numbers are the story spine — they must land with satisfying momentum, not slide by as decoration.
Read `../anatomy.md` first; pick components from `../components/index.md`.

## Beats

Five-beat structure: Positioning (repo name) → Proof (stars/forks) → Proof (contributors) → Product reveal (install) → CTA. The contributors scene scales with N: `clamp(90, 90 + N×4, 180)` frames; default N≈48 → 90f. Total default: ~390f minus transition overlaps (~72f combined) ≈ 390f net.

**Long variant — Q&A cadence (avoid over-long slop):** For repos with a richer story, replace the RepoTitle beat with a question→answer rhythm: "Open source?" → "Yes." / "Battle-tested?" → "Yes." / "Free forever?" → "Yes." — three quick `text-build` + `text-swap` swaps before the stars beat. Avoids the enumeration trap. Reference `good_06` (shadcn-sidebar, ~117s) demonstrates this cadence at scale.

| Frames (default) | Beat | What happens |
|---|---|---|
| 0–90f | **RepoTitle** | `owner/repo` name large centered via `text-reveal` (stagger 2f/char); one-line tagline `text-reveal` at 12f delay; scene exits via `text-reveal` |
| 90–195f | **StarsTraction** | `follower-rush` entrance: star icon `text-reveal`, count rolls up to value; forks and issues a number component you build cascade 8f apart; `text-highlight` sweeps the star count at peak |
| 195–285f | **Contributors** | `contributors-grid` (build new) waves in avatar tiles staggered by index; "N contributors" heading via a number component you build |
| 285–360f | **InstallLine** | `terminal-simulator` types install command char by char; output line enters via `text-reveal`; green checkmark `text-reveal` |
| 360–390f | **CTA** | "Star it on GitHub" text `text-reveal`; repo URL and button `text-reveal`; a soft light sits behind the button |

Transitions: RepoTitle→Stars `text-swap` (spring, 20f); Stars→Contributors `@remotion/transitions` left (linear, 18f); Contributors→Install `@remotion/transitions` (24f); Install→CTA `@remotion/transitions` (spring, ~15f).

## Beat → slots

| Beat | Catalog components | New component needed |
|---|---|---|
| RepoTitle | `text-reveal` (repo name), `text-reveal` (tagline), `text-reveal` (exit), a solid theme background (bg) | — |
| StarsTraction | `follower-rush` (stargazer fly-through + odometer), a number component you build (forks, issues cascade), `text-highlight` (count emphasis at peak) | — |
| Contributors | a number component you build (contributor count heading) | **`contributors-grid`** — wave of avatar tiles; `avatars: {avatarUrl: string; login?: string}[]`, `columns?: number` (auto), `stagger?: number` (3f default), `shape?: 'circle' \| 'rounded'` (default circle), `maxVisible?: number` (overflow folded into "+N" chip); each tile spring scale+opacity, stagger by index; seek-safe, no side-effect clocks (anatomy §1) |
| InstallLine | `terminal-simulator` (typed command + output lines), `text-reveal` (output text), `text-reveal` (checkmark icon) | — |
| CTA | `text-reveal` (headline), `text-reveal` (URL + button), a solid theme background (base bg) | **`cta-scene`** — reusable CTA wrapper (label + URL chip + button slot); not in catalog, build as lightweight transparent component (anatomy §1) |

For the long Q&A variant: `text-build` (question line), `text-swap` (question→answer swap) — both catalog; no new component needed.

## Content contract (infer → ask → placeholder)

| Field | Required | Notes |
|---|---|---|
| `repo` | yes | `owner/repo` — infer from `package.json` `"repository"` or current git remote |
| `tagline` | yes | one-line description — infer from GitHub API `description` or `package.json` `"description"` |
| `stars` | yes | infer from `GET /repos/{owner}/{repo}`; animate from 0 to value |
| `forks` | no | infer from same API response; omit if zero |
| `issues` | no | open issue count from API; omit if repo disables issues |
| `contributors[]` | yes | `{avatarUrl: string; login?: string}[]` — infer from `GET /repos/{owner}/{repo}/contributors?per_page=24`; fold remainder into "+N" chip |
| `installCmd` | yes | infer from `package.json` `"name"` → `npm install <name>`; use `npx shadcn add @<scope>/<name>` for shadcn-registry repos |
| `ctaLabel` | no | default `"Star it on GitHub"` |
| `ctaUrl` | yes | full GitHub repo URL |
| `accent` | no | one color; default `#FFD23F`; applied to star count, terminal checkmark, CTA button — nowhere else |
| `font` | no | default `Geist Mono`; monospace reinforces the dev context |

## Notes

- **One accent only.** The accent touches exactly three elements: the peak star count, the terminal checkmark, and the CTA button. Tagline, contributor heading, and output lines stay neutral.
- **Background: a solid theme background or a slow muted shader throughout.** A static a solid theme background (~0.06) or a slow, muted shader (a solid theme background) at low `speed` — kept low so it never competes with content. CTA beat lifts the button with a soft, motivated light — a structured editorial card, not a glow blob.
- **Star count is the number payoff.** `follower-rush` exists for exactly this beat — it provides the stargazer fly-through plus the odometer. A bare a number component you build on its own misses the moment.
- **Contributors must feel like people arriving, not a grid being filled.** The diagonal wave entrance (stagger by index) creates a sense of community assembling. Cap visible tiles at 24; fold the rest into a "+N" chip rather than shrinking avatar size.
- **Terminal output: 2–3 lines max.** Command line, one confirmation output (`✓ added 1 package in 2s`), and the checkmark. A wall of npm install output is slop — `terminal-simulator` can render more, but don't.
- **`contributors-grid` must be seek-safe.** Compute each tile's animation purely from `frame` and index; no `useState`, `useEffect`, or real-time clocks. See anatomy §1.
- **`cta-scene` is not in the catalog.** Build it as a lightweight transparent wrapper (label `string`, url `string`, buttonLabel `string`) consistent with anatomy §1. Reusable across all D-family archetypes.
