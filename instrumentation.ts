import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

/**
 * Runs once when a server instance starts, before it takes requests.
 *
 * 1. Validates the environment so a bad deploy fails at boot, not on the first request.
 * 2. OpenTelemetry plugs in here: `pnpm add @vercel/otel @opentelemetry/api`, then
 *      const { registerOTel } = await import("@vercel/otel");
 *      registerOTel({ serviceName: "your-app" });
 *    That gives a root span per request plus render and fetch spans, exported over OTLP
 *    (set OTEL_EXPORTER_OTLP_ENDPOINT) or to Vercel's trace drains. Use the trace id as the
 *    request id; lib/request-id.ts already reuses an incoming traceparent.
 */
export async function register() {
  // Lookout (our Sentry-compatible tracker): only when a DSN is set, no tracing, no PII.
  if (process.env.SENTRY_DSN) {
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0, sendDefaultPii: false });
  }
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { env } = await import("@/lib/env");
  const { log } = await import("@/lib/log");
  log.info("server starting", {
    vercel_env: env.VERCEL_ENV ?? "local",
    site_url: env.SITE_URL,
    database: env.DATABASE_URL ? "set" : "missing",
    blob: env.BLOB_READ_WRITE_TOKEN ? "set" : "missing",
  });
}

/**
 * Every uncaught server error (render, route handler, server action, proxy) lands here once,
 * as one JSON line carrying the same request id the user can quote from the error page.
 * Forward to Sentry or similar here if you add one.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  Sentry.captureRequestError(err, request, context);
  const { log } = await import("@/lib/log");
  const header = request.headers["x-request-id"];
  log.error("request failed", {
    request_id: Array.isArray(header) ? header[0] : header,
    method: request.method,
    route: context.routePath,
    route_type: context.routeType,
    digest: typeof err === "object" && err && "digest" in err ? String(err.digest) : undefined,
    error: err instanceof Error ? err : new Error(String(err)),
  });
};
