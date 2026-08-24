import { z } from "zod";

/**
 * Server-side validation for the public submit endpoint (untrusted input). The
 * URL check is done manually (rather than via a zod format helper) so it stays
 * stable across zod versions and also pins the protocol to http(s).
 */
/** `crypto.randomUUID()`, as minted by the render queue. */
const JOB_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const submissionInputSchema = z
  .object({
    title: z.string().trim().min(2, "Give it a short title.").max(120),
    /**
     * A finished render to host ourselves. The editor sends this instead of a
     * link — there is no external post to point at, the video *is* the
     * submission.
     */
    jobId: z
      .string()
      .trim()
      .regex(JOB_ID, "That render id isn't valid.")
      .optional(),
    postUrl: z
      .string()
      .trim()
      .max(2048)
      .optional()
      .refine((v) => {
        if (v === undefined) return true;
        try {
          const u = new URL(v);
          return u.protocol === "http:" || u.protocol === "https:";
        } catch {
          return false;
        }
      }, "Enter a valid http(s) URL."),
    description: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  // Exactly one source. Both would leave two answers to "what is this entry",
  // and the card can only render one of them.
  .refine(
    (d) => Boolean(d.postUrl) !== Boolean(d.jobId),
    "Submit a video from the editor, or paste a link to your post.",
  );

export type SubmissionInput = z.infer<typeof submissionInputSchema>;
