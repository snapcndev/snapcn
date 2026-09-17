/**
 * Real posts about snapcn, pulled from X.
 *
 * Every entry is a real public post — `url` is the source, `quote` is that
 * post's own words. Nothing here is written by us, which is the only thing
 * that makes a wall like this worth having.
 *
 * ## Quoting policy
 *
 * `quote` is verbatim, with three mechanical edits and no others:
 *   - `t.co` shortlinks dropped (they render as noise and the card already
 *     links to the post),
 *   - a leading `@handle` dropped when the post is a reply,
 *   - a trailing `…` where X itself cut the text off, or where we kept the
 *     opening of a long post. The card links out, so the full text is one
 *     click away — but the ellipsis has to be there, or we are quoting
 *     someone as having finished a sentence they did not.
 *
 * Posts are not translated. Half of these are in Spanish, Portuguese or
 * Chinese and they stay that way: a translated quote is our words in
 * someone else's mouth. `lang` is set per card so screen readers and font
 * fallback both get it right.
 *
 * ## Avatars
 *
 * Copied into `public/wall-of-love/` rather than hotlinked from
 * `pbs.twimg.com` — hotlinking needs a `remotePatterns` entry, and it breaks
 * silently the day someone changes their profile picture.
 *
 * ## Verified
 *
 * `verified` is X's own `user.is_blue_verified`, read off the post — not a
 * judgement of ours about who is worth a badge. Two of the nine below do not
 * have one, and they keep their card exactly as it is: a wall that only shows
 * the flag when it is really there is worth something, and one that decorates
 * every card is worth nothing.
 *
 * To add a post: append an entry. Fetch the fields with
 * `https://cdn.syndication.twimg.com/tweet-result?id=<status id>&token=a` —
 * `user.is_blue_verified` is the badge, `user.name` the display name — and save
 * the author's `profile_image_url_https` (swap `_normal` for `_400x400`) into
 * `public/wall-of-love/<handle>.jpg`.
 */
export interface WallPost {
  /** X handle, without the `@`. Doubles as the avatar filename. */
  handle: string;
  /** Display name as it appears on the post. */
  name: string;
  /** BCP-47 tag for the quote — set on the element, not just for show. */
  lang: string;
  /** ISO date of the post, for the `<time>` element. */
  date: string;
  url: string;
  quote: string;
  /** X's `user.is_blue_verified` at the time the post was added. */
  verified?: boolean;
  /** Who they are, when that is the reason the quote matters. */
  role?: string;
}

/**
 * The quote above the hero and the pricing cards — from the person who made
 * Remotion, which is the endorsement a Remotion registry can least argue with.
 *
 * Only the post's first sentence, and without a trailing `…`: it is a whole
 * sentence, and the rest of the post ("We wanna collaborate, will reach out
 * soon!") is a separate thought, not the end of this one. The reply's leading
 * `@blessed_ux @Remotion` is dropped per the policy above. Not in `WALL_POSTS`,
 * so the wall below keeps its own set.
 */
export const FEATURED_POST: WallPost = {
  handle: "JNYBGR",
  name: "Jonny Burger",
  role: "Creator of Remotion",
  lang: "en",
  date: "2026-08-24",
  url: "https://x.com/JNYBGR/status/2091908167370215696",
  quote: "Snapcn actually has very nice components.",
  verified: true,
};

export const WALL_POSTS: readonly WallPost[] = [
  {
    handle: "nett0eth",
    name: "Nett0",
    lang: "pt",
    date: "2026-08-18",
    url: "https://x.com/nett0eth/status/2089765497201983501",
    quote:
      "esse repositório aqui está em outro nível 🤯\ne é tudo de graça\n\n20 componentes de Remotion, prontos pra copiar e colar no teu projeto: título animado, logo sting e mockup de tela. roda com um comando CLI\n\nsem conta, sem chave, sem plano pago",
    verified: true,
  },
  {
    handle: "appariciojunior",
    name: "AJ",
    lang: "pt",
    date: "2026-08-20",
    url: "https://x.com/appariciojunior/status/2090392089976537504",
    quote: "eitaaaaaaaaa, biblioteca premium aqui hein",
    verified: true,
  },
  {
    handle: "ricouii",
    name: "RicoUI",
    lang: "zh",
    date: "2026-08-20",
    url: "https://x.com/ricouii/status/2090263283320443045",
    quote:
      "Snapcn 这个 Remotion 视频方案比 Skills 稳定多了\n\n简单的说就是视频模板，不过是用代码实现精准的动效动画，然后渲染视频。现在把素材库抽离出来，方便直接更换素材，简单但效果稳定。\n\n目前内置 22 个视频模板，侧重产品演示，有非常大的扩展空间，我先 fork 过来二开！",
    verified: true,
  },
  {
    handle: "Easycompany333",
    name: "Easycompany",
    lang: "zh",
    date: "2026-08-19",
    url: "https://x.com/Easycompany333/status/2089935106438033461",
    quote:
      "做产品演示视频时，最磨人的经常是那几秒镜头：AI 回复逐字出现、终端命令滚动、手机框入场、字幕跟着声音走。\n\nSnapCN 把这些镜头做成了可复制的 React 组件。你可以把它理解成「视频版 shadcn/ui」…",
    verified: true,
  },
  {
    handle: "TellusCoop",
    name: "Tellus Cooperative 🌎",
    lang: "es",
    date: "2026-08-24",
    url: "https://x.com/TellusCoop/status/2091877130992820268",
    quote:
      "Crea videos de demostración de productos con código.\nsnapcn ofrece componentes para Remotion, facilitando la creación de videos profesionales.\n→ Componentes listos para efectos de texto, marcos de dispositivos y terminales…",
    verified: true,
  },
  {
    handle: "TheTechDiggest",
    name: "AI Tech Diggest",
    lang: "en",
    date: "2026-08-20",
    url: "https://x.com/TheTechDiggest/status/2090341940810191256",
    quote:
      "Stop manually editing product videos and start generating programmatic animations directly inside your React codebase today.",
    verified: true,
  },
  {
    handle: "crytonbuton",
    name: "Cryton",
    lang: "en",
    date: "2026-08-21",
    url: "https://x.com/crytonbuton/status/2090701990464528724",
    quote:
      "The copy-paste model is interesting because it turns video design into reusable code instead of another specialized editing workflow.",
  },
  {
    handle: "yyyole",
    name: "沐阳",
    lang: "zh",
    date: "2026-08-20",
    url: "https://x.com/yyyole/status/2090318175959437645",
    quote: "转需！应该能用到！\n一键就能调用的 Remotion 动效组件！！",
    verified: true,
  },
  {
    handle: "maximedesogus",
    name: "Maxime De Sogus",
    lang: "en",
    date: "2026-09-02",
    url: "https://x.com/maximedesogus/status/2095141743825957288",
    quote:
      "Not bad, with more time, I think result can be very good. Made with @snapcndev + Fable 5",
  },
] as const;
