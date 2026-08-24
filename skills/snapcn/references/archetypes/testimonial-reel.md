# testimonial-reel

**Family:** C. Growth & Social Proof · **Default duration:** ~14s (430f @30fps for N=3, scales with quote count) · **Format:** 16:9 · **Vibe:** clean

Cycle real customer quotes one at a time — each card springs in, holds while the quote text plays word-by-word, then fades through to the next. Close on an aggregate proof number ("Join 12,000+ people who found their flow") so the social proof lands on data, not sentiment alone. One accent color throughout; background is a soft, motivated light on a solid dark canvas.
Read `../anatomy.md` first; pick components from `../components/index.md`.

## Beats

Frame math: `total = 60 (intro) + N×90 (quote scenes, 15f fade-through overlap each) + 10 (last-quote hold) + 90 (aggregate close)`. N=3 → 430f (~14s). Cap at N=5 (~600f, ~20s) and fold any extra quotes into "+M more" on the aggregate tagline rather than extending runtime.

| Frames (N=3) | Beat | What happens |
|---|---|---|
| 0–60 | **Intro** | Section title "What teams say" builds via `text-reveal`; thin horizontal divider enters via `text-reveal` (left → right, 20f) |
| 60–165 | **Quote 1** | `testimonial-card` springs up (translateY 40→0, `spring({damping:18,mass:0.9})`); quote text arrives via `text-swap` (4f/word stagger); avatar + author/role enter via `text-reveal` (2 elements, 6f stagger); 2 peek cards behind at scale 0.94 / opacity 0.5 |
| 150–255 | **Quote 2** | `text-swap` swap (15f overlap); author-line enters via `text-reveal`; peek stack shifts depth |
| 240–355 | **Quote N** | Last quote holds +10f longer; peek cards resolve to full opacity as the stack empties; `text-reveal` exits the card stack on the way out |
| 345–435 | **Aggregate close** | `text-reveal` enters the metric block; a number component you build counts to the aggregate figure; tagline "Join X+ [phrase]" arrives via `text-reveal`; optional `follower-rush` or `follower-rush` anchors the number in a recognizable social surface |

Transitions: `text-swap` (`linearTiming(15)`) between each quote scene; intro → Quote 1 via `springTiming({damping:200})`; Quote N → aggregate via `text-swap` (15f).

## Beat → slots

| Beat | Catalog components | New component needed |
|---|---|---|
| Intro | `text-reveal` (title), `text-reveal` (divider line), `backdrop` (bg) | — |
| Quote cycling | `text-swap` (quote text), `text-reveal` (avatar + author/role), `text-reveal` (author-line on swap), `text-swap` (scene transition), `text-reveal` (stack exit) | **`testimonial-card`** — avatar + quote text + name/role; transparent bg; props: `quote`, `name`, `role`, `avatarUrl`; build per `../anatomy.md` §1 |
| Aggregate close | `text-reveal` (metric block entrance), a number component you build (count animation), `text-reveal` (tagline), `follower-rush` or `follower-rush` (optional social anchor) | — |

`testimonial-card` is the only gap in the catalog. The stacking depth effect (peek cards at 0.94 scale / 0.5 opacity behind the active card) is orchestration logic in the parent composition — render 2–3 `testimonial-card` instances with interpolated transform/opacity values; no separate stack container component is needed.

## Content contract (infer → ask → placeholder)

| Field | Required | Notes |
|---|---|---|
| `quotes[]` | yes | `{ quote: string; name: string; role: string; avatarUrl?: string }` — 3–5 entries; infer from testimonials page, G2, or press quotes |
| `aggregate` | yes | `{ value: number; label: string }` — e.g. `{ value: 12000, label: "people who found their flow" }`; infer from marketing site or README; never fabricate a number |
| `sectionTitle` | no | Default `"What teams say"`; swap to match brand voice |
| `brand` | no | `{ accent, background }` — one accent on a neutral dark canvas |
| `socialAnchor` | no | `"x-followers" \| "github-stars" \| null` — which catalog social surface to pair with the aggregate close |

`[N]` archetype: quote scenes stretch linearly with quote count; cap at N=5 visible quotes and fold any excess into "+M more" on the aggregate tagline rather than extending runtime or compressing type.

## Notes

- **Background: a soft directional light or a slow muted shader on a solid dark base.** A single soft light tracking the active card gives depth; a slow, muted shader (a solid theme background) at low `speed` is the alternative for ambient motion. Keep it muted and gentle behind the quote text — no glow blob or radial halo, and never a solid theme background.
- **One accent only.** Apply it to the a number component you build payoff and optionally to one emphasized word per quote via `text-highlight`. Everything else is neutral mono.
- **No glow halos behind quote text.** Depth is conveyed by the peek-card scale/opacity stack (0.94 / 0.5) — that is sufficient.
- **Real quotes, specific attribution.** "Marcus L., Head of Growth at Loom" beats "User, Company". If avatars are unavailable, render initials in a neutral mono circle — never use stock headshots.
- **N cap.** Beyond five quotes the runtime exceeds ~20s; split into a second reel or cut entries. Never extend by shrinking type or compressing hold time.
- **`testimonial-card` stays transparent.** Set the background via `Backdrop` in the example composition, not inside the card itself.
