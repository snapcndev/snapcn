import "server-only";
import { PRO_ITEMS } from "@/config/site";
import { PRO_SAMPLE } from "@/lib/plans";
import { isSuppressed } from "@/lib/server/suppression";

/**
 * Transactional email — one `fetch` to Resend's REST API, no SDK.
 *
 * Same reasoning as `lib/analytics-server.ts`: the only thing a mail SDK adds
 * over a single POST is a dependency, a bundle, and its own opinion about
 * retries inside a serverless function that can be frozen the moment it
 * returns. One awaited request has no queue to lose.
 *
 * ## It never throws
 *
 * Every caller is a side effect of something that already succeeded — a row is
 * in the database, an account exists. A mail failure must not turn that into a
 * 500 for the user, so this returns a boolean and logs. Callers wrap it in
 * `after()` so the response does not wait on it either.
 *
 * ## Not configured is a valid state
 *
 * With no `RESEND_API_KEY` the whole thing is a no-op that returns false,
 * matching `isDbConfigured` — `pnpm build` and a fresh clone work with zero
 * setup, and a missing key degrades to "no welcome mail" rather than a crash.
 */

const API_KEY = process.env.RESEND_API_KEY;

/**
 * `EMAIL_FROM` must be on a domain verified with Resend, or every send 403s.
 * Defaulted rather than required so the failure, when it comes, is one clear
 * message from the API instead of a `undefined` in the payload.
 *
 * This one is the **transactional** sender: sign-in links, the account welcome,
 * the admin alert. Mail somebody is waiting for.
 */
const FROM = process.env.EMAIL_FROM ?? "snapcn <hello@snapcn.dev>";

/**
 * The **bulk** sender, and the reason it is a separate variable.
 *
 * A newsletter earns spam complaints. That is not a failure of the newsletter —
 * it is what a list does — but every complaint is scored against the sending
 * domain, and the sign-in link shares that domain. Left as one address, a bad
 * campaign is not "fewer people read the newsletter", it is "customers cannot
 * log in", and the two are impossible to tell apart from the inside.
 *
 * So the list gets its own address on its own subdomain (`news@mail.snapcn.dev`
 * with its own DKIM record — see EMAIL_SETUP.md). Defaulted to `FROM` so an
 * unconfigured deployment behaves exactly as it did before this existed.
 */
const NEWSLETTER_FROM = process.env.EMAIL_FROM_NEWSLETTER ?? FROM;

/** True when a key is set. Callers may skip work they only do to send mail. */
export const isEmailConfigured = Boolean(API_KEY);

export interface Email {
  to: string;
  subject: string;
  /** Rendered HTML body. */
  html: string;
  /** Plain-text alternative. Not optional: a body-less text part is a spam
   *  signal, and some readers show nothing at all without it. */
  text: string;
  /**
   * Overrides `EMAIL_FROM`. Only the list sets it — see `NEWSLETTER_FROM`.
   */
  from?: string;
  /**
   * Extra headers, verbatim. This exists for exactly one thing: RFC 8058
   * one-click unsubscribe, which is a header pair and cannot be expressed any
   * other way. Nothing here is inspected, so a template is responsible for what
   * it asks for.
   */
  headers?: Record<string, string>;
}

export async function sendEmail(email: Email): Promise<boolean> {
  if (!API_KEY) return false;

  // Before the network, not after: a bounce we could have predicted is a bounce
  // that counts against the domain every other message here depends on. Fails
  // open when the database is unreachable — see `lib/server/suppression.ts`.
  if (await isSuppressed(email.to)) {
    console.warn(
      `[email] "${email.subject}" not sent: the address is suppressed.`,
    );
    return false;
  }

  const { from, ...rest } = email;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      // `from` first so a template that sets its own wins; `rest` carries the
      // optional `headers` through untouched. `JSON.stringify` drops the key
      // entirely when it is undefined, so an ordinary mail posts the same body
      // it always did.
      body: JSON.stringify({ from: from ?? FROM, ...rest }),
    });

    if (!res.ok) {
      // The body carries Resend's reason (unverified domain, invalid address).
      // Logged, not thrown — see the note at the top of the file.
      console.error(
        `[email] ${res.status} sending "${email.subject}":`,
        await res.text().catch(() => "<no body>"),
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[email] send failed for "${email.subject}":`, err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Templates
//
// Hand-written HTML, because an email is not a web page. Every rule below is a
// thing that breaks if you write it the way you would write a component:
//
// - Tables for the outer frame. Divs centre fine in Gmail and Apple Mail and
//   collapse in Outlook, and Outlook is the one client nobody tests in.
// - Inline styles only. Most clients strip <style> blocks, so a class is a
//   style that works on your machine and nowhere else.
// - Images carry real alt text. Clients block remote images by default, so the
//   logo has to degrade to something readable rather than an empty box — the
//   alt IS the wordmark. Nothing but the logo is an image, so a blocked-image
//   render loses no information at all.
// - A preheader. It is the grey line Gmail prints next to the subject; without
//   one the client grabs the first words of the body, which is why so much mail
//   previews as "View this email in your browser".
// - Colours stated on every element. `prefers-color-scheme` support is uneven
//   and some clients invert unstyled text against a styled background, which is
//   how mail ends up black-on-black.
// ---------------------------------------------------------------------------

/**
 * Where the links in a mail point.
 *
 * A constant, like the eight other `SITE_URL`s in this repo, with one escape
 * hatch the others do not need: a confirm link is the only mail we send whose
 * URL a developer has to be able to *open against their own machine*. Without
 * the override, testing double opt-in locally confirms a row in production.
 */
const SITE =
  process.env.EMAIL_SITE_URL?.trim().replace(/\/+$/, "") ||
  "https://snapcn.dev";

/**
 * The postal address a commercial email is legally required to carry (CAN-SPAM
 * §5, and the equivalent in most other jurisdictions). Rendered in the list's
 * footer when set, omitted when not — a missing address is a compliance problem
 * to fix in the environment, not a reason for the send to fail.
 */
const POSTAL_ADDRESS = process.env.EMAIL_POSTAL_ADDRESS?.trim();

/**
 * Every URL a subscriber row's token addresses, spelled once.
 *
 * Three, not two, and the split matters: `unsubscribe` is a **page** and
 * `unsubscribePost` is an **endpoint**. Mail clients and corporate link
 * scanners GET every URL in a message before a human sees it, so a GET that
 * unsubscribes will unsubscribe people who never clicked anything. The page is
 * safe to fetch and does nothing; the endpoint only acts on POST, which is
 * exactly what RFC 8058 one-click sends and what a scanner never does.
 */
export function subscriptionUrls(token: string): {
  confirm: string;
  unsubscribe: string;
  unsubscribePost: string;
} {
  return {
    confirm: `${SITE}/subscribe/confirm/${token}`,
    unsubscribe: `${SITE}/u/${token}`,
    unsubscribePost: `${SITE}/api/unsubscribe/${token}`,
  };
}

/**
 * The header pair that puts "Unsubscribe" next to the sender's name in Gmail.
 *
 * Required of bulk senders since February 2024, and the single largest lever on
 * whether a list lands in the inbox: it is the *easy* way out, and every
 * recipient who takes it is a recipient who did not press "Report spam"
 * instead. Complaints are the metric Gmail actually enforces (0.3%), and the
 * two buttons are competing for the same click.
 *
 * `List-Unsubscribe-Post` is what makes it one-click rather than one-click-then
 * -a-webpage; without it Gmail shows the link but does not promote it.
 *
 * No `mailto:` alternative, deliberately: `snapcn.dev` publishes no MX, so a
 * mailto in this header is an unsubscribe route that silently bounces. Add it
 * the day the domain can receive mail.
 */
function oneClickUnsubscribe(token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${subscriptionUrls(token).unsubscribePost}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

const C = {
  page: "#faf9f6",
  card: "#ffffff",
  ink: "#141414",
  muted: "#6b6b6b",
  line: "#e7e5e0",
  accent: "#3072db",
  code: "#f2f1ee",
} as const;

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

/** A tappable button. Padded anchor — no VML; the audience reads mail in Gmail. */
function button(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:${C.accent};color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;text-decoration:none;padding:13px 22px;border-radius:10px;">${label}</a>`;
}

function code(text: string): string {
  return `<div style="margin:0 0 20px;padding:13px 15px;background:${C.code};border:1px solid ${C.line};border-radius:10px;font-family:${MONO};font-size:13px;line-height:1.5;color:${C.ink};word-break:break-all;">${text}</div>`;
}

function p(text: string, style = ""): string {
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.62;color:${C.ink};${style}">${text}</p>`;
}

function link(text: string, href: string): string {
  return `<a href="${href}" style="color:${C.accent};text-decoration:underline;">${text}</a>`;
}

/**
 * The frame every message shares: preheader, wordmark, white card, footer.
 *
 * `preheader` is padded with zero-width non-joiners so the client stops pulling
 * body copy into the preview line after it runs out of preheader.
 *
 * ## Two chromes, because Gmail sorts on what a message looks like
 *
 * The tab a message lands in is a *content* decision, not a reputation one:
 * Gmail reads the markup and puts a remote logo, a row of navigation links and
 * a big coloured button in Promotions. That is the correct home for a
 * newsletter and the wrong one for a sign-in link, which is useless to somebody
 * who does not see it within a minute.
 *
 * So transactional mail asks for `chrome: "plain"` — same wordmark, set in
 * text, and a one-line footer with nothing to click. The list keeps the full
 * treatment, and gains the unsubscribe line that legally and practically has to
 * be there.
 */
function shell({
  preheader,
  heading,
  body,
  chrome = "brand",
  unsubscribeUrl,
}: {
  preheader: string;
  heading: string;
  body: string;
  chrome?: "brand" | "plain";
  /** Present only on bulk mail; renders the footer's unsubscribe line. */
  unsubscribeUrl?: string;
}): string {
  const brand = chrome === "brand";
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${preheader}${"&zwnj;&nbsp;".repeat(60)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

    <tr><td style="padding:0 4px 16px;">
      <!-- Mark + wordmark as a two-cell lockup. The mark alone is a camera
           glyph that names nothing, and the file has no wordmark baked in.
           The image alt is empty on purpose: the word sits beside it in text,
           so a blocked-image render reads "snapcn" once, not twice.

           Plain chrome drops the image entirely rather than shrinking it. A
           remote image is both a Promotions signal and a read beacon, and the
           wordmark below carries the identity on its own. -->
      <a href="${SITE}" style="text-decoration:none;color:${C.ink};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          ${
            brand
              ? `<td valign="middle" style="padding-right:9px;">
            <img src="${SITE}/logo/snapcn.png" width="30" height="26" alt=""
                 style="display:block;border:0;outline:none;width:30px;height:26px;">
          </td>`
              : ""
          }
          <td valign="middle" style="font-family:${FONT};font-size:17px;font-weight:700;letter-spacing:-0.02em;color:${C.ink};">snapcn</td>
        </tr></table>
      </a>
    </td></tr>

    <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:16px;padding:30px 28px;">
      <h1 style="margin:0 0 18px;font-family:${FONT};font-size:22px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:${C.ink};">${heading}</h1>
      ${body}
    </td></tr>

    <tr><td style="padding:18px 4px 0;">
      <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};">
        ${
          brand
            ? `snapcn — Remotion components you install with the shadcn CLI and own as source.<br>
        ${link("snapcn.dev", SITE)} &middot; ${link("Components", `${SITE}/docs/components`)} &middot; ${link("Roadmap", `${SITE}/docs/roadmap`)}`
            : `snapcn — Remotion components you install with the shadcn CLI and own as source.`
        }${
          unsubscribeUrl
            ? `<br><br>You are getting this because you asked for it at snapcn.dev.
        ${link("Unsubscribe", unsubscribeUrl)}.${POSTAL_ADDRESS ? `<br>${esc(POSTAL_ADDRESS)}` : ""}`
            : ""
        }
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`;
}

/**
 * The gate. Nothing else reaches an address until this link is opened.
 *
 * ## Why the list is double opt-in
 *
 * The form is a public text box, so "somebody typed this address" and "the
 * owner of this address wants our mail" are different claims, and only the
 * second one is worth anything. Single opt-in accepts typos, disposable
 * addresses, an old spam-trap somebody pasted in, and every address a bored
 * stranger felt like signing up — and each of those becomes a bounce or a
 * complaint charged against the domain the sign-in links go out on.
 *
 * Gmail has no way to be *told* that somebody subscribed. There is no header
 * for it and no API. What it measures is bounces, complaints and engagement,
 * and double opt-in is simply the cheapest way to make all three come out
 * right: a confirmed list is a list of real, reachable people who remember
 * asking.
 *
 * ## What this mail must say
 *
 * That it is the only one, if the reader did not ask for it. Somebody whose
 * address was typed in by a stranger has to be able to close it and be certain
 * nothing follows — which is true, because a row with no `confirmed_at` is
 * never sent anything else.
 *
 * Plain chrome and no unsubscribe header: there is nothing to unsubscribe from
 * yet, and an unsubscribe link on an unconfirmed address is a second way to
 * mail somebody about a list they are not on.
 */
export function confirmSubscriptionEmail(to: string, token: string): Email {
  const { confirm } = subscriptionUrls(token);
  const text = `Confirm your snapcn subscription

Someone — hopefully you — asked for snapcn's component list at snapcn.dev.

Confirm it here and you are on:
${confirm}

If it was not you, do nothing. This is the only message you will get.

— Sri`;

  return {
    to,
    from: NEWSLETTER_FROM,
    subject: "Confirm your snapcn subscription",
    text,
    html: shell({
      chrome: "plain",
      preheader:
        "One click and you are on the list. Ignore this if it wasn't you.",
      heading: "Confirm your subscription",
      body: [
        p(
          "Someone — hopefully you — asked for snapcn's component list at snapcn.dev.",
        ),
        `<div style="margin:22px 0 18px;">${button("Confirm subscription", confirm)}</div>`,
        p(
          "If the button does not work, paste this into your browser:",
          `color:${C.muted};font-size:14px;margin-bottom:8px;`,
        ),
        code(confirm),
        p(
          "If it was not you, do nothing — this is the only message you will get.",
          `color:${C.muted};font-size:14px;margin-bottom:0;`,
        ),
      ].join("\n      "),
    }),
  };
}

/**
 * Sent once, when an address has *confirmed* — never on a re-subscribe, and
 * never before the confirm link is opened. The caller decides that by looking
 * at whether `confirmed_at` was still null; getting it wrong means mailing
 * someone every time they touch the form.
 *
 * The first and, for now, only bulk message, so it is the one that carries the
 * one-click unsubscribe header and the footer that goes with it.
 */
export function welcomeSubscriberEmail(
  to: string,
  token: string,
  /**
   * The free pro component's install link (`sampleInstallUrl`), when the
   * deployment can sign one. It leads the mail: it is what most people signed
   * up for, and the mail they keep is the one with the command in it.
   */
  sampleUrl?: string | null,
): Email {
  const { unsubscribe } = subscriptionUrls(token);
  const sample = sampleUrl
    ? `Your free Pro component, ${PRO_SAMPLE.title}:
  npx shadcn@latest add ${sampleUrl}

The other ${PRO_ITEMS.length - 1} Pro components, and what they cost: ${SITE}/docs/pricing?ref=welcome

`
    : "";
  const text = `You're on the list.

${sample}New snapcn components as they ship — no more than one email a week, and never a sponsored one.

Browse the components already in the registry: ${SITE}/docs/components
What is coming next: ${SITE}/docs/roadmap

Install any of them with:
  npx shadcn@latest add @snapcn/text-reveal

The source lands in your repo and you own it from there. MIT, no runtime package.

— Sri

Unsubscribe: ${unsubscribe}`;

  return {
    to,
    from: NEWSLETTER_FROM,
    headers: oneClickUnsubscribe(token),
    subject: "You're on the snapcn list",
    text,
    html: shell({
      unsubscribeUrl: unsubscribe,
      preheader:
        "One email a week of new Remotion components. Never sponsored.",
      heading: "You're on the list.",
      body: [
        ...(sampleUrl
          ? [
              p(
                `Here is your free Pro component, <strong>${PRO_SAMPLE.title}</strong>. Run this in your Remotion project:`,
              ),
              code(`npx shadcn@latest add ${sampleUrl}`),
              p(
                `It installs like any snapcn component and is yours to edit. ${link(`See the other ${PRO_ITEMS.length - 1} Pro components`, `${SITE}/docs/pricing?ref=welcome`)}.`,
                `color:${C.muted};font-size:14px;`,
              ),
            ]
          : []),
        p(
          "New snapcn components as they ship — no more than one email a week, and never a sponsored one.",
        ),
        p("Install any of the ones already in the registry with one command:"),
        code("npx shadcn@latest add @snapcn/text-reveal"),
        p(
          `The source lands in your repo and you own it from there. MIT, and no runtime package to keep on your dependency list.`,
        ),
        `<div style="margin:22px 0 6px;">${button("Browse the components", `${SITE}/docs/components`)}</div>`,
        p(
          `Or see ${link("what is coming next", `${SITE}/docs/roadmap`)}.`,
          `color:${C.muted};font-size:14px;margin-top:14px;`,
        ),
        p("— Sri", `margin-bottom:0;color:${C.muted};`),
      ].join("\n      "),
    }),
  };
}

/**
 * The magic link itself.
 *
 * Auth.js ships a default for this and it is the one email nobody should send:
 * unbranded, and indistinguishable from the phishing it looks like. A sign-in
 * link is the *most* security-sensitive mail we send, so it is the one that has
 * to look unmistakably like us.
 *
 * The raw URL is printed under the button on purpose. Some clients strip or
 * rewrite links, and a reader who is suspicious of a button should be able to
 * read where it goes before trusting it.
 */
export function magicLinkEmail(to: string, url: string): Email {
  const text = `Sign in to snapcn

Click the link below to sign in as ${to}. It expires in 24 hours and works once.

${url}

If you did not ask for this, ignore it — nothing happens until the link is opened.

— Sri`;

  return {
    to,
    subject: "Your snapcn sign-in link",
    text,
    html: shell({
      // Plain chrome. A sign-in link that Gmail files under Promotions is a
      // sign-in link nobody sees inside the twenty-four hours it lives for, and
      // the logo image plus a footer row of marketing links is most of what
      // tells Gmail to file it there.
      chrome: "plain",
      preheader: "One-time sign-in link. Expires in 24 hours.",
      heading: "Sign in to snapcn",
      body: [
        p(`Use the button below to sign in as <strong>${to}</strong>.`),
        `<div style="margin:22px 0 18px;">${button("Sign in to snapcn", url)}</div>`,
        p(
          "The link expires in 24 hours and works once.",
          `color:${C.muted};font-size:14px;`,
        ),
        p(
          "If the button does not work, paste this into your browser:",
          `color:${C.muted};font-size:14px;margin-bottom:8px;`,
        ),
        code(url),
        p(
          "If you did not ask for this, ignore it — nothing happens until the link is opened.",
          `color:${C.muted};font-size:14px;margin-bottom:0;`,
        ),
      ].join("\n      "),
    }),
  };
}

/**
 * Sent from `events.createUser`, which Auth.js fires the first time a row is
 * written for an account — so this is "welcome", not "you signed in again".
 */
export function welcomeUserEmail(to: string, name?: string | null): Email {
  const greeting = name ? `Welcome, ${name.split(" ")[0]}.` : "Welcome.";
  const text = `${greeting}

Your snapcn account is live. Two things it unlocks:

- The video editor saves what you build as you go: ${SITE}/docs/video-editor
- Your plan and your API keys live on your account page: ${SITE}/account

Rendering the components locally with your own Remotion setup was never watermarked and never will be — that code is MIT and it is yours. The mark is only on videos our machines render.

— Sri`;

  return {
    to,
    subject: "Welcome to snapcn",
    text,
    html: shell({
      // Transactional: it answers an action the reader just took, and it is not
      // a list. No unsubscribe, and no chrome that reads as a campaign.
      chrome: "plain",
      preheader: "Your account is live — saved videos and your keys.",
      heading: greeting,
      body: [
        p("Your snapcn account is live. Two things it unlocks:"),
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
        <tr><td style="padding:0 0 10px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.ink};">— The ${link("video editor", `${SITE}/docs/video-editor`)} saves what you build as you go.</td></tr>
        <tr><td style="font-family:${FONT};font-size:15px;line-height:1.6;color:${C.ink};">— Your plan and your API keys live on your ${link("account page", `${SITE}/account`)}.</td></tr>
      </table>`,
        p(
          "Rendering the same components locally with your own Remotion setup was never watermarked and never will be — that code is MIT and it is yours. The mark is only on videos our machines render.",
        ),
        `<div style="margin:22px 0 6px;">${button("Open the video editor", `${SITE}/docs/video-editor`)}</div>`,
        p("— Sri", `margin:18px 0 0;color:${C.muted};`),
      ].join("\n      "),
    }),
  };
}

/**
 * Escape user-supplied text before it enters an HTML mail body.
 *
 * For any text we did not write ourselves — configuration included — before
 * it is interpolated into markup.
 */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
