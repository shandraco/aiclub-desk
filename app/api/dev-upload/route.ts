import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/auth/session";
import { uploadMode } from "@/lib/uploads/mode";

/** Local development only, when no Blob token is set: stores images in public/uploads. */
export async function POST(request: Request): Promise<Response> {
  if (uploadMode() !== "dev") return new Response("Not found", { status: 404 });
  await requireUser();
  const fd = await request.formData();
  const file = fd.get("file");
  const kind = fd.get("kind") === "logo" ? "logo" : "photo";
  if (!(file instanceof File) || file.size > 8 * 1024 * 1024) return new Response("Bad file", { status: 400 });
  const ext = kind === "logo" ? "png" : "jpg";
  const name = `${crypto.randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", `${kind}s`);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return Response.json({ url: `/uploads/${kind}s/${name}`, pathname: `${kind}s/${name}` });
}
