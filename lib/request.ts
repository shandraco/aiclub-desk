import "server-only";
import { headers } from "next/headers";
import { log, type Logger } from "@/lib/log";
import { REQUEST_ID_HEADER } from "@/lib/request-id";

/** The id proxy.ts stamped on this request. Falls back to "unknown" if proxy did not run. */
export async function getRequestId(): Promise<string> {
  return (await headers()).get(REQUEST_ID_HEADER) ?? "unknown";
}

/** A logger that puts request_id and route on every line. `route` is the pattern, not the URL. */
export async function requestLogger(route: string): Promise<Logger> {
  return log.child({ request_id: await getRequestId(), route });
}
