<div align="center">

<h1>snapcn</h1>

<h3>Product demo videos, built in React.</h3>

<p>
The shots a software demo actually needs — AI chat streams, terminal sessions,
device frames, captions — as components you install with the shadcn CLI and own outright.
</p>

<p>
<a href="https://snapcn.dev"><strong>Browse the catalog&nbsp;→</strong></a> &nbsp;·&nbsp;
<a href="https://snapcn.dev/docs">Docs</a> &nbsp;·&nbsp;
<a href="https://snapcn.dev/docs/components">Components</a>
</p>

<p>
<img alt="MIT License" src="https://img.shields.io/github/license/snapcndev/snapcn?style=flat-square&color=blue">
<img alt="Stars" src="https://img.shields.io/github/stars/snapcndev/snapcn?style=flat-square&color=blue">
<img alt="Remotion 4" src="https://img.shields.io/badge/Remotion-4.0-blue?style=flat-square">
</p>

<img src="./public/hero.gif" alt="snapcn components animating" width="100%">

</div>

## Quickstart

You need a Remotion project. Don't have one? `npx create-video@latest` takes about a minute.

```bash
npx shadcn@latest add @snapcn/text-reveal
```

`@snapcn` is in the [shadcn registry directory](https://github.com/shadcn-ui/ui/pull/11471), so the
CLI resolves it with no `registries` entry to add first. The source lands in your repo along with
anything it depends on, and there's no runtime package to keep on your dependency list.

A `create-video` project needs two things before its first `add`: a `components.json`, and the `@/`
alias in both `tsconfig.json` and `remotion.config.ts` — Remotion's bundler does not read `tsconfig`
paths. [Installation](https://snapcn.dev/docs/getting-started/installation) has both files to paste.

```tsx
import { Composition } from "remotion";
import { TextReveal } from "@/components/snap-cn/text-reveal";

export const RemotionRoot = () => (
  <Composition
    id="Intro"
    component={TextReveal}
    durationInFrames={60}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{ text: "Ship it." }}
  />
);
```

## Components

21 components, each with a scrubable preview at [snapcn.dev](https://snapcn.dev).

| Group | Components |
| --- | --- |
| **AI chat input** | `answer-stream` `search-typing` `prompt-zoom` |
| **Screens & devices** | `phone-frame` `laptop-frame` `terminal-simulator` |
| **Text & titles** | `text-reveal` `text-build` `text-swap` `text-swell` `text-highlight` `word-flip` |
| **Captions** | `karaoke-captions` `word-captions` |
| **Scenes** | `hero-launch` `orbit-gallery` `moodboard-reveal` |
| **Logos** | `logo-assemble` `logo-flicker` |
| **Social proof** | `follower-rush` |
| **Effects** | `pulsing-border` |

Alongside them, `snap-cn-ui` — timeline-driven versions of shadcn atoms (`input`, `caret`) that the
scene components paint from, so a text field in your video is drawn from the same tokens as the one
in your app.

## Why snapcn

**It's built for showing software.** Streaming AI answers, a cursor typing into a search field, a
terminal running a build, a phone tilting into frame. These are the shots a product demo is made of,
and they're fiddly enough that most people give up and screen-record instead.

**Your video inherits your design system.** Components take `theme` and `mode` props and resolve
through `SnapCnTheme`, reusing the same surface tokens shadcn's own primitives paint with — so the
UI in the video doesn't drift from the UI in the product.

**The motion is measured, not eyeballed.** Scaled text pivots on its baseline instead of its centre,
and renders with `geometricPrecision`, because glyph rasterisers have no vertical sub-pixel
positioning and hinting re-snaps stems every frame. Both fixes were verified on rendered frames
(judder 0.284px → 0.014px). The details are in [`motion-quality`](./.claude/skills/motion-quality/SKILL.md).

**You own it.** shadcn philosophy: files are copied into your project. Edit anything, upgrade
nothing, no black box.

## Use it with an AI agent

snapcn ships a skill that teaches coding agents the catalog, prop shapes, durations and the motion
rules above — so your agent picks the right component and budgets the timeline instead of inventing
`interpolate()` calls:

```bash
npx skills add snapcndev/snapcn --skill snapcn --yes
```

Agents that read context files instead can pull [`llms.txt`](https://snapcn.dev/llms.txt) or the
full corpus at [`llms-full.txt`](https://snapcn.dev/llms-full.txt).

## Docs

- [Introduction](https://snapcn.dev/docs/getting-started/introduction)
- [Installation](https://snapcn.dev/docs/getting-started/installation)
- [Agent skill](https://snapcn.dev/docs/getting-started/agent-skill)
- [All components](https://snapcn.dev/docs/components)

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). Missing a component you need?
[Open an issue](https://github.com/snapcndev/snapcn/issues) — the roadmap is mostly whatever
people ask for.

## Author

Built by **Sri Nath** — [x.com/SriNath693](https://x.com/SriNath693)

## License

[MIT](./LICENSE)
