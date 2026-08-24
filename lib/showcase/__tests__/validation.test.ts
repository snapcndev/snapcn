/**
 * Unit tests for lib/showcase/validation.ts
 *
 * Run with:  pnpm vitest run lib/showcase/__tests__/validation.test.ts
 *
 * One endpoint now takes two very different submissions — a link to someone
 * else's post, or a render this server still has on disk. The rule that keeps
 * that honest is "exactly one of them", and it is the only thing standing
 * between the route and a row that claims to be both.
 */

import { describe, expect, it } from "vitest";
import { submissionInputSchema } from "@/lib/showcase/validation";

const JOB = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
const parse = (v: unknown) => submissionInputSchema.safeParse(v);

describe("submissionInputSchema — exactly one source", () => {
  it("accepts a link submission", () => {
    const r = parse({ title: "My post", postUrl: "https://x.com/a/status/1" });
    expect(r.success).toBe(true);
  });

  it("accepts an editor submission", () => {
    const r = parse({ title: "Launch teaser", jobId: JOB });
    expect(r.success).toBe(true);
  });

  it("refuses neither — that row could not be rendered as anything", () => {
    const r = parse({ title: "Nothing here" });
    expect(r.success).toBe(false);
  });

  it("refuses both — the card can only show one of them", () => {
    const r = parse({
      title: "Both",
      jobId: JOB,
      postUrl: "https://x.com/a/status/1",
    });
    expect(r.success).toBe(false);
  });
});

describe("submissionInputSchema — the fields themselves", () => {
  it("rejects a jobId that is not a uuid — it becomes a filesystem path", () => {
    expect(parse({ title: "x", jobId: "../../etc/passwd" }).success).toBe(
      false,
    );
    expect(parse({ title: "x", jobId: "abc" }).success).toBe(false);
  });

  it("rejects a non-http(s) link", () => {
    expect(parse({ title: "x", postUrl: "javascript:alert(1)" }).success).toBe(
      false,
    );
    expect(parse({ title: "x", postUrl: "file:///etc/passwd" }).success).toBe(
      false,
    );
  });

  it("still requires a real title", () => {
    expect(parse({ title: "a", jobId: JOB }).success).toBe(false);
    expect(parse({ title: "  ", jobId: JOB }).success).toBe(false);
  });

  it("caps the description", () => {
    expect(
      parse({ title: "ok", jobId: JOB, description: "x".repeat(501) }).success,
    ).toBe(false);
  });

  it("treats an empty description as absent", () => {
    const r = parse({ title: "ok", jobId: JOB, description: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.description).toBeUndefined();
  });
});
