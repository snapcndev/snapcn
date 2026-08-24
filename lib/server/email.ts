import "server-only";

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
 */
const FROM = process.env.EMAIL_FROM ?? "snapcn <hello@snapcn.dev>";

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
}

export async function sendEmail(email: Email): Promise<boolean> {
  if (!API_KEY) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, ...email }),
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

const SITE = "https://snapcn.dev";

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
 */
function shell({
  preheader,
  heading,
  body,
}: {
  preheader: string;
  heading: string;
  body: string;
}): string {
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
           so a blocked-image render reads "snapcn" once, not twice. -->
      <a href="${SITE}" style="text-decoration:none;color:${C.ink};">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td valign="middle" style="padding-right:9px;">
            <img src="${SITE}/logo/snapcn.png" width="30" height="26" alt=""
                 style="display:block;border:0;outline:none;width:30px;height:26px;">
          </td>
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
        snapcn — Remotion components you install with the shadcn CLI and own as source.<br>
        ${link("snapcn.dev", SITE)} &middot; ${link("Components", `${SITE}/docs/components`)} &middot; ${link("Roadmap", `${SITE}/docs/roadmap`)}
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
</body></html>`;
}

/**
 * Sent once, when an address first joins the list — never on a re-subscribe.
 * The caller decides that by checking whether a row was actually inserted;
 * getting it wrong means mailing someone every time they touch the form.
 */
export function welcomeSubscriberEmail(to: string): Email {
  const text = `You're on the list.

New snapcn components as they ship — no more than one email a week, and never a sponsored one.

Browse the 22 components already in the registry: ${SITE}/docs/components
What is coming next: ${SITE}/docs/roadmap

Install any of them with:
  npx shadcn@latest add @snapcn/text-reveal

The source lands in your repo and you own it from there. MIT, no runtime package.

— Sri`;

  return {
    to,
    subject: "You're on the snapcn list",
    text,
    html: shell({
      preheader:
        "One email a week of new Remotion components. Never sponsored.",
      heading: "You're on the list.",
      body: [
        p(
          "New snapcn components as they ship — no more than one email a week, and never a sponsored one.",
        ),
        p("Install any of the 22 already in the registry with one command:"),
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

- Exports from the video editor come out without the snapcn watermark: ${SITE}/docs/video-editor
- You can post what you build to the showcase: ${SITE}/docs/showcase

Rendering the components locally with your own Remotion setup was never watermarked and never will be — that code is MIT and it is yours. The mark is only on videos our machines render.

— Sri`;

  return {
    to,
    subject: "Welcome to snapcn",
    text,
    html: shell({
      preheader: "Your account is live — clean exports and showcase posting.",
      heading: greeting,
      body: [
        p("Your snapcn account is live. Two things it unlocks:"),
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;">
        <tr><td style="padding:0 0 10px;font-family:${FONT};font-size:15px;line-height:1.6;color:${C.ink};">— Exports from the ${link("video editor", `${SITE}/docs/video-editor`)} come out without the snapcn watermark.</td></tr>
        <tr><td style="font-family:${FONT};font-size:15px;line-height:1.6;color:${C.ink};">— You can post what you build to the ${link("showcase", `${SITE}/docs/showcase`)}.</td></tr>
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
 * The first template that carries text an untrusted person typed. The other
 * three interpolate an address we minted or a link we built; a submission title
 * is whatever the submitter felt like writing.
 */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sent to every `ADMIN_EMAILS` address the moment a submission lands.
 *
 * Nothing else in the product says a submission exists. Without this the
 * pending queue is a page somebody has to remember to visit, and the default
 * deployment silently swallows every submission it receives.
 *
 * The link is *printed*, never embedded, and the scraped thumbnail is left out
 * entirely: for a link submission both are attacker-chosen, and a remote image
 * in a mail body turns the admin's client into a read beacon.
 */
export function showcaseReviewEmail(
  to: string,
  submission: {
    title: string;
    authorName: string;
    /** Absolute for a link submission, site-relative for one we host. */
    postUrl: string;
    description?: string | null;
    hosted: boolean;
  },
): Email {
  // Collapsed because it reaches the Subject header, and a newline in a header
  // is an injection.
  const title = submission.title.replace(/\s+/g, " ").trim();
  const author = submission.authorName.replace(/\s+/g, " ").trim();
  const url = submission.postUrl.startsWith("/")
    ? `${SITE}${submission.postUrl}`
    : submission.postUrl;
  const kind = submission.hosted
    ? "made in the editor"
    : "a link to their post";

  const text = `New showcase submission — ${kind}

${title}
by ${author}${submission.description ? `\n\n${submission.description}` : ""}

${url}

Approve or reject it: ${SITE}/docs/showcase/admin

It stays hidden until you do.`;

  return {
    to,
    subject: `Showcase submission: ${title}`,
    text,
    html: shell({
      // Escaped too: the preheader is HTML like everything else in the shell,
      // and it was the one interpolation of an untrusted title that was not.
      preheader: `${esc(title)} — waiting for review.`,
      heading: "New showcase submission",
      body: [
        p(`<strong>${esc(title)}</strong><br>by ${esc(author)}`),
        submission.description
          ? p(esc(submission.description), `color:${C.muted};font-size:14px;`)
          : "",
        p(
          submission.hosted ? "The video:" : "Their post:",
          `color:${C.muted};font-size:14px;margin-bottom:8px;`,
        ),
        code(esc(url)),
        `<div style="margin:22px 0 6px;">${button("Review it", `${SITE}/docs/showcase/admin`)}</div>`,
        p(
          "It stays hidden until you approve it.",
          `margin:18px 0 0;color:${C.muted};font-size:14px;`,
        ),
      ]
        .filter(Boolean)
        .join("\n      "),
    }),
  };
}
