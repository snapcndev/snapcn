import type { CheckoutProduct } from "@/lib/plans";

/**
 * Re-exported, not re-declared: the list of products lives in
 * `CHECKOUT_PRODUCTS`, and a second hand-written union here is exactly how
 * `starter_annual` came to be offered by the pricing page and rejected by the
 * checkout route.
 */
export type UpgradeProduct = CheckoutProduct;

/**
 * Start a checkout, from wherever the person decided to pay.
 *
 * One function rather than a button component, because the three places that
 * need it look nothing alike — a pill in the editor toolbar, an item in the
 * account menu, an action on the toast that reports a quota wall — and the only
 * thing they share is this round trip. A component would have forced all three
 * into the same shape; a function lets each one look like where it lives.
 *
 * Deliberately a full navigation rather than a popup: Dodo's checkout is a
 * hosted page, popup blockers eat `window.open` when it is not the direct
 * result of a click handler that has already awaited a fetch, and coming back
 * to a page that reloads is the behaviour people expect from paying.
 */
export async function startCheckout(product: UpgradeProduct): Promise<void> {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ product }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    // 401 is the one worth naming: it means the session went away between the
    // page render and the click, and "sign in" is a useful instruction where
    // "checkout failed" is not.
    throw new Error(
      body?.error ??
        (res.status === 401
          ? "Sign in to upgrade."
          : `Couldn't start checkout (${res.status}).`),
    );
  }

  const { checkoutUrl } = (await res.json()) as { checkoutUrl?: string };
  if (!checkoutUrl) throw new Error("Checkout didn't return a link.");
  window.location.href = checkoutUrl;
}
