# product-demo

**Family:** A. Product & Launch · **Default duration:** ~45s standard (1356f @30fps) · **Format:** 16:9

The flagship archetype, fully worked. A product demo tells one story: *"X has problem Y; here's the
product solving it; here's proof; here's how to get it."* Built as a raw `<TransitionSeries>` stitching
catalog components, one beat per sequence. Grounded in a corpus of strong real-world product demos.
Read `../anatomy.md` first.

## Step 1 — gather content (infer → ask → placeholder)

Fill this contract. **Infer** from the repo first (`README`, landing copy, `package.json`), then **ask**
the user only for what's missing, then fall back to honest English placeholders. Never block on missing data.

| Field | Required | Notes |
|---|---|---|
| `product.name` | yes | wordmark for positioning + outro |
| `product.oneLiner` | yes | the positioning line ("AI-Powered Work Operating System") |
| `hook` | yes | the problem/bold line ("Your team has tasks everywhere"); can derive from oneLiner |
| `features[]` | yes (2–4) | `{ title, sub }` each — one concrete capability per item |
| `productSurface` | no | which UI to show: `chat` \| `terminal` \| `dashboard` \| `planning` \| free description → fallback `terminal-simulator` or a new `ui-frame` |
| `proof` | no | `{ metric: {label, value} }` and/or `{ testimonials: {quote,name,role}[] }` and/or `{ integration }` |
| `cta` | no | `{ line, domain }` or `{ line, command }` |
| `brand` | no | `{ accentColor, vibe }` → default neutral + one accent; pick `vibe` to match (`tech`/`premium`/`clean`/`data`/`social`) |

## Step 2 — pick the duration variant

| Variant | Length | Frames @30fps | Beats | Reference |
|---|---|---|---|---|
| **Short** | ~18s | ~540 | Hook → Product reveal → Positioning/CTA | a strong CLI-tool demo (18s) |
| **Standard** | ~45s | ~1356 | all 6 | the strongest SaaS reference demos (42–45s) |
| **Long** | 90s+ | — | many features | only with a strong repeating rhythm (Q&A cadence); else split into several videos. A flat 100s feature-list drags — that is the slop trap. |
| **Bumper** | ~4–5s | ~135 | Positioning → lockup only | a logo sting; see `logo-bumper.md`. Not a full demo — a brand insert. |

## Step 3 — map beats to component slots

Pick one slot per beat from these candidates (full props in each `../components/<name>.md`):

| Beat | Slot candidates | Notes |
|---|---|---|
| **Hook** | `text-build`, `text-reveal`, `text-swap`, `text-reveal` over a slow muted shader (a solid theme background), a solid theme background, or solid | emphasize ONE word with the accent, sentence case |
| **Positioning** | `text-reveal` / `text-build` for the line and wordmark; `logo-assemble` for a brand/partner logo cluster (not a single lockup) | resolve text into the brand mark; a single styled lockup may be a small new component |
| **Product reveal** | `terminal-simulator`, `terminal-simulator`; AI surfaces `answer-stream`/`v0`; add `cursor` | if the catalog lacks the exact surface, build a new lightweight `ui-frame` (see `../anatomy.md` §1) |
| **Features** | `stepper` (checklist), a chart you build / a chart you build, `text-swap` for a "designed to ___" swap, `text-highlight` / `text-highlight` for emphasis, a chart you build | one concrete moment per feature, 2–4 total |
| **Proof** | a number component you build / a number component you build / a number component you build for a score; a chart you build; `follower-rush` / `follower-rush` for social counts; a testimonial card (compose or build new) | land one number with the accent |
| **CTA** | `text-swap` / `text-build` closer, `terminal-simulator` for a run-this command, `text-reveal` for a pill, `logo-assemble`, `confetti` (one accent pop) | one ask + where to go |
| **Transitions** | `@remotion/transitions` (going deeper), `text-swap` (neutral cut), `@remotion/transitions`, `text-swap` | wrap two scenes via `from`/`to` |

Budget each `<TransitionSeries.Sequence durationInFrames>` around the component's natural length
(`Length` in `../components/index.md`). Standard ~45s split: Hook 165 · Positioning 120 · Product reveal
150 · Features 450 (across 2–4) · Proof 300 · CTA 171.

## Step 4 — assemble (raw `<TransitionSeries>`)

Standard variant skeleton. Swap the slot components and content for the gathered contract. Install each
picked component first (`shadcn add @snapcn/<name>`); deps auto-install.

```tsx
import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { TextBuild } from "@/components/snap-cn/text-build";
import { TextReveal } from "@/components/snap-cn/text-reveal";
import { TerminalSimulator } from "@/components/snap-cn/terminal-simulator";
import { StatusCycle } from "@/components/snap-cn/status-cycle";
import { FollowerRush } from "@/components/snap-cn/follower-rush";
import { TextHighlight } from "@/components/snap-cn/text-highlight";

const ACCENT = "#F2D200";
const beat = { presentation: fade(), timing: springTiming({ durationInFrames: 18 }) };

export const ProductDemo = () => (
  <AbsoluteFill style={{ background: "#FAF8EC" }}>
    <TransitionSeries>
      {/* Hook — 75f is text-build's natural length */}
      <TransitionSeries.Sequence durationInFrames={75}>
        <TextBuild text="Your team has tasks everywhere" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition {...beat} />

      {/* Positioning — 90f */}
      <TransitionSeries.Sequence durationInFrames={90}>
        <TextReveal text="One place for the work" />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition {...beat} />

      {/* Product reveal — 200f */}
      <TransitionSeries.Sequence durationInFrames={200}>
        <TerminalSimulator command={{ text: "npx acme init" }} zoom />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition {...beat} />

      {/* Features — status-cycle's act two lists them as chips. 150f */}
      <TransitionSeries.Sequence durationInFrames={150}>
        <StatusCycle
          prefix="Acme is"
          statuses={["planning", "tracking", "shipping"]}
          chips={["AI workflow setup", "Metrics audit", "Content calendar"]}
        />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition {...beat} />

      {/* Proof — 300f */}
      <TransitionSeries.Sequence durationInFrames={300}>
        <FollowerRush totalFollowers={12000} accentColor={ACCENT} />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition {...beat} />

      {/* CTA — 56f */}
      <TransitionSeries.Sequence durationInFrames={56}>
        <TextHighlight before="Start free at " highlight="acme.com" preset="marker" />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
```

Background stays on the outer `AbsoluteFill` (one accent on a neutral canvas); components render
transparent. No animated-background component ships — if a solid fill is too flat, add
`pulsing-border` as an overlay or build your own backdrop; keep it muted so it never fights the
foreground. Every `durationInFrames` above is that component's natural length — change the content,
not the budget, unless you have checked the new length in `../components/<name>.md`.

## Step 5 — check against the bar

Before delivering, run the good/slop checklist in `../anatomy.md` §3: one accent, sentence-case kinetic
type, real content (no `Scene A` lorem), no glow halos, no feature-list enumeration, no a solid theme background,
legible text, story not catalog. Budget frames so nothing clips and there's no dead air.
