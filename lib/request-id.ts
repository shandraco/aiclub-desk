/** Header that carries the request id from proxy.ts to the app and back to the client. */
export const REQUEST_ID_HEADER = "x-request-id";

const TRACEPARENT = /^[\da-f]{2}-([\da-f]{32})-[\da-f]{16}-[\da-f]{2}$/;

/**
 * One id per request. If the caller
 * sent a W3C `traceparent`, reuse its trace id so our logs join their trace; otherwise mint one.
 * A client-supplied `x-request-id` is ignored on purpose: anyone could forge it to muddle logs.
 */
export function requestIdFrom(headers: Headers): string {
  const match = TRACEPARENT.exec(headers.get("traceparent") ?? "");
  if (match?.[1] && match[1] !== "0".repeat(32)) return match[1];
  return crypto.randomUUID().replaceAll("-", "");
}
