import type { z } from "zod";
import { PROBLEM_CONTENT_TYPE, ProblemSchema, type Problem } from "@/lib/problem";

export type FetchResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; problem: Problem };

/**
 * Typed fetch for our own (or any RFC 9457) API. Never throws for an HTTP error: you get a
 * discriminated union and must handle `ok: false`. Network failures and bodies that match
 * neither the schema nor problem+json come back as a synthetic problem with status 0 or the
 * real status, so the caller has one branch to write.
 *
 *   const res = await fetchJson("/api/tools", ToolListSchema);
 *   if (!res.ok) return showError(res.problem.title, res.problem.request_id);
 *   res.data // typed
 */
export async function fetchJson<S extends z.ZodType>(
  input: string | URL,
  schema: S,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
): Promise<FetchResult<z.infer<S>>> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", `application/json, ${PROBLEM_CONTENT_TYPE}`);
  if (init.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetchImpl(input, { ...init, headers });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    return {
      ok: false,
      status: 0,
      problem: { type: "about:blank", title: "Could not reach the server", status: 503, detail: String(cause) },
    };
  }

  const requestId = res.headers.get("x-request-id") ?? undefined;
  const contentType = res.headers.get("Content-Type") ?? "";
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => undefined);

  if (!res.ok) {
    const parsed = contentType.includes(PROBLEM_CONTENT_TYPE) ? ProblemSchema.safeParse(body) : null;
    if (parsed?.success) return { ok: false, status: res.status, problem: parsed.data };
    return {
      ok: false,
      status: res.status,
      problem: { type: "about:blank", title: res.statusText || "Request failed", status: res.status, request_id: requestId },
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: res.status,
      problem: {
        type: "/problems/unexpected-response",
        title: "The server sent a response this client does not understand",
        status: 502,
        detail: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        request_id: requestId,
      },
    };
  }
  return { ok: true, status: res.status, data: parsed.data };
}
