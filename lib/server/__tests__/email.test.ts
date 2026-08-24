import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
    expect(JSON.parse(init.body as string)).toEqual({
      from: "snapcn <hello@snapcn.dev>",
      to: "a@b.c",
      subject: "s",
      html: "h",
      text: "t",
    });
  });
});

describe("templates", () => {
  it("hold the invariants an email client actually cares about", async () => {
    const {
      welcomeSubscriberEmail,
      welcomeUserEmail,
      magicLinkEmail,
      showcaseReviewEmail,
    } = await load({});
    for (const email of [
      welcomeSubscriberEmail("a@b.c"),
      welcomeUserEmail("a@b.c", "Ada Lovelace"),
      welcomeUserEmail("a@b.c", null),
      magicLinkEmail(
        "a@b.c",
        "https://snapcn.dev/api/auth/callback/resend?t=x",
      ),
      showcaseReviewEmail("a@b.c", {
        title: "Launch teaser",
        authorName: "Ada Lovelace",
        postUrl: "/api/showcase/video/3f2504e0-4f89-11d3-9a0c-0305e82c3301",
        description: "Built from four components.",
        hosted: true,
      }),
      showcaseReviewEmail("a@b.c", {
        title: "My post",
        authorName: "Ada",
        postUrl: "https://x.com/ada/status/1",
        hosted: false,
      }),
    ]) {
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
    expect(welcomeSubscriberEmail("a@b.c").text).toContain("@snapcn/");
    expect(welcomeSubscriberEmail("a@b.c").text).not.toContain("@snap-cn/");
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
// showcaseReviewEmail — the first template carrying text a stranger typed
// ---------------------------------------------------------------------------

describe("showcaseReviewEmail", () => {
  it("escapes a title instead of letting it become markup", async () => {
    const { showcaseReviewEmail } = await load({});
    const email = showcaseReviewEmail("admin@snapcn.dev", {
      title: "<script>alert(1)</script>",
      authorName: "Ada & Co",
      postUrl: "/api/showcase/video/3f2504e0-4f89-11d3-9a0c-0305e82c3301",
      hosted: true,
    });

    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("Ada &amp; Co");
  });

  it("keeps the subject on one line — a newline there is header injection", async () => {
    const { showcaseReviewEmail } = await load({});
    const email = showcaseReviewEmail("admin@snapcn.dev", {
      title: "line one\nBcc: someone@evil.test",
      authorName: "Ada",
      postUrl: "https://x.com/ada/status/1",
      hosted: false,
    });

    expect(email.subject).not.toMatch(/[\r\n]/);
    expect(email.subject).toContain("line one Bcc:");
  });

  it("makes a hosted path absolute, and leaves a real link alone", async () => {
    const { showcaseReviewEmail } = await load({});
    const hosted = showcaseReviewEmail("a@b.c", {
      title: "t",
      authorName: "n",
      postUrl: "/api/showcase/video/3f2504e0-4f89-11d3-9a0c-0305e82c3301",
      hosted: true,
    });
    const linked = showcaseReviewEmail("a@b.c", {
      title: "t",
      authorName: "n",
      postUrl: "https://x.com/ada/status/1",
      hosted: false,
    });

    // A relative path in a mail body resolves against nothing.
    expect(hosted.text).toContain("https://snapcn.dev/api/showcase/video/");
    expect(linked.text).toContain("https://x.com/ada/status/1");
  });

  it("never embeds a remote image — a mail body is not a place for a read beacon", async () => {
    const { showcaseReviewEmail } = await load({});
    const email = showcaseReviewEmail("a@b.c", {
      title: "t",
      authorName: "n",
      postUrl: "https://evil.test/track.png",
      hosted: false,
    });

    // The URL is printed, never used as an <img src>.
    expect(email.html).not.toMatch(/<img[^>]+evil\.test/);
  });

  it("points the admin at the review queue", async () => {
    const { showcaseReviewEmail } = await load({});
    const email = showcaseReviewEmail("a@b.c", {
      title: "t",
      authorName: "n",
      postUrl: "https://x.com/a/1",
      hosted: false,
    });
    expect(email.html).toContain("https://snapcn.dev/docs/showcase/admin");
    expect(email.text).toContain("https://snapcn.dev/docs/showcase/admin");
  });
});
