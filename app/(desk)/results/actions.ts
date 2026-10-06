"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { failure, formValues, UserError, type FormState } from "@/lib/actions";
import { requirePermission } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { log } from "@/lib/log";
import { METRICS } from "./metrics";

const count = z
  .string()
  .trim()
  .transform((s) => s.replace(/[,\s]/g, ""))
  .refine((s) => s === "" || /^\d+$/.test(s), "Use a whole number, 0 or more, or leave it blank.")
  .transform((s) => (s === "" ? null : Number(s)))
  .refine((n) => n === null || n <= 100_000_000, "That number is too large. Check for an extra digit.");

/**
 * Upserts the numbers for every channel a posted post went to. The channels come from the
 * post itself, not from the form, so a crafted request can't add rows for other channels.
 */
export async function saveResults(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd);
  try {
    const user = await requirePermission("results.edit");
    const postId = z.uuid().safeParse(fd.get("postId"));
    if (!postId.success) return { message: "That request was malformed. Reload the page and try again.", values };
    const [post] = await db()
      .select({ id: schema.posts.id, status: schema.posts.status, channels: schema.posts.channels })
      .from(schema.posts)
      .where(eq(schema.posts.id, postId.data))
      .limit(1);
    if (!post) throw new UserError("That post was deleted. Reload the page.");
    if (post.status !== "posted") throw new UserError("Numbers go in after a post is marked posted.");

    const errors: Record<string, string> = {};
    const rows = post.channels.map((channel) => {
      const row: Record<string, number | null> = {};
      for (const m of METRICS) {
        const key = `${channel}.${m.key}`;
        const raw = fd.get(key);
        const r = count.safeParse(typeof raw === "string" ? raw : "");
        if (r.success) row[m.key] = r.data;
        else errors[key] = r.error.issues[0]?.message ?? "Check this number.";
      }
      return { channel, row };
    });
    if (Object.keys(errors).length) return { errors, values, message: "Some numbers need fixing; they’re marked above." };

    const now = new Date();
    await db().transaction(async (tx) => {
      for (const { channel, row } of rows) {
        const set = { ...row, recordedAt: now, recordedBy: user.id };
        await tx
          .insert(schema.postResults)
          .values({ postId: post.id, channel, ...set })
          .onConflictDoUpdate({ target: [schema.postResults.postId, schema.postResults.channel], set });
      }
      await tx.insert(schema.postActivity).values({ postId: post.id, actorId: user.id, action: "results", body: "Updated the numbers." });
    });
    log.info("results saved", { actor: user.id, post: post.id });
    refresh();
    return { ok: true, message: "Numbers saved." };
  } catch (err) {
    return { ...failure(err, "saveResults"), values };
  }
}
