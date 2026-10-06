import { describe, expect, it } from "vitest";
import { linkedInLabel, normalizeInstagram, normalizeLinkedIn } from "@/lib/team/handles";
import { tempPassword } from "@/lib/team/password";
import { postReach, whatWorked, type ResultPost } from "@/lib/team/results";
import { passwordProblem } from "@/lib/auth/rules";

describe("Instagram handles", () => {
  it("accepts a handle, @handle or a profile link and stores the bare lowercase handle", () => {
    expect(normalizeInstagram("@WSU_AIClub")).toEqual({ value: "wsu_aiclub" });
    expect(normalizeInstagram("wsu.ai")).toEqual({ value: "wsu.ai" });
    expect(normalizeInstagram("https://www.instagram.com/wsu_aiclub/?hl=en")).toEqual({ value: "wsu_aiclub" });
    expect(normalizeInstagram("  ")).toEqual({ value: "" });
  });
  it("rejects shapes Instagram does not allow", () => {
    for (const bad of ["has space", ".dot", "dot.", "two..dots", "a".repeat(31), "x.com/name", "name!"]) {
      expect(normalizeInstagram(bad)).toHaveProperty("error");
    }
  });
});

describe("LinkedIn profiles", () => {
  it("stores a canonical profile URL", () => {
    expect(normalizeLinkedIn("linkedin.com/in/ada-lovelace/")).toEqual({ value: "https://www.linkedin.com/in/ada-lovelace" });
    expect(normalizeLinkedIn("https://www.linkedin.com/company/textron-aviation?trk=x")).toEqual({ value: "https://www.linkedin.com/company/textron-aviation" });
    expect(normalizeLinkedIn("ada-lovelace")).toEqual({ value: "https://www.linkedin.com/in/ada-lovelace" });
    expect(normalizeLinkedIn("")).toEqual({ value: "" });
    expect(linkedInLabel("https://www.linkedin.com/in/ada-lovelace")).toBe("in/ada-lovelace");
  });
  it("rejects other sites and odd paths", () => {
    expect(normalizeLinkedIn("https://x.com/ada")).toHaveProperty("error");
    expect(normalizeLinkedIn("linkedin.com/feed/update/123")).toHaveProperty("error");
    expect(normalizeLinkedIn("in/a b")).toHaveProperty("error");
  });
});

describe("temporary passwords", () => {
  it("are long, unambiguous, distinct and pass the password rules", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const p = tempPassword("ben");
      expect(p).toMatch(/^[a-hj-km-np-z2-9]{5}(-[a-hj-km-np-z2-9]{5}){3}$/);
      expect(passwordProblem(p, "ben")).toBeNull();
      seen.add(p);
    }
    expect(seen.size).toBe(50);
  });
});

describe("what worked", () => {
  const post = (series: string | null, kind: string, ig: number | null, li: number | null = null): ResultPost => ({
    series,
    kind,
    reach: [
      { channel: "instagram", reach: ig },
      ...(li === null ? [] : [{ channel: "linkedin", reach: li }]),
    ],
  });

  it("adds reach across channels and ignores blanks", () => {
    expect(postReach(post("A", "Recap", 100, 50))).toBe(150);
    expect(postReach(post("A", "Recap", null))).toBeNull();
  });

  it("compares only groups with at least two posts and states the counts", () => {
    const lines = whatWorked([
      post("Speaker Series", "Announcement", 400),
      post("Speaker Series", "Announcement", 424),
      post("Speaker Series", "Recap", 412),
      post("Workshop", "Announcement", 200),
      post("Workshop", "Recap", 260),
      post("Panel", "Recap", 9000), // one post: never compared
    ]);
    expect(lines[0]).toBe("Speaker Series posts averaged 412 reach vs 230 for Workshop posts (3 and 2 posts).");
    expect(lines.join(" ")).not.toContain("Panel");
  });

  it("says nothing when no group qualifies", () => {
    expect(whatWorked([post("Speaker Series", "Recap", 400), post("Workshop", "Recap", 200)])).toEqual([]);
  });

  it("reports turnout only across events with both numbers", () => {
    const lines = whatWorked([], [
      { rsvps: 40, attendance: 30 },
      { rsvps: 60, attendance: 32 },
      { rsvps: null, attendance: 10 },
    ]);
    expect(lines).toEqual(["Across 2 events with both numbers, 62 people came for 100 RSVPs (62%)."]);
  });
});

import { usernameProblem } from "@/lib/auth/rules";
describe("usernames", () => {
  it("accepts handles and email addresses, lowercase only", () => {
    expect(usernameProblem("ada.l")).toBeNull();
    expect(usernameProblem("contact@shanuka.info")).toBeNull();
    expect(usernameProblem("first.last+club@shockers.wichita.edu")).toBeNull();
    expect(usernameProblem("Contact@x.io")).not.toBeNull();
    expect(usernameProblem("a@b")).not.toBeNull();
    expect(usernameProblem("ab")).not.toBeNull();
  });
});
