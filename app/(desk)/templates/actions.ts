"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, fieldErrors, formValues, isNextControlFlow, type FormState } from "@/lib/actions";
import { requirePermission } from "@/lib/auth/session";
import { formatsFor, galleryEntry, startSlide } from "@/lib/brand/gallery";
import { loadEventContext } from "@/lib/data/events";
import { emptyCaptions, slideForEvent } from "@/lib/posts/factory";
import type { Format } from "@/lib/posts/types";
import { createPost } from "@/lib/posts/workflow";
import { fromLocalInput } from "@/lib/time";

const Input = z.object({
  template: z.string().min(1).max(40),
  headline: z.string().trim().max(160, "Keep the headline under 160 characters; the brand check wants 12 words."),
  series: z.string().trim().max(40, "Keep the series label under 40 characters."),
  eventId: z.union([z.literal(""), z.uuid()]),
  when: z.string().max(20),
  channels: z.array(z.enum(["instagram", "linkedin", "story"])).min(1, "Pick at least one place it will go."),
  formats: z.array(z.enum(["feed", "story", "wide"])).min(1, "Pick at least one size to export."),
});

/**
 * Starts a post from a gallery template, on its own or linked to an event (then the event's
 * date, room, speakers and partners fill in), and opens it in the editor.
 */
export async function startFromTemplate(_prev: FormState, fd: FormData): Promise<FormState> {
  // Checkbox groups repeat a name; keep every ticked value so a failed submit loses nothing.
  const values = { ...formValues(fd), channels: fd.getAll("channels").join(","), formats: fd.getAll("formats").join(",") };
  let id: string;
  try {
    const user = await requirePermission("post.edit");
    const parsed = Input.safeParse({
      template: fd.get("template"),
      headline: fd.get("headline") ?? "",
      series: fd.get("series") ?? "",
      eventId: fd.get("eventId") ?? "",
      when: fd.get("when") ?? "",
      channels: fd.getAll("channels"),
      formats: fd.getAll("formats"),
    });
    if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
    const v = parsed.data;
    const entry = galleryEntry(v.template);
    if (!entry) return { message: "That template no longer exists. Pick another from the gallery.", values };
    const scheduledFor = v.when ? fromLocalInput(v.when) : null;
    if (v.when && !scheduledFor) return { errors: { when: "Enter a date and time, or leave it empty." }, values };
    const formats = v.formats.filter((f): f is Format => formatsFor(entry).includes(f as Format));
    if (!formats.length) return { errors: { formats: "This template doesn’t come in those sizes. Pick one it offers." }, values };

    let slide = startSlide(entry, { headline: v.headline, series: v.series || undefined });
    let preset = entry.preset;
    let eventId: string | null = null;
    if (v.eventId) {
      const ev = await loadEventContext(v.eventId);
      if (!ev) return { errors: { eventId: "That event no longer exists. Pick another or leave it empty." }, values };
      const filled = slideForEvent(ev, entry.template);
      // The event's facts, drawn in the template the officer picked.
      slide = {
        ...filled,
        family: entry.family,
        fields: {
          ...filled.fields,
          ground: entry.ground,
          ...(entry.layout ? { layout: entry.layout } : {}),
          ...(entry.template === "general" ? { images: slide.fields.images } : {}),
          ...(v.headline ? { headline: v.headline } : {}),
          ...(v.series ? { series: v.series } : {}),
        },
      };
      preset = ev.preset;
      eventId = ev.id;
    }
    const row = await createPost(user, { eventId, kind: entry.kind, preset, slides: [slide], captions: emptyCaptions(), formats, channels: v.channels, scheduledFor });
    id = row.id;
  } catch (err) {
    if (isNextControlFlow(err)) throw err;
    return { ...failure(err, "templates.start"), values };
  }
  redirect(`/posts/${id}`);
}
