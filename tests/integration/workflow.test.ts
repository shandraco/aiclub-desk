import { describe, expect, it } from "vitest";
import type { User } from "@/lib/auth/session";
import { blankFields } from "@/lib/brand/presets";
import { db, schema } from "@/lib/db";
import { emptyCaptions } from "@/lib/posts/factory";
import type { Slide } from "@/lib/posts/types";
import { approve, ConflictError, createPost, markPosted, requestChanges, requestReview, saveContent } from "@/lib/posts/workflow";

async function user(username: string, role: User["role"]): Promise<User> {
  const [u] = await db().insert(schema.users).values({ username, displayName: username, passwordHash: "x", role }).returning();
  return { id: u!.id, username, displayName: username, role };
}

const goodSlide = (): Slide => ({ id: "a", template: "event", fields: { ...blankFields("event"), headline: "Build a chatbot that reads the catalog" } });
const allChecked = { facts: true, tagged: true, consent: true };

async function newPost(author: User) {
  return createPost(author, { eventId: null, kind: "custom", preset: "workshop", slides: [goodSlide()], captions: { ...emptyCaptions(), alt: "Alt" }, formats: ["feed"], channels: [], scheduledFor: null });
}

describe("post review workflow", async () => {
  const ada = await user(`ada${Date.now()}`, "officer");
  const ben = await user(`ben${Date.now()}`, "officer");
  const cam = await user(`cam${Date.now()}`, "member");

  it("refuses a save from a stale version instead of overwriting", async () => {
    const p = await newPost(ada);
    const saved = await saveContent(ada, p.id, p.version, { captions: { ...emptyCaptions(), alt: "one" } });
    expect(saved.version).toBe(p.version + 1);
    await expect(saveContent(ben, p.id, p.version, { captions: { ...emptyCaptions(), alt: "two" } })).rejects.toBeInstanceOf(ConflictError);
  });

  it("does not let the author approve their own post", async () => {
    const p = await newPost(ada);
    const r = await requestReview(ada, p.id, p.version, null, "");
    await expect(approve(ada, p.id, r.version, allChecked, "")).rejects.toThrow("someone else has to approve");
  });

  it("does not let the last editor approve, even if they are not the author", async () => {
    const p = await newPost(ada);
    const s = await saveContent(ben, p.id, p.version, { kind: "announce" });
    const r = await requestReview(ada, p.id, s.version, null, "");
    await expect(approve(ben, p.id, r.version, allChecked, "")).rejects.toThrow("last edit");
  });

  it("does not let a member approve", async () => {
    const p = await newPost(ada);
    const r = await requestReview(ada, p.id, p.version, null, "");
    await expect(approve(cam, p.id, r.version, allChecked, "")).rejects.toThrow("Only officers and admins");
  });

  it("requires the review checklist", async () => {
    const p = await newPost(ada);
    const r = await requestReview(ada, p.id, p.version, null, "");
    await expect(approve(ben, p.id, r.version, { facts: true, tagged: false, consent: false }, "")).rejects.toThrow("Tick every review box");
  });

  it("ties approval to the version the approver saw", async () => {
    const p = await newPost(ada);
    const r = await requestReview(ada, p.id, p.version, null, "");
    await saveContent(ada, p.id, r.version, { kind: "announce" });
    await expect(approve(ben, p.id, r.version, allChecked, "")).rejects.toBeInstanceOf(ConflictError);
  });

  it("lets only one of two simultaneous approvals win", async () => {
    const dee = await user(`dee${Date.now()}`, "officer");
    const p = await newPost(ada);
    const r = await requestReview(ada, p.id, p.version, null, "");
    const results = await Promise.allSettled([approve(ben, p.id, r.version, allChecked, ""), approve(dee, p.id, r.version, allChecked, "")]);
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });

  it("sends an approved post back to review when it is edited", async () => {
    const p = await newPost(ada);
    const r = await requestReview(ada, p.id, p.version, null, "");
    const a = await approve(ben, p.id, r.version, allChecked, "Looks right");
    expect(a.status).toBe("approved");
    const edited = await saveContent(ada, p.id, a.version, { kind: "announce" });
    expect(edited.status).toBe("in_review");
    expect(edited.approvedBy).toBeNull();
  });

  it("refuses approval while the brand check has errors", async () => {
    const p = await createPost(ada, { eventId: null, kind: "custom", preset: "workshop", slides: [{ ...goodSlide(), fields: { ...goodSlide().fields, headline: "Thrilled to announce this!" } }], captions: emptyCaptions(), formats: ["feed"], channels: [], scheduledFor: null });
    const r = await requestReview(ada, p.id, p.version, null, "");
    await expect(approve(ben, p.id, r.version, allChecked, "")).rejects.toThrow("Fix the brand check first");
  });

  it("needs a reason to ask for changes, and only accepts https post links", async () => {
    const p = await newPost(ada);
    const r = await requestReview(ada, p.id, p.version, null, "");
    await expect(requestChanges(ben, p.id, r.version, "  ")).rejects.toThrow("Say what needs to change");
    const a = await approve(ben, p.id, r.version, allChecked, "");
    const posted = await markPosted(ben, p.id, a.version, { instagram: "https://instagram.com/p/x", linkedin: "javascript:alert(1)" });
    expect(posted.postedUrls).toEqual({ instagram: "https://instagram.com/p/x" });
  });
});
