import { permanentRedirect } from "next/navigation";
import { PRO_NAMES } from "@/config/site";
import { ITEM_BY_SLUG } from "@/lib/gallery-data";

/**
 * The address a paid component's gallery card used to point at.
 *
 * Cards now link to the component's own page, `/docs/<category>/<slug>` — see
 * `PRO_GALLERY_ITEMS`. This stays so a `/pro/<slug>` somebody already copied
 * lands on that page, or on pricing when there is no CDN and so no page.
 */
export function generateStaticParams() {
  return PRO_NAMES.map((slug) => ({ slug }));
}

export default async function ProComponentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = ITEM_BY_SLUG.get(slug);
  permanentRedirect(item?.pro ? item.href : "/docs/pricing");
}
