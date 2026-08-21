# snapcn

A shadcn registry of ready-made animations, transitions, and backgrounds for Remotion.

## What it is

A set of production-ready components for building videos in Remotion. Users install components with `npx shadcn@latest add @snapcn/<component>` and assemble videos from prebuilt blocks.

## Target audience

Solo builders and small teams (1–2 people) — frontend developers familiar with the shadcn ecosystem. Typical scenario: you shipped a product, you need a demo video, you grab snapcn.

## Repo layout

A single flat Next.js app (no monorepo):

- `app/` — Next.js App Router: landing page (`app/(home)/`) and docs (`app/docs/`, powered by fumadocs)
- `components/` — site UI components (previews, customizer, layout)
- `registry/snap-cn/` — scene components: animations, transitions, backgrounds, compositions
- `registry/snap-cn-ui/` — timeline-driven UI primitives (shadcn-style atoms for video)
- `registry.json` — shadcn registry manifest (built with `pnpm run registry:build`)
- `content/docs/` — MDX documentation pages (fumadocs)
- `scripts/` — Remotion bundling and demo-rendering scripts
- `config/`, `lib/`, `hooks/` — site configuration, analytics, utilities

## Analytics

PostHog, and **only** PostHog — do not add a second tracker. Two places:

- `lib/analytics.ts` — the typed client event map + `useTrackEvent()`. Every
  browser-side event is declared there with the question it answers. Read the
  header comment before adding one; if you can't name the question, don't.
- `lib/analytics-server.ts` + `middleware.ts` — the events that happen outside a
  browser. `/r/<component>.json` is the actual install (what `shadcn add`
  fetches) and is the conversion metric this whole site feeds; `/llms.txt`
  measures the AI-agent channel; `/api/search` records zero-result queries,
  which are component requests in disguise.

Autocapture, pageviews, pageleave, web vitals, exceptions and session replay are
all SDK config in `app/posthog-provider.tsx` — don't hand-roll any of them.
Events are not sent from `pnpm dev`; verify with `pnpm build && pnpm start`.

## Two component tiers

- **Primitives** — individual animations, transitions, backgrounds
- **Compositions** — full scenes assembled from primitives

## Key decisions

- Install namespace: `@snapcn/<component>`, e.g. `@snapcn/text-reveal`. Registered in the shadcn registry directory (shadcn-ui/ui#11386, renamed from `@snap-cn` in #11471), so the CLI resolves it with no setup. Both tiers publish to the same flat `/r/<name>.json` — there is no `@snapcn-ui` namespace; UI primitives are `@snapcn/input`, `@snapcn/caret`
- Remotion is a prerequisite — we don't bootstrap it for users
- Own your code (shadcn philosophy) — files are copied into the user's project
- All components are written from scratch on the Remotion API (`useCurrentFrame()`, `interpolate()`, `spring()`)
- We take inspiration from reactbits.dev ideas but do NOT copy code (their MIT + Commons Clause license forbids porting)
- Site previews use `@remotion/player` — an interactive player in the browser
- License: MIT

## Design system — READ THE SKILL BEFORE YOU WRITE A COLOUR

**Before you write a colour, a border, a shadow, a radius or a font stack into a
registry component: read the `design-system` skill.** snapcn is a *shadcn*
registry — every component lands next to somebody's `Input` and `Button` and has to
belong there. Components **compose** the design system (`SnapCnTheme`, and the
snap-cn-ui primitives' own style contexts like `inputStyleContext`); they do not
re-invent it. The short version:

- **No hand-rolled palettes.** `useSnapCnTheme(theme, mode)`, and take
  `theme?: Partial<SnapCnTheme>` + `mode?: "light" | "dark"` as props.
- **Take a primitive's tokens, not its box.** `inputStyleContext(t)` gives you the
  exact surface the shadcn `Input` paints, so the two cannot drift.
- **A shadow lifted off a reference is lit for that reference's backdrop.** A heavy
  drop shadow that reads as depth on dark violet reads as a grey smear on white.
  shadcn defines a control with a hairline border and a shadow you have to look for.
- **Measure a reference for proportion, not for palette.** Take the shape. Leave the
  paint — it is the reference's brand, not ours.
- **`var(--token)` does not survive a Remotion render.** Animated colours must be
  concrete and interpolated with `mixOklch`.

## Motion quality — READ THE SKILL BEFORE ANIMATING TEXT

**Before you animate a scale/transform on text, pick an easing curve, reach for
`will-change`, or set a `transformOrigin`: read the `motion-quality` skill.** It is
not optional background reading. Every rule in it is a bug that shipped, was
measured on rendered frames, and cost a user their afternoon. The short version,
so you cannot get it wrong even if you skip the skill:

- **Scaled text looks "stuck" because the glyph rasteriser has no vertical
  sub-pixel positioning** — a moving baseline climbs the pixel grid in whole-pixel
  jumps. **Pivot the scale on the baseline** (measure it; don't guess it from
  line-height). Judder 0.284px → 0.014px, direction reversals 29 → 0.
- **Scaled text "shakes" because hinting re-snaps the stems every frame** and the
  letterforms literally change shape. **`text-rendering: geometricPrecision`.**
  Shape drift 3.41% → 0.22%. The slight softness is correct, not blur.
- **`will-change: transform` is right for the Player and wrong for the render.**
  Gate it on `getRemotionEnvironment().isRendering`. `translateZ(0)`,
  `backface-visibility: hidden` and friends are cargo cult — they turn type into a
  bitmap.
- **Aggressive ease-outs (quint/expo) freeze on a frame clock.** A settle worth one
  frame is a settle; a settle worth five frames is a freeze.
- **You cannot see a sub-pixel bug. Render the frames and measure them.** If a user
  says it's still not smooth and your metric says it's fixed, your metric is wrong —
  go find the one that reproduces what they see.

Some scenes are misrepresented by the live `<Player>` and ship a **rendered mp4**
instead (`lib/rendered-demos.tsx`). If you change one of those components,
re-render its demo in the same change: `pnpm run render:previews --only <slug>`.
See CONTRIBUTING.md.

## Business model

Open core. Free primitives and base compositions (MIT). Later: premium blocks and a video builder.

## Commands

```bash
pnpm install              # install dependencies
pnpm dev                  # start the dev server
pnpm run build            # build the site
pnpm run registry:build   # rebuild the shadcn registry output
pnpm run render:previews  # re-render the mp4s in lib/rendered-demos.tsx
pnpm run lint             # biome check
```

Do **not** run a formatter over `registry/snap-cn/registry.json` — it reflows the
whole file. And `registry:build` rewrites every `public/r/*.json`, not just yours.
