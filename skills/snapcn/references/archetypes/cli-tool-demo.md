# cli-tool-demo

**Family:** D. Developer/OSS · **Default duration:** ~45s (1350f @30fps, short ~18s/540f) · **Format:** 16:9 · **Vibe:** tech

Demo a CLI or dev tool by running a real command to a visible result. The terminal is the product surface — show a
believable command typed, output streaming line by line as instant steps, and the final artifact or success state.
Two variants: short (social clip, grounded in a strong ~18s reference demo) and standard (launch / conference ~43s).
Read `../anatomy.md` first; pick components from `../components/index.md`.

## Beats

### Short (~18s / 540f)

`hook → terminal run → result → sign-off`

| Frames | Beat | What happens |
|---|---|---|
| 0–90 | **Hook** | Value line builds word by word; one accent word lands; generous whitespace |
| 90–360 | **Terminal run** | Terminal types the command char by char; output lines appear as instant step-function steps (~6f apart); final `✓ Done` line highlighted |
| 360–480 | **Result** | Success callout — a metric, file count, or elapsed time — lands with the accent; plain dark hold if no visual artifact |
| 480–540 | **Sign-off** | Logo cluster on calm dark hold |

Transitions: hook→terminal `@remotion/transitions` down (20f); terminal→result `text-swap` (spring, terminal recedes into depth); result→sign-off `text-swap` (16f).

### Standard (~45s / 1350f)

`hook → agent chat → terminal run → value line → result reveal → sign-off`

| Frames | Beat | What happens |
|---|---|---|
| 0–150 | **Hook** | Problem statement or bold positioning line — kinetic word-by-word build, one accent |
| 150–420 | **Agent chat** | Prompt typed in the matching agent surface; cursor blinks; response or task list begins streaming |
| 420–900 | **Terminal run** | Command types in; progress output scrolls as instant step-function steps; numbers (file count, elapsed ms) tick up; final success line highlighted in green |
| 900–1050 | **Value line** | Outcome statement — "All finished" / "Don't get blocked by your machine" style; per-word swap or kinetic build; accent on the key phrase |
| 1050–1260 | **Result reveal** | Pipeline steps completing OR result artifact visible; plain dark hold if result needs no visual |
| 1260–1350 | **Sign-off** | Logo cluster fades in on dark hold |

Transitions: hook→chat `text-swap` (16f); chat→terminal `@remotion/transitions` down (20f); terminal→value-line `text-swap` (spring, terminal recedes into depth); value-line→result `@remotion/transitions` (24f); result→sign-off `text-swap` (16f).

## Beat → slots

| Beat | Catalog components | New component needed |
|---|---|---|
| Hook | `text-build` (headline), `text-highlight` (accent word), a solid theme background (0.06 opacity static bg) | — |
| Agent chat | `v0` / `answer-stream` (match the tool's ecosystem), `cursor` (pointer to input field) | — |
| Terminal run | `terminal-simulator` (hero — scroll is an instant step-function, never eased), `text-reveal` (output rows, 6f apart), a number component you build (inline numbers — file count, elapsed time), `text-highlight` (green sweep on the final `✓` line) | — |
| Value line | `text-swap` (A→B two-phrase swap) or `text-build` (single statement build), `text-highlight` (accent phrase) | — |
| Result — pipeline | `stepper` (CI/pipeline steps completing) | — |
| Sign-off | `logo-assemble` (logo cluster), `text-reveal` (product name label) | — |

## Content contract (infer → ask → placeholder)

| Field | Required | Notes |
|---|---|---|
| `toolName` | yes | Product name, e.g. `vercel-snap`, `vite`, `snapcn` |
| `tagline` | yes | One phrase — what the tool does in plain language |
| `command` | yes | Exact shell command to type, e.g. `npx vercel-snap build --prod` |
| `outputLines[]` | yes | 3–6 log lines; last line is the success line (prefix `✓`); include 1–2 numbers (file count, time) for a number component you build; never real transcript walls |
| `resultType` | yes | `"pipeline"` → `stepper`; `"metric"` → a number component you build + label; `"none"` → skip result beat |
| `agentSurface` | no (standard only) | `"v0"` \| `"claude-chat"` — omit to skip the chat beat entirely |
| `prompt` | no (standard only) | Prompt text typed in the agent surface when `agentSurface` is set |
| `hookLine` | no | Override the hook headline; defaults to `tagline` |
| `accent` | no | One hex; default `#22D3A6`; applied to success line highlight, accent word, logo — nowhere else |
| `font` | no | Monospace font for the terminal; default `JetBrains Mono` |
| `logo` | no | Path or URL for sign-off; omit for text-only wordmark via `text-reveal` |

## Notes

- **Terminal scroll is a step-function, never eased.** Each output line appears at its exact frame — no interpolated opacity ramp on the terminal window or its scroll position. Easing belongs to the value line and scene transitions, not the log stream. This is a hard constraint of `terminal-simulator`.
- **Show 3–6 output lines maximum.** Pick the most readable step names and the success line; cut everything else. A wall of log text reads as noise, not credibility.
- **Numbers inside the output use a number component you build inline.** File count, elapsed time, bundle size — these small payoffs make the terminal feel live. One or two numbers per output section; not every line.
- **One accent color throughout.** The `✓ Done` line highlight, the hook's emphasis word, and the logo share exactly one accent. All other text stays neutral mono on dark.
- **Background can move — keep it restrained.** A slow, muted shader (a solid theme background) at low `speed`, a a solid theme background at 0.06 opacity, or a solid theme fill. The terminal is the focal point — if the background moves, keep it low and muted so it never competes with the terminal.
- **Agent chat beat is optional.** Include it in the standard variant when the tool is AI-powered or agentic. Skip it (and use the short structure) when the tool is a pure CLI with no AI surface — adding a chat beat to a Rust CLI just to fill time is slop.
- **Pick the agent surface to match the tool's ecosystem.** A Claude-powered tool → `answer-stream`. A web-generation tool → `v0`. Mismatching brand surfaces undermines credibility.
