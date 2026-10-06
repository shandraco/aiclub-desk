import "server-only";
import { ForbiddenError, UnauthorizedError, requireUser, type User } from "@/lib/auth/session";
import type { Logger } from "@/lib/log";
import { problemResponse } from "@/lib/problem";
import { getRequestId, requestLogger } from "@/lib/request";

export interface ApiContext {
  user: User;
  requestId: string;
  log: Logger;
}

/**
 * Wraps a route handler so that every one of them:
 *  - calls requireUser() first (401 problem if there is no user), for every method;
 *  - turns anything unexpected into a 500 problem carrying only the request id, with the
 *    stack in the log and never in the body;
 *  - logs one line per request: route pattern, status, duration_ms, request_id.
 * Pass `{ public: true }` for a deliberately public endpoint, so it reads as a decision.
 */
export function apiRoute<Args extends unknown[]>(
  route: string,
  handler: (ctx: ApiContext, request: Request, ...args: Args) => Promise<Response>,
  options: { public?: boolean } = {},
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    const started = performance.now();
    const requestId = await getRequestId();
    const log = await requestLogger(`${request.method} ${route}`);
    let response: Response;
    try {
      const user: User = options.public ? { id: "anonymous", username: "", displayName: "", role: "member" } : await requireUser();
      response = await handler({ user, requestId, log: log.child({ actor: user.id }) }, request, ...args);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        response = problemResponse("unauthorized", requestId, { detail: "This endpoint needs a signed-in user." });
      } else if (err instanceof ForbiddenError) {
        response = problemResponse("forbidden", requestId, { detail: err.message });
      } else {
        log.error("unhandled error in route handler", { error: err instanceof Error ? err : new Error(String(err)) });
        response = problemResponse("internal", requestId);
      }
    }
    response.headers.set("x-request-id", requestId);
    log.info("request", { status: response.status, duration_ms: Math.round(performance.now() - started) });
    return response;
  };
}

/** JSON for a per-user response. `private, no-store`: never in a shared cache. */
export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return Response.json(data, { ...init, headers });
}
