import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, createNonce } from "@/lib/csp";
import { REQUEST_ID_HEADER, requestIdFrom } from "@/lib/request-id";

/**
 * Runs before matched routes (Next 16 renamed middleware.ts to proxy.ts; Node runtime).
 * Two jobs only:
 *  1. A fresh CSP nonce per request. Next reads it from the request's CSP header during
 *     SSR and stamps it on its own scripts. This makes every page dynamically rendered,
 *     which is the documented cost of a nonce CSP.
 *  2. A request id, forwarded to the app (headers()) and echoed to the client.
 *
 * The signed-out redirect below is for convenience only; it checks that a cookie exists, not
 * that it is valid. Every page, action and route handler checks the session itself
 * (lib/auth/session.ts). Static security headers (HSTS etc.) live in
 * next.config.ts so they cover every path, including ones this matcher skips.
 */
/** Paths a signed-out browser may load. Everything else is redirected to /login (UX only). */
const PUBLIC = [/^\/login$/, /^\/join\/[^/]+$/, /^\/api\/blob\/upload$/, /^\/brand\//, /^\/icon\.svg$/, /^\/robots\.txt$/];
const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-desk_session" : "desk_session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (!hasSession && !PUBLIC.some((re) => re.test(pathname)) && !pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  const nonce = createNonce();
  const requestId = requestIdFrom(request.headers);
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    reportUri: process.env.CSP_REPORT_URI,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  matcher: [
    {
      // Everything except hashed static assets and image optimisation. API routes are
      // included so they get a request id too.
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
