import { describe, expect, it } from "vitest";
import { buildCsp } from "@/lib/csp";
import { parseEnv } from "@/lib/env";
import { _redact } from "@/lib/log";
import { requestIdFrom } from "@/lib/request-id";

describe("CSP", () => {
  it("never allows inline scripts in production", () => {
    const csp = buildCsp({ nonce: "abc", isDev: false });
    const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src"))!;
    expect(scriptSrc).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    // Only style attributes (React style props) may be inline; never scripts or style tags.
    const inline = csp.split("; ").filter((d) => d.includes("unsafe-inline"));
    expect(inline).toEqual(["style-src-attr 'unsafe-inline'"]);
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("allows eval only in development", () => {
    expect(buildCsp({ nonce: "n", isDev: true })).toContain("'unsafe-eval'");
  });
});

describe("request id", () => {
  it("reuses the trace id from a W3C traceparent", () => {
    const h = new Headers({ traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" });
    expect(requestIdFrom(h)).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
  });
  it("ignores a client-chosen x-request-id and mints a new one", () => {
    const id = requestIdFrom(new Headers({ "x-request-id": "forged-by-client" }));
    expect(id).toMatch(/^[\da-f]{32}$/);
  });
});

describe("env", () => {
  it("requires SITE_URL for a production build", () => {
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow(/SITE_URL/);
  });
  it("requires a database on Vercel production", () => {
    expect(() => parseEnv({ NODE_ENV: "production", VERCEL_ENV: "production", SITE_URL: "https://x.test" })).toThrow(/DATABASE_URL/);
  });
  it("falls back to the Vercel production host and strips a trailing slash", () => {
    expect(parseEnv({ NODE_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "shed.vercel.app" }).SITE_URL).toBe("https://shed.vercel.app");
    expect(parseEnv({ SITE_URL: "https://shed.test/" }).SITE_URL).toBe("https://shed.test");
  });
});

describe("helpers", () => {
  it("redacts secrets and emails by key at any depth", () => {
    expect(_redact({ user: { email: "a@b.c", id: "u1" }, headers: { authorization: "Bearer x" } })).toEqual({
      user: { email: "[redacted]", id: "u1" },
      headers: { authorization: "[redacted]" },
    });
  });
});
