import "server-only";

/**
 * How images get stored. "blob": Vercel Blob (production, or locally with a pulled token).
 * "dev": files under public/uploads, only in `next dev` with no Blob token. "off": neither.
 */
export type UploadMode = "blob" | "dev" | "off";

export function uploadMode(): UploadMode {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (process.env.NODE_ENV === "development") return "dev";
  return "off";
}

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
