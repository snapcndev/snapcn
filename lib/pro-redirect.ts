/**
 * Where an old `/pro` address goes now that `/docs/pricing` is the one pricing
 * page.
 *
 * `/pro` cannot 404: the 402 printed `/pro?c=<name>&ref=cli` into terminals,
 * emails and the MCP carry it, and none of those can be edited. So each shape
 * goes where its reader was headed:
 *
 * - `?checkout=done` — a buyer back from Dodo, who wants their key: `/account`.
 * - `?c=<pro slug>` — "watch it and see how to get it": that component's own
 *   page, which has the video, the price and the free-sample link.
 * - anything else — `/docs/pricing`.
 *
 * `ref` survives every hop, so an install that started in a terminal is still
 * attributed to the terminal. The `#plans` / `#free` fragment is kept by the
 * browser across the redirect, and both ids exist on the pricing page.
 */
export function proRedirect(
  params: { c?: string; ref?: string; checkout?: string },
  proHref: (slug: string) => string | undefined,
): string {
  const ref = params.ref ? `?ref=${encodeURIComponent(params.ref)}` : "";
  if (params.checkout === "done") return "/account?checkout=done";
  const href = params.c ? proHref(params.c) : undefined;
  return `${href ?? "/docs/pricing"}${ref}`;
}
