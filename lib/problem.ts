import { z } from "zod";

/**
 * RFC 9457 problem details. One error shape for every route handler, one parser on the client.
 */
export const ProblemSchema = z
  .object({
    type: z.string().default("about:blank"),
    title: z.string(),
    status: z.number().int().min(400).max(599),
    detail: z.string().optional(),
    instance: z.string().optional(),
    request_id: z.string().optional(),
    errors: z.array(z.object({ pointer: z.string(), detail: z.string() })).optional(),
  })
  .loose(); // RFC 9457: clients must ignore extension members they do not know.

export type Problem = z.infer<typeof ProblemSchema>;
export type FieldError = NonNullable<Problem["errors"]>[number];

export const PROBLEM_CONTENT_TYPE = "application/problem+json";

/** Problem types this app emits. Titles are fixed per type; `detail` varies per occurrence. */
export const problemTypes = {
  badRequest: { type: "/problems/bad-request", title: "Request could not be read", status: 400 },
  unauthorized: { type: "/problems/unauthorized", title: "Sign in to continue", status: 401 },
  forbidden: { type: "/problems/forbidden", title: "Your role can't do that", status: 403 },
  tooMany: { type: "/problems/too-many-requests", title: "Too many requests", status: 429 },
  unavailable: { type: "/problems/unavailable", title: "Not set up yet", status: 503 },
  notFound: { type: "/problems/not-found", title: "Not found", status: 404 },
  conflict: { type: "/problems/conflict", title: "Conflicts with the current state", status: 409 },
  validation: { type: "/problems/validation", title: "Request failed validation", status: 422 },
  internal: { type: "about:blank", title: "Something went wrong on our side", status: 500 },
} as const;

export type ProblemKind = keyof typeof problemTypes;

export function problemResponse(
  kind: ProblemKind,
  requestId: string,
  extra: { detail?: string; errors?: FieldError[]; headers?: HeadersInit } = {},
): Response {
  const { type, title, status } = problemTypes[kind];
  const body: Problem = { type, title, status, request_id: requestId };
  if (extra.detail) body.detail = extra.detail;
  if (extra.errors?.length) body.errors = extra.errors;
  const headers = new Headers(extra.headers);
  headers.set("Content-Type", PROBLEM_CONTENT_TYPE);
  headers.set("Cache-Control", "no-store");
  if (kind === "unauthorized" && !headers.has("WWW-Authenticate")) {
    headers.set("WWW-Authenticate", 'Bearer realm="api"');
  }
  return new Response(JSON.stringify(body), { status, headers });
}

/** Zod issues to RFC 9457 `errors`, with JSON Pointers into the request body. */
export function zodToFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    pointer: "/" + issue.path.map((p) => String(p).replaceAll("~", "~0").replaceAll("/", "~1")).join("/"),
    detail: issue.message,
  }));
}
