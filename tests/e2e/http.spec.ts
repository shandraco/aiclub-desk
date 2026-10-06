import { expect, test } from "@playwright/test";

/** What only exists over HTTP: headers, CSP, status codes, problem details. */
const browserUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

test("pages carry a strict nonce CSP and the security headers", async ({ request }) => {
  const a = await request.get("/login", { headers: { "User-Agent": browserUA } });
  const b = await request.get("/login", { headers: { "User-Agent": browserUA } });
  const csp = a.headers()["content-security-policy"]!;
  const directives = csp.split(";").map((d) => d.trim());
  const scriptSrc = directives.find((d) => d.startsWith("script-src"))!;
  expect(scriptSrc).toMatch(/^script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'$/);
  expect(directives.filter((d) => d.includes("unsafe-inline"))).toEqual(["style-src-attr 'unsafe-inline'"]);
  expect(csp).not.toContain("unsafe-eval");
  expect(b.headers()["content-security-policy"]).not.toBe(csp);

  const nonce = /'nonce-([^']+)'/.exec(scriptSrc)![1]!;
  const html = await a.text();
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1]!).filter((attrs) => !/type="application\/(ld\+)?json"/.test(attrs));
  for (const attrs of scripts) expect(attrs).toContain(`nonce="${nonce}"`);

  const h = a.headers();
  expect(h["strict-transport-security"]).toContain("max-age=63072000");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-powered-by"]).toBeUndefined();
  expect(html).toContain('<meta name="robots" content="noindex, nofollow"');
});

test("robots.txt disallows everything", async ({ request }) => {
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
});

test("API routes answer 401 problem details when signed out", async ({ request }) => {
  const res = await request.post("/api/captions", { data: { postId: "00000000-0000-0000-0000-000000000000" } });
  expect(res.status()).toBe(401);
  expect(res.headers()["content-type"]).toBe("application/problem+json");
});

test("the cleanup cron rejects calls without the secret", async ({ request }) => {
  expect((await request.get("/api/cron/cleanup")).status()).toBe(401);
  expect((await request.get("/api/cron/cleanup", { headers: { authorization: "Bearer guess" } })).status()).toBe(401);
});

test("the dev upload route does not exist in production", async ({ request }) => {
  expect((await request.post("/api/dev-upload")).status()).toBe(404);
});
