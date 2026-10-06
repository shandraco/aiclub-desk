"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, isNextControlFlow, type FormState } from "@/lib/actions";
import { requirePermission } from "@/lib/auth/session";
import { presetByKey, PRESETS } from "@/lib/brand/presets";
import { loadEventContext } from "@/lib/data/events";
import { emptyCaptions, slideForEvent, slideForPreset } from "@/lib/posts/factory";
import type { Format } from "@/lib/posts/types";
import { TEMPLATES } from "@/lib/posts/types";
import { createPost } from "@/lib/posts/workflow";

const Input = z.object({
  preset: z.enum(PRESETS.map((p) => p.key) as [string, ...string[]]).optional(),
  eventId: z.uuid().optional(),
  template: z.enum(["preset", "event", "speaker", "general", "recap", "blank"]).optional(),
});

/**
 * Starts a post and opens it in the editor. Standalone: from a preset. With an event: a
 * custom post for that event, filled from its facts, in the template chosen.
 */
export async function startPost(_prev: FormState, fd: FormData): Promise<FormState> {
  let id: string;
  try {
    const user = await requirePermission("post.edit");
    const parsed = Input.safeParse({
      preset: fd.get("preset") || undefined,
      eventId: fd.get("eventId") || undefined,
      template: fd.get("template") || undefined,
    });
    if (!parsed.success) return { message: "Pick one of the starting points." };
    const { preset, eventId, template } = parsed.data;
    if (eventId) {
      const ev = await loadEventContext(eventId);
      if (!ev) return { message: "That event no longer exists. Pick a starting point below instead." };
      const slide = slideForEvent(ev, template ?? "preset");
      const formats: Format[] = TEMPLATES[slide.template].formats.slice(0, 1);
      const row = await createPost(user, { eventId: ev.id, kind: "custom", preset: ev.preset, slides: [slide], captions: emptyCaptions(), formats, channels: ["instagram"], scheduledFor: null });
      id = row.id;
    } else {
      if (!preset) return { message: "Pick one of the starting points." };
      const p = presetByKey(preset);
      const slide = slideForPreset(p.key);
      const row = await createPost(user, {
        eventId: null,
        kind: p.key === "photos" ? "photos" : p.key === "recap" ? "recap" : "custom",
        preset: p.key,
        slides: [slide],
        captions: emptyCaptions(),
        formats: ["feed"],
        channels: ["instagram"],
        scheduledFor: null,
      });
      id = row.id;
    }
  } catch (err) {
    if (isNextControlFlow(err)) throw err;
    return failure(err, "posts.start");
  }
  redirect(`/posts/${id}`);
}
