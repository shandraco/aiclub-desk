"use server";

import { z } from "zod";
import { requirePermission } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { log } from "@/lib/log";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, uploadMode } from "@/lib/uploads/mode";

const Asset = z.object({
  url: z.string().max(500),
  pathname: z.string().regex(/^(photo|logo)s\/[0-9a-f-]{36}\.(jpg|png)$/),
  kind: z.enum(["photo", "logo"]),
  contentType: z.enum(IMAGE_TYPES as [string, ...string[]]),
  width: z.number().int().min(1).max(10000),
  height: z.number().int().min(1).max(10000),
  bytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
});

/**
 * Records an uploaded image after checking it is really ours: the URL must be on this desk's
 * Blob store (or the local uploads folder in dev) and the stored object must exist with an
 * image type and an allowed size. The client's own claims are not trusted.
 */
export async function registerAsset(input: z.input<typeof Asset>): Promise<{ id: string; url: string; width: number; height: number } | { error: string }> {
  const user = await requirePermission("library.edit");
  const parsed = Asset.safeParse(input);
  if (!parsed.success) return { error: "That upload didn’t look like an image from this desk." };
  const a = parsed.data;
  const mode = uploadMode();
  if (mode === "blob") {
    let u: URL;
    try {
      u = new URL(a.url);
    } catch {
      return { error: "That upload didn’t look like an image from this desk." };
    }
    if (u.protocol !== "https:" || !u.hostname.endsWith(".public.blob.vercel-storage.com") || u.pathname !== `/${a.pathname}`) {
      return { error: "That upload didn’t look like an image from this desk." };
    }
    const head = await fetch(u, { method: "HEAD" }).catch(() => null);
    const type = head?.headers.get("content-type") ?? "";
    const size = Number(head?.headers.get("content-length") ?? 0);
    if (!head?.ok || !IMAGE_TYPES.includes(type) || size > MAX_UPLOAD_BYTES) return { error: "The upload didn’t finish. Try again." };
  } else if (mode === "dev") {
    if (a.url !== `/uploads/${a.pathname}`) return { error: "That upload didn’t look like an image from this desk." };
  } else {
    return { error: "Image uploads aren’t set up on this desk yet." };
  }
  const [row] = await db()
    .insert(schema.assets)
    .values({ kind: a.kind, url: a.url, pathname: a.pathname, contentType: a.contentType, width: a.width, height: a.height, bytes: a.bytes, uploadedBy: user.id })
    .returning({ id: schema.assets.id });
  log.info("asset registered", { actor: user.id, asset: row!.id, kind: a.kind });
  return { id: row!.id, url: a.url, width: a.width, height: a.height };
}
