/**
 * Strict, nonce-based Content Security Policy, built per request in proxy.ts.
 * Follows nextjs.org/docs/app/guides/content-security-policy (Next 16):
 *  - 'nonce-…' + 'strict-dynamic': only scripts carrying this request's nonce run, and
 *    whatever they load is trusted transitively. No 'unsafe-inline' for scripts, ever.
 *  - 'unsafe-eval' only in development (React uses eval for dev-only error overlays).
 *  - Styles: nonce in production; 'unsafe-inline' in dev for hot reload.
 *
 * Adding a third party (analytics, Stripe, a map): add its origins to the right list below
 * with a reason, pass `nonce` to its <Script>, and re-run the e2e CSP test.
 */
export interface CspOptions {
  nonce: string;
  isDev: boolean;
  reportUri?: string;
}

/** origin -> why it is allowed. Empty by default: the starter loads nothing third-party. */
export const allowedOrigins = {
  connect: {
    // Photos and logos: fetched by the PNG exporter, uploaded to directly from the browser.
    "https://*.public.blob.vercel-storage.com": "Vercel Blob (photos, logos)",
    "https://vercel.com": "Vercel Blob client upload token exchange",
  } as Record<string, string>,
  img: { "https://*.public.blob.vercel-storage.com": "Vercel Blob (photos, logos)" } as Record<string, string>,
  frame: {} as Record<string, string>,
};

export function buildCsp({ nonce, isDev, reportUri }: CspOptions): string {
  const list = (o: Record<string, string>) => Object.keys(o).join(" ");
  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": `'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src": isDev ? "'self' 'unsafe-inline'" : `'self' 'nonce-${nonce}'`,
    // React `style` props (crop focus, scale) are attributes, which nonces cannot cover.
    "style-src-attr": "'unsafe-inline'",
    "img-src": `'self' blob: data: ${list(allowedOrigins.img)}`.trim(),
    "font-src": "'self'",
    "connect-src": `'self' ${list(allowedOrigins.connect)}${isDev ? " ws:" : ""}`.trim(),
    "frame-src": list(allowedOrigins.frame) || "'none'",
    "object-src": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
    "frame-ancestors": "'none'",
    "manifest-src": "'self'",
    "worker-src": "'self' blob:",
  };
  if (!isDev) directives["upgrade-insecure-requests"] = "";
  if (reportUri) directives["report-uri"] = reportUri;
  return Object.entries(directives)
    .map(([k, v]) => (v ? `${k} ${v}` : k))
    .join("; ");
}

export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
