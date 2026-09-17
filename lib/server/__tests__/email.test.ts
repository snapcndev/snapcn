import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * The suppression list is a database call, and this file is about a `fetch` and
 * five templates. Hoisted so the factory cannot read the set before it exists.
 */
const h = vi.hoisted(() => ({ suppressed: new Set<string>() }));
vi.mock("@/lib/server/suppression", () => ({
  isSuppressed: async (email: string) => h.suppressed.has(email),
  suppress: vi.fn(),
}));

/**
 * `RESEND_API_KEY` is read at module scope, so each case re-imports the module
 * with the env it needs. `resetModules` is what makes that re-read happen.
 */
async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return import("../email");
}

const TOKEN = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  h.suppressed.clear();
  delete process.env.EMAIL_FROM_NEWSLETTER;
  delete process.env.EMAIL_POSTAL_ADDRESS;
  delete process.env.EMAIL_SITE_URL;
});

describe("sendEmail", () => {
  it("is a no-op without a key, and never touches the network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { sendEmail, isEmailConfigured } = await load({
      RESEND_API_KEY: undefined,
    });

    expect(isEmailConfigured).toBe(false);
    expect(
      await sendEmail({ to: "a@b.c", subject: "s", html: "h", text: "t" }),
    ).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns false rather than throwing when the API rejects", async () => {
    // Every caller runs after something already succeeded — a row is written,
    // an account exists. A mail failure must never turn that into a 500.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("domain not verified", { status: 403 })),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendEmail } = await load({ RESEND_API_KEY: "re_test" });

    await expect(
      sendEmail({ to: "a@b.c", subject: "s", html: "h", text: "t" }),
    ).resolves.toBe(false);
  });

  it("returns false rather than throwing when the network is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { sendEmail } = await load({ RESEND_API_KEY: "re_test" });

    await expect(
      sendEmail({ to: "a@b.c", subject: "s", html: "h", text: "t" }),
    ).resolves.toBe(false);
  });

  it("posts the configured sender and the caller's fields", async () => {
    const fetchSpy = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response("{}", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const { sendEmail } = await load({
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "snapcn <hello@snapcn.dev>",
    });

    expect(
      await sendEmail({ to: "a@b.c", subject: "s", html: "h", text: "t" }),
    ).toBe(true);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer re_test",
    );
    // No `headers` key at all on an ordinary mail: an undefined value is
    // dropped by JSON.stringify, so the body is the one it always was.
    expect(JSON.parse(init.body as string)).toEqual({
      from: "snapcn <hello@snapcn.dev>",
      to: "a@b.c",
      subject: "s",
      html: "h",
      text: "t",
    });
  });

  it("lets a template override the sender, and passes headers through", async () => {
    const fetchSpy = vi.fn(
      async (_url: string, _init: RequestInit) =>
        new Response("{}", { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const { sendEmail } = await load({
      RESEND_API_KEY: "re_test",
      EMAIL_FROM: "snapcn <hello@snapcn.dev>",
    });

    await sendEmail({
      to: "a@b.c",
      subject: "s",
      html: "h",
      text: "t",
      from: "snapcn <news@mail.snapcn.dev>",
      headers: { "List-Unsubscribe": "<https://snapcn.dev/api/unsubscribe/x>" },
    });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
    expect(body.from).toBe("snapcn <news@mail.snapcn.dev>");
    expect(body.headers).toEqual({
      "List-Unsubscribe": "<https://snapcn.dev/api/unsubscribe/x>",
    });
  });

  it("refuses to send to a suppressed address, before the network", async () => {
    // A bounce we could have predicted is a bounce charged against the domain
    // every other message in this file depends on.
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    h.suppressed.add("dead@example.com");
    const { sendEmail } = await load({ RESEND_API_KEY: "re_test" });

    expect(
      await sendEmail({
        to: "dead@example.com",
        subject: "s",
        html: "h",
        text: "t",
      }),
    ).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("templates", () => {
  /** Every template, built with throwaway values. */
  async function all() {
    const {
      welcomeSubscriberEmail,
      confirmSubscriptionEmail,
      welcomeUserEmail,
      magicLinkEmail,
    } = await load({});
    return [
      welcomeSubscriberEmail("a@b.c", TOKEN),
      confirmSubscriptionEmail("a@b.c", TOKEN),
      welcomeUserEmail("a@b.c", "Ada Lovelace"),
      welcomeUserEmail("a@b.c", null),
      magicLinkEmail(
        "a@b.c",
        "https://snapcn.dev/api/auth/callback/resend?t=x",
      ),
    ];
  }

  it("hold the invariants an email client actually cares about", async () => {
    for (const email of await all()) {
      expect(email.to).toBe("a@b.c");
      expect(email.subject.length).toBeGreaterThan(0);

      // A missing text/plain part is a spam signal and renders as nothing in
      // text-only readers.
      expect(email.text.trim().length).toBeGreaterThan(40);

      expect(email.html.startsWith("<!doctype html>")).toBe(true);

      // The brand name must survive images being blocked, so it is set in text
      // rather than left to the logo file — which is a glyph with no wordmark.
      expect(email.html).toContain(">snapcn</td>");

      // The grey line Gmail prints beside the subject. Without one the client
      // grabs whatever the body opens with.
      expect(email.html).toContain("display:none!important");

      // Classes and <style> blocks are stripped by most clients, so a rule that
      // lives in either is a rule that only works on your machine.
      expect(email.html).not.toContain("class=");
      expect(email.html).not.toMatch(/<style[\s>]/);

      // Remote images are blocked by default, so every image must degrade to
      // readable text. Alt is what the reader sees before they click "display
      // images" — an empty alt on the logo is a blank header.
      for (const img of email.html.match(/<img\s[^>]*>/g) ?? []) {
        // `alt` present on every image. The logo's is deliberately empty — the
        // wordmark sits beside it in text, so a non-empty alt would render
        // "snapcn snapcn" whenever images are blocked.
        expect(img).toMatch(/alt="[^"]*"/);
        // Explicit dimensions, or the layout jumps when the image finally loads.
        expect(img).toMatch(/width="\d+"/);
        expect(img).toMatch(/height="\d+"/);
      }

      // Every anchor carries an inline colour. An unstyled link inherits the
      // client's default, which is how mail turns up unreadable in dark mode.
      for (const anchor of email.html.match(/<a\s[^>]*>/g) ?? []) {
        expect(anchor).toContain("style=");
        expect(anchor).toContain("color:");
      }
    }
  });

  it("greets by first name only, and degrades without one", async () => {
    const { welcomeUserEmail } = await load({});
    expect(welcomeUserEmail("a@b.c", "Ada Lovelace").text).toContain(
      "Welcome, Ada.",
    );
    expect(welcomeUserEmail("a@b.c", null).text).toContain("Welcome.");
  });

  it("uses the current install namespace", async () => {
    // Caught once already by the @snap-cn → @snapcn rename; a stale command in
    // a welcome mail is a broken first impression nobody sees in review.
    const { welcomeSubscriberEmail } = await load({});
    expect(welcomeSubscriberEmail("a@b.c", TOKEN).text).toContain("@snapcn/");
    expect(welcomeSubscriberEmail("a@b.c", TOKEN).text).not.toContain(
      "@snap-cn/",
    );
  });

  it("prints the sign-in URL as text as well as a button", async () => {
    // Some clients strip or rewrite links, and a reader who does not trust a
    // button in an email — which is the correct instinct for a sign-in mail —
    // has to be able to read where it goes before following it.
    const { magicLinkEmail } = await load({});
    const url = "https://snapcn.dev/api/auth/callback/resend?token=abc123";
    const email = magicLinkEmail("a@b.c", url);
    expect(email.text).toContain(url);
    // Once in the button href, once as readable text.
    expect(email.html.split(url).length - 1).toBeGreaterThanOrEqual(2);
    expect(email.subject).toBe("Your snapcn sign-in link");
  });
});

// ---------------------------------------------------------------------------
// Deliverability — the parts Gmail reads rather than the reader
// ---------------------------------------------------------------------------

describe("subscriptionUrls", () => {
  it("keeps the unsubscribe page and the unsubscribe endpoint apart", async () => {
    // The whole reason there are three. A link scanner GETs everything in a
    // message; only the page is safe to be fetched by a machine, and only the
    // endpoint acts — on POST.
    const { subscriptionUrls } = await load({});
    const u = subscriptionUrls(TOKEN);
    expect(u.confirm).toBe(`https://snapcn.dev/subscribe/confirm/${TOKEN}`);
    expect(u.unsubscribe).toBe(`https://snapcn.dev/u/${TOKEN}`);
    expect(u.unsubscribePost).toBe(
      `https://snapcn.dev/api/unsubscribe/${TOKEN}`,
    );
    expect(u.unsubscribe).not.toBe(u.unsubscribePost);
  });

  it("can be pointed at a developer's own machine", async () => {
    // Without this, testing double opt-in locally confirms a production row.
    const { subscriptionUrls } = await load({
      EMAIL_SITE_URL: "http://localhost:3000/",
    });
    expect(subscriptionUrls(TOKEN).confirm).toBe(
      `http://localhost:3000/subscribe/confirm/${TOKEN}`,
    );
  });
});

describe("the list's mail", () => {
  it("carries RFC 8058 one-click unsubscribe", async () => {
    // The single biggest lever on whether a list reaches the inbox: it is the
    // easy way out, and everyone who takes it is someone who did not press
    // "Report spam" instead.
    const { welcomeSubscriberEmail, subscriptionUrls } = await load({});
    const email = welcomeSubscriberEmail("a@b.c", TOKEN);
    expect(email.headers?.["List-Unsubscribe"]).toBe(
      `<${subscriptionUrls(TOKEN).unsubscribePost}>`,
    );
    expect(email.headers?.["List-Unsubscribe-Post"]).toBe(
      "List-Unsubscribe=One-Click",
    );
  });

  it("points the header at the POST endpoint, never at the page", async () => {
    // Getting these the wrong way round means Gmail's one-click lands on a page
    // that does nothing, and the reader who pressed it stays subscribed.
    const { welcomeSubscriberEmail } = await load({});
    const header = welcomeSubscriberEmail("a@b.c", TOKEN).headers?.[
      "List-Unsubscribe"
    ];
    expect(header).toContain("/api/unsubscribe/");
    expect(header).not.toContain("<https://snapcn.dev/u/");
  });

  it("has no mailto: alternative while the domain publishes no MX", async () => {
    // An unsubscribe route that silently bounces is worse than none.
    const { welcomeSubscriberEmail } = await load({});
    expect(
      welcomeSubscriberEmail("a@b.c", TOKEN).headers?.["List-Unsubscribe"],
    ).not.toContain("mailto:");
  });

  it("also puts a visible unsubscribe link in both bodies", async () => {
    // The header is for Gmail. A reader in Apple Mail, or one who does not know
    // the header exists, needs a link they can see.
    const { welcomeSubscriberEmail, subscriptionUrls } = await load({});
    const email = welcomeSubscriberEmail("a@b.c", TOKEN);
    const { unsubscribe } = subscriptionUrls(TOKEN);
    expect(email.html).toContain(unsubscribe);
    expect(email.html).toContain(">Unsubscribe</a>");
    expect(email.text).toContain(unsubscribe);
  });

  it("prints the postal address when one is configured, and nothing when not", async () => {
    // CAN-SPAM §5 requires it of commercial mail. Missing is a compliance
    // problem to fix in the environment, not a reason for a send to fail.
    const bare = (await load({})).welcomeSubscriberEmail("a@b.c", TOKEN);
    expect(bare.html).not.toContain("Fitzroy");

    const { welcomeSubscriberEmail } = await load({
      EMAIL_POSTAL_ADDRESS: "snapcn, 1 Fitzroy St, London",
    });
    expect(welcomeSubscriberEmail("a@b.c", TOKEN).html).toContain(
      "snapcn, 1 Fitzroy St, London",
    );
  });

  it("escapes the postal address, because it comes from the environment", async () => {
    const { welcomeSubscriberEmail } = await load({
      EMAIL_POSTAL_ADDRESS: "<script>alert(1)</script>",
    });
    const html = welcomeSubscriberEmail("a@b.c", TOKEN).html;
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("sends from the newsletter address when one is set", async () => {
    // A separate stream, so a bad campaign costs the newsletter's reputation
    // and not the sign-in link's.
    const plain = await load({ EMAIL_FROM: "snapcn <hello@snapcn.dev>" });
    expect(plain.welcomeSubscriberEmail("a@b.c", TOKEN).from).toBe(
      "snapcn <hello@snapcn.dev>",
    );

    const split = await load({
      EMAIL_FROM: "snapcn <hello@snapcn.dev>",
      EMAIL_FROM_NEWSLETTER: "snapcn <news@mail.snapcn.dev>",
    });
    expect(split.welcomeSubscriberEmail("a@b.c", TOKEN).from).toBe(
      "snapcn <news@mail.snapcn.dev>",
    );
    expect(split.confirmSubscriptionEmail("a@b.c", TOKEN).from).toBe(
      "snapcn <news@mail.snapcn.dev>",
    );
    // Transactional mail stays on the transactional sender — it takes the
    // module default, which is why there is no `from` on it at all.
    expect(
      split.magicLinkEmail("a@b.c", "https://x.test").from,
    ).toBeUndefined();
    expect(split.welcomeUserEmail("a@b.c", null).from).toBeUndefined();
  });
});

describe("transactional mail", () => {
  it("carries no unsubscribe header — there is nothing to leave", async () => {
    // And offering it would let somebody opt out of their own sign-in link.
    const { magicLinkEmail, welcomeUserEmail, confirmSubscriptionEmail } =
      await load({});
    for (const email of [
      magicLinkEmail("a@b.c", "https://x.test"),
      welcomeUserEmail("a@b.c", null),
      // The confirm mail included: the address is not on any list yet, so an
      // unsubscribe link would be a second way to mail somebody about a list
      // they are not on.
      confirmSubscriptionEmail("a@b.c", TOKEN),
    ]) {
      expect(email.headers).toBeUndefined();
      expect(email.html).not.toContain("Unsubscribe");
    }
  });

  it("drops the logo and the footer links, so Gmail does not file it as a promo", async () => {
    // A sign-in link in Promotions is a sign-in link nobody sees inside the
    // twenty-four hours it lives for.
    const { magicLinkEmail, welcomeSubscriberEmail } = await load({});
    const signin = magicLinkEmail("a@b.c", "https://x.test");
    expect(signin.html).not.toContain("<img");
    expect(signin.html).not.toContain(">Roadmap</a>");
    // …while the list keeps the full treatment, which is the right home for it.
    const list = welcomeSubscriberEmail("a@b.c", TOKEN);
    expect(list.html).toContain("<img");
    expect(list.html).toContain(">Roadmap</a>");
  });
});

describe("confirmSubscriptionEmail", () => {
  it("says, in both bodies, that ignoring it ends the matter", async () => {
    // The promise double opt-in makes to somebody whose address a stranger
    // typed in. It is also true: a row with no confirmed_at is never sent
    // anything else.
    const { confirmSubscriptionEmail } = await load({});
    const email = confirmSubscriptionEmail("a@b.c", TOKEN);
    expect(email.text).toMatch(/only message you will get/i);
    expect(email.html).toMatch(/only message you will get/i);
  });

  it("prints the confirm URL as text as well as a button", async () => {
    const { confirmSubscriptionEmail, subscriptionUrls } = await load({});
    const email = confirmSubscriptionEmail("a@b.c", TOKEN);
    const { confirm } = subscriptionUrls(TOKEN);
    expect(email.text).toContain(confirm);
    expect(email.html.split(confirm).length - 1).toBeGreaterThanOrEqual(2);
  });

  it("never links anything but the confirm URL and the wordmark", async () => {
    // A confirm mail with a tour of the site in it is a marketing mail, and it
    // is sent to an address that has not agreed to receive one.
    const { confirmSubscriptionEmail, subscriptionUrls } = await load({});
    const html = confirmSubscriptionEmail("a@b.c", TOKEN).html;
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(hrefs)).toEqual(
      new Set(["https://snapcn.dev", subscriptionUrls(TOKEN).confirm]),
    );
  });
});
