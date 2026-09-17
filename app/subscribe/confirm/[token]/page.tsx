import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { CommandLine } from "@/components/command-line";
import { MailLinkPage } from "@/components/mail-link-page";
import { PRO_SAMPLE } from "@/lib/plans";
import { sendEmail, welcomeSubscriberEmail } from "@/lib/server/email";
import { sampleInstallUrl } from "@/lib/server/pro-sample";
import { confirmSubscription } from "@/lib/server/subscription";

export const metadata: Metadata = {
  title: "Confirm your subscription",
  // A URL that carries a secret in its path has nothing to gain from being
  // crawled and everything to lose.
  robots: { index: false, follow: false },
};

/**
 * The second half of the double opt-in, and the only place a row becomes real.
 *
 * ## A GET that writes
 *
 * Normally a mistake, and here it is the only option: the link is in an email
 * and a mail client can only follow it one way. It is safe because
 * `confirmSubscription` is idempotent — and because the *unsubscribe* link, the
 * one where a scanner's automatic GET would do real damage, is deliberately not
 * built this way. See `subscriptionUrls`.
 *
 * The welcome mail goes out from here rather than from the query, so the
 * database module keeps no opinion about email, and it goes out in `after()` so
 * the reader is looking at the confirmation before the SMTP round-trip starts.
 */
export default async function ConfirmSubscriptionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // A database blip must not read as "your link is broken" — but there is no
  // honest third message here either, and telling somebody they are subscribed
  // when the write failed is the one lie that matters. `unknown` invites a
  // retry, which is the only useful thing they can do.
  const result = await confirmSubscription(token).catch((err) => {
    console.error("[subscribe/confirm] failed:", err);
    return { outcome: "unknown" } as const;
  });

  if (result.outcome === "confirmed") {
    const sample = sampleInstallUrl(result.id);
    after(() =>
      sendEmail(welcomeSubscriberEmail(result.email, result.token, sample)),
    );
    return (
      <MailLinkPage title="You're on the list.">
        <p className="mt-2 text-sm text-muted-foreground">
          New components as they ship, no more than one email a week. Every one
          of them carries an unsubscribe link.
        </p>
        {sample ? <FreeSample url={sample} /> : null}
      </MailLinkPage>
    );
  }

  if (result.outcome === "already") {
    const sample = sampleInstallUrl(result.id);
    return (
      <MailLinkPage title="You're already on the list.">
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing to do — this link was already used.
        </p>
        {sample ? <FreeSample url={sample} /> : null}
      </MailLinkPage>
    );
  }

  return (
    <MailLinkPage title="That link isn't valid.">
      <p className="mt-2 text-sm text-muted-foreground">
        It may have been mistyped, or the subscription it belonged to is gone.
        Sign up again from the site and we will send a fresh one.
      </p>
    </MailLinkPage>
  );
}

/**
 * The free pro component, on the page they are already looking at.
 *
 * The welcome mail carries the same command, but it arrives a moment later in
 * another tab. Somebody who just clicked "confirm" is at their desk with a
 * terminal open — this is the one moment the install is a paste away.
 */
function FreeSample({ url }: { url: string }) {
  return (
    <div className="mt-5 border-border border-t pt-5 text-left">
      <p className="font-medium text-foreground text-sm">
        Your free Pro component: {PRO_SAMPLE.title}
      </p>
      <p className="mt-1 text-muted-foreground text-xs">
        Run this in your Remotion project. It is yours to edit, like any snapcn
        component.
      </p>
      <CommandLine className="mt-3" command={`npx shadcn@latest add ${url}`} />
      <Link
        href="/docs/pricing?ref=confirm"
        className="mt-3 inline-block text-muted-foreground text-xs underline underline-offset-4 hover:text-foreground"
      >
        See the rest of Pro
      </Link>
    </div>
  );
}
