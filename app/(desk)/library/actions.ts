"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import {
  failure,
  fieldErrors,
  formValues,
  UserError,
  type FormState,
} from "@/lib/actions";
import { requirePermission } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { log } from "@/lib/log";
import { normalizeInstagram, normalizeLinkedIn } from "@/lib/team/handles";

/*
 * Speakers, partners and rooms: entered once, reused on every post. Anyone on the team may
 * add and edit (library.edit); archiving needs library.archive. Nothing is deleted, so old
 * posts keep their speaker and logo.
 */

const optId = z.union([z.literal(""), z.uuid()]).default("");
const notes = z
  .string()
  .trim()
  .max(1000, "Keep notes under 1,000 characters.")
  .default("");

const handleFields = {
  instagram: z.string().max(200).default(""),
  linkedin: z.string().max(300).default(""),
};

/** Turns whatever was pasted into the stored handle forms, or adds a field error. */
function fixHandles(
  v: { instagram: string; linkedin: string },
  ctx: z.RefinementCtx,
) {
  const ig = normalizeInstagram(v.instagram);
  const li = normalizeLinkedIn(v.linkedin);
  if ("error" in ig)
    ctx.addIssue({ code: "custom", path: ["instagram"], message: ig.error });
  if ("error" in li)
    ctx.addIssue({ code: "custom", path: ["linkedin"], message: li.error });
  return {
    instagram: "value" in ig ? ig.value : "",
    linkedin: "value" in li ? li.value : "",
  };
}

const Speaker = z
  .object({
    ...handleFields,
    id: optId,
    name: z
      .string()
      .trim()
      .min(1, "Enter the speaker’s name as it should appear on graphics.")
      .max(80, "Use 80 characters or fewer."),
    role: z
      .string()
      .trim()
      .max(120, "Use 120 characters or fewer; it has to fit under the photo.")
      .default(""),
    notes,
    photoId: optId,
    cropX: z.coerce.number().min(0).max(100).default(50),
    cropY: z.coerce.number().min(0).max(100).default(50),
    cropZoom: z.coerce.number().min(1).max(3).default(1),
  })
  .transform((v, ctx) => ({ ...v, ...fixHandles(v, ctx) }));

const Partner = z
  .object({
    ...handleFields,
    id: optId,
    name: z
      .string()
      .trim()
      .min(1, "Enter the partner’s name.")
      .max(80, "Use 80 characters or fewer."),
    logoId: optId,
    logoTone: z.enum(
      ["original", "white", "black"],
      "Pick how the logo is drawn.",
    ),
    notes,
  })
  .transform((v, ctx) => ({ ...v, ...fixHandles(v, ctx) }));

const Room = z.object({
  id: optId,
  name: z
    .string()
    .trim()
    .min(1, "Enter the room’s full name, like Rhatigan Student Center 233.")
    .max(100, "Use 100 characters or fewer."),
  short: z
    .string()
    .trim()
    .min(1, "Enter how the room reads on a graphic, like RSC 233.")
    .max(
      24,
      "Keep it to 24 characters; it sits in a narrow cell of the data strip.",
    ),
  notes,
});

async function assetOk(id: string, kind: "photo" | "logo") {
  if (!id) return true;
  const [a] = await db()
    .select({ kind: schema.assets.kind })
    .from(schema.assets)
    .where(eq(schema.assets.id, id))
    .limit(1);
  return a?.kind === kind;
}

export async function saveSpeaker(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const values = formValues(fd);
  try {
    const user = await requirePermission("library.edit");
    const parsed = Speaker.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
    const v = parsed.data;
    if (!(await assetOk(v.photoId, "photo")))
      throw new UserError(
        "That photo isn’t in the library any more. Upload it again.",
      );
    const row = {
      name: v.name,
      role: v.role,
      instagram: v.instagram,
      linkedin: v.linkedin,
      notes: v.notes,
      photoId: v.photoId || null,
      photoCrop: v.photoId
        ? {
            x: Math.round(v.cropX * 10) / 10,
            y: Math.round(v.cropY * 10) / 10,
            zoom: Math.round(v.cropZoom * 100) / 100,
          }
        : null,
      updatedAt: new Date(),
    };
    if (v.id) {
      const done = await db()
        .update(schema.speakers)
        .set(row)
        .where(eq(schema.speakers.id, v.id))
        .returning({ id: schema.speakers.id });
      if (!done.length)
        throw new UserError("That speaker was removed. Reload the page.");
    } else {
      await db().insert(schema.speakers).values(row);
    }
    log.info("speaker saved", { actor: user.id });
    refresh();
    return { ok: true, message: `Saved ${v.name}.` };
  } catch (err) {
    return { ...failure(err, "saveSpeaker"), values };
  }
}

export async function savePartner(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const values = formValues(fd);
  try {
    const user = await requirePermission("library.edit");
    const parsed = Partner.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
    const v = parsed.data;
    if (!(await assetOk(v.logoId, "logo")))
      throw new UserError(
        "That logo isn’t in the library any more. Upload it again.",
      );
    const row = {
      name: v.name,
      instagram: v.instagram,
      linkedin: v.linkedin,
      notes: v.notes,
      logoId: v.logoId || null,
      logoTone: v.logoTone,
      updatedAt: new Date(),
    };
    if (v.id) {
      const done = await db()
        .update(schema.partners)
        .set(row)
        .where(eq(schema.partners.id, v.id))
        .returning({ id: schema.partners.id });
      if (!done.length)
        throw new UserError("That partner was removed. Reload the page.");
    } else {
      await db().insert(schema.partners).values(row);
    }
    log.info("partner saved", { actor: user.id });
    refresh();
    return { ok: true, message: `Saved ${v.name}.` };
  } catch (err) {
    return { ...failure(err, "savePartner"), values };
  }
}

export async function saveRoom(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const values = formValues(fd);
  try {
    const user = await requirePermission("library.edit");
    const parsed = Room.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
    const v = parsed.data;
    const row = { name: v.name, short: v.short, notes: v.notes };
    if (v.id) {
      const done = await db()
        .update(schema.rooms)
        .set(row)
        .where(eq(schema.rooms.id, v.id))
        .returning({ id: schema.rooms.id });
      if (!done.length)
        throw new UserError("That room was removed. Reload the page.");
    } else {
      await db().insert(schema.rooms).values(row);
    }
    log.info("room saved", { actor: user.id });
    refresh();
    return { ok: true, message: `Saved ${v.name}.` };
  } catch (err) {
    return { ...failure(err, "saveRoom"), values };
  }
}

const Archive = z.object({
  kind: z.enum(["speaker", "partner", "room"]),
  id: z.uuid(),
  archive: z.enum(["1", "0"]),
});

/** Archive hides an entry from pickers; posts that already use it keep it. Reversible. */
export async function setArchived(
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  try {
    const user = await requirePermission("library.archive");
    const parsed = Archive.safeParse(Object.fromEntries(fd));
    if (!parsed.success)
      return {
        message: "That request was malformed. Reload the page and try again.",
      };
    const { kind, id, archive } = parsed.data;
    const table =
      kind === "speaker"
        ? schema.speakers
        : kind === "partner"
          ? schema.partners
          : schema.rooms;
    const done = await db()
      .update(table)
      .set({ archivedAt: archive === "1" ? new Date() : null })
      .where(and(eq(table.id, id)))
      .returning({ id: table.id });
    if (!done.length)
      throw new UserError("That entry was removed. Reload the page.");
    log.info("library archive", {
      actor: user.id,
      kind,
      archived: archive === "1",
    });
    refresh();
    return { ok: true };
  } catch (err) {
    return failure(err, "setArchived");
  }
}
