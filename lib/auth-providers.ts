/**
 * Client-safe provider identity + labels. Lives apart from `auth.ts` (which is
 * server-only) so client components — the sign-in buttons, the submit dialog —
 * can import these without pulling the server auth config into the client
 * bundle.
 */
export type AuthProviderId = "google" | "github" | "twitter" | "facebook";

/**
 * Auth.js's id for the email magic-link provider.
 *
 * Kept out of `AuthProviderId` on purpose: every OAuth provider is one button,
 * and this one is a form. Widening the union would put an id in `PROVIDER_LABELS`
 * that the button list must then remember to skip.
 */
export const EMAIL_PROVIDER_ID = "resend";

export const PROVIDER_LABELS: Record<AuthProviderId, string> = {
  google: "Google",
  github: "GitHub",
  twitter: "X (Twitter)",
  facebook: "Facebook",
};
