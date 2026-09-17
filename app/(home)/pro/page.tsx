import { permanentRedirect, redirect } from "next/navigation";
import { ITEM_BY_SLUG } from "@/lib/gallery-data";
import { proRedirect } from "@/lib/pro-redirect";

/**
 * `/pro` used to be a second pricing page. There is one now, `/docs/pricing`,
 * and keys live on `/account` — this only forwards the addresses already
 * printed into terminals and emails. See `proRedirect` for where each goes.
 */
export default async function ProPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; ref?: string; checkout?: string }>;
}) {
  const params = await searchParams;
  const to = proRedirect(params, (slug) => {
    const item = ITEM_BY_SLUG.get(slug);
    return item?.pro ? item.href : undefined;
  });
  // Temporary for the checkout return: that one is a moment, not an address.
  if (params.checkout === "done") redirect(to);
  permanentRedirect(to);
}
