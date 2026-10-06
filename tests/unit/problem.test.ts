import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fetchJson } from "@/lib/fetch-json";
import { problemResponse, zodToFieldErrors } from "@/lib/problem";
const ToolListSchema = z.object({ items: z.array(z.unknown()) });
const NewToolSchema = z.object({
  name: z.string().min(1, "Enter the tool's name"),
  category: z.enum(["garden", "kitchen"], { message: "Choose a category" }),
  contact: z.email({ message: "Enter an email address in the format name@example.com" }),
});

const fakeFetch = (res: Response): typeof fetch => async () => res;

describe("problem details", () => {
  it("maps zod issues to RFC 9457 errors with JSON pointers", () => {
    const parsed = NewToolSchema.safeParse({ name: "", category: "boats", contact: "nope" });
    expect(parsed.success).toBe(false);
    const errors = zodToFieldErrors(parsed.error!);
    expect(errors).toEqual([
      { pointer: "/name", detail: "Enter the tool's name" },
      { pointer: "/category", detail: "Choose a category" },
      { pointer: "/contact", detail: "Enter an email address in the format name@example.com" },
    ]);
  });

  it("escapes ~ and / in pointers", () => {
    const schema = z.object({ "a/b": z.object({ "c~d": z.string() }) });
    const r = schema.safeParse({ "a/b": { "c~d": 1 } });
    expect(zodToFieldErrors(r.error!)[0]!.pointer).toBe("/a~1b/c~0d");
  });

  it("builds a response with the right status, content type and request id", async () => {
    const res = problemResponse("validation", "req_1", { errors: [{ pointer: "/name", detail: "x" }] });
    expect(res.status).toBe(422);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    expect(await res.json()).toMatchObject({ status: 422, request_id: "req_1", title: "Request failed validation" });
  });

  it("sends WWW-Authenticate with a 401", () => {
    expect(problemResponse("unauthorized", "r").headers.get("www-authenticate")).toContain("Bearer");
  });
});

describe("fetchJson", () => {
  it("returns typed data on success", async () => {
    const res = Response.json({ items: [] });
    const out = await fetchJson("/api/tools", ToolListSchema, {}, fakeFetch(res));
    expect(out).toEqual({ ok: true, status: 200, data: { items: [] } });
  });

  it("parses a problem+json error, keeping extension members", async () => {
    const body = { type: "/problems/validation", title: "Request failed validation", status: 422, request_id: "abc", errors: [{ pointer: "/name", detail: "Enter the tool's name" }], extra: 1 };
    const res = new Response(JSON.stringify(body), { status: 422, headers: { "Content-Type": "application/problem+json" } });
    const out = await fetchJson("/api/tools", ToolListSchema, { method: "POST", body: "{}" }, fakeFetch(res));
    expect(out.ok).toBe(false);
    if (out.ok) return;
    expect(out.problem.request_id).toBe("abc");
    expect(out.problem.errors?.[0]?.pointer).toBe("/name");
    expect((out.problem as Record<string, unknown>).extra).toBe(1);
  });

  it("turns a non-problem error (proxy HTML page) into a problem", async () => {
    const res = new Response("<html>Bad gateway</html>", { status: 502, statusText: "Bad Gateway", headers: { "x-request-id": "r9" } });
    const out = await fetchJson("/x", ToolListSchema, {}, fakeFetch(res));
    expect(out).toMatchObject({ ok: false, status: 502, problem: { title: "Bad Gateway", request_id: "r9" } });
  });

  it("flags a 200 whose body does not match the schema", async () => {
    const out = await fetchJson("/x", ToolListSchema, {}, fakeFetch(Response.json({ nope: true })));
    expect(out).toMatchObject({ ok: false, problem: { type: "/problems/unexpected-response" } });
  });

  it("reports a network failure instead of throwing", async () => {
    const failing: typeof fetch = async () => {
      throw new TypeError("fetch failed");
    };
    const out = await fetchJson("/x", ToolListSchema, {}, failing);
    expect(out).toMatchObject({ ok: false, status: 0, problem: { title: "Could not reach the server" } });
  });
});
