import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireUser } from "@/lib/auth/session";
import { getRequestId } from "@/lib/request";
import { problemResponse } from "@/lib/problem";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/uploads/mode";

/**
 * Issues short-lived client upload tokens for Vercel Blob. Token requests come from a signed-in
 * browser and are checked here; the "upload completed" callback comes from Vercel and is
 * verified by handleUpload's signature check (no cookie). We don't use the callback: the
 * browser registers the asset afterwards and the server checks the stored file then.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = await getRequestId();
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return problemResponse("badRequest", requestId);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) return problemResponse("unavailable", requestId, { detail: "Vercel Blob isn't connected." });
  try {
    if (body.type === "blob.generate-client-token") await requireUser();
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const kind = clientPayload === "logo" ? "logo" : "photo";
        if (!new RegExp(`^${kind}s/[0-9a-f-]{36}\\.(jpg|png)$`).test(pathname)) throw new Error("Bad upload path");
        return {
          allowedContentTypes: IMAGE_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: false,
          validUntil: Date.now() + 5 * 60_000,
          cacheControlMaxAge: 31_536_000,
        };
      },
    });
    return Response.json(result);
  } catch (err) {
    if (err instanceof Error && err.name === "UnauthorizedError") return problemResponse("unauthorized", requestId);
    return problemResponse("badRequest", requestId, { detail: "The upload couldn’t start." });
  }
}
