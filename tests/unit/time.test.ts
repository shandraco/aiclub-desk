import { describe, expect, it } from "vitest";
import { addDays, dayKey, fromLocalInput, fromZoned, startOfWeek, toLocalInput, zoned } from "@/lib/time";

describe("Wichita time", () => {
  it("converts wall-clock time to UTC across daylight saving", () => {
    // CDT (UTC-5) in October, CST (UTC-6) in December.
    expect(fromZoned(2026, 10, 14, 18, 0).toISOString()).toBe("2026-10-14T23:00:00.000Z");
    expect(fromZoned(2026, 12, 3, 18, 0).toISOString()).toBe("2026-12-04T00:00:00.000Z");
  });
  it("puts a late-evening UTC timestamp on the right Wichita day", () => {
    expect(dayKey(new Date("2026-10-15T03:30:00Z"))).toBe("2026-10-14");
  });
  it("round-trips datetime-local values", () => {
    const d = fromLocalInput("2026-11-01T09:30")!;
    expect(toLocalInput(d)).toBe("2026-11-01T09:30");
    expect(zoned(d).hour).toBe(9);
  });
  it("does calendar arithmetic on day keys", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(startOfWeek("2026-10-18")).toBe("2026-10-12"); // Sunday -> Monday before
    expect(startOfWeek("2026-10-12")).toBe("2026-10-12");
  });
});
