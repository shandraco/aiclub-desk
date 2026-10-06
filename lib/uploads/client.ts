"use client";

import { upload } from "@vercel/blob/client";
import { registerAsset } from "@/app/(desk)/assets/actions";

export type AssetKind = "photo" | "logo";
export interface UploadedAsset {
  id: string;
  url: string;
  width: number;
  height: number;
}

const MAX_EDGE = { photo: 2400, logo: 1600 };

/**
 * Re-encodes an image in the browser before upload: caps the long edge, drops EXIF (including
 * GPS from phone photos) and turns SVG into PNG, so nothing executable is ever stored.
 * Photos become JPEG; logos stay PNG so transparency survives.
 */
export async function prepareImage(file: File, kind: AssetKind): Promise<{ blob: Blob; width: number; height: number; type: string; ext: string }> {
  if (!/^image\/(jpeg|png|webp|svg\+xml|heic|heif|gif)$/.test(file.type)) {
    throw new Error("Use a JPEG, PNG, WebP or SVG image.");
  }
  if (file.size > 40 * 1024 * 1024) throw new Error("That file is over 40 MB. Use a smaller copy.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode().catch(() => {
      throw new Error("That image couldn’t be read. Try saving it as JPEG or PNG first.");
    });
    let w = img.naturalWidth || 1200;
    let h = img.naturalHeight || 1200;
    const max = MAX_EDGE[kind];
    const scale = Math.min(1, max / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    const type = kind === "logo" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error("Couldn’t encode the image."))), type, 0.9));
    return { blob, width: w, height: h, type, ext: kind === "logo" ? "png" : "jpg" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Uploads one image and records it in the library's asset table. */
export async function uploadImage(file: File, kind: AssetKind, mode: "blob" | "dev" | "off"): Promise<UploadedAsset> {
  if (mode === "off") throw new Error("Image uploads aren’t set up on this desk yet. An admin needs to connect Vercel Blob.");
  const prepared = await prepareImage(file, kind);
  const name = `${kind}s/${crypto.randomUUID()}.${prepared.ext}`;
  let url: string;
  let pathname: string;
  if (mode === "blob") {
    const res = await upload(name, prepared.blob, { access: "public", handleUploadUrl: "/api/blob/upload", contentType: prepared.type, clientPayload: kind });
    url = res.url;
    pathname = res.pathname;
  } else {
    const fd = new FormData();
    fd.set("file", prepared.blob, name.split("/")[1]);
    fd.set("kind", kind);
    const res = await fetch("/api/dev-upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error("The local upload failed.");
    ({ url, pathname } = (await res.json()) as { url: string; pathname: string });
  }
  const asset = await registerAsset({ url, pathname, kind, contentType: prepared.type, width: prepared.width, height: prepared.height, bytes: prepared.blob.size });
  if ("error" in asset) throw new Error(asset.error);
  return asset;
}
