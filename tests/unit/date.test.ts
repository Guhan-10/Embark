import { describe, expect, it } from "vitest";
import { addDays, dateKey, daysBetween, startOfToday } from "@/lib/utils/date";

describe("dates", () => {
  it("uses the company's calendar day, not UTC's", () => {
    // 00:30 in India on 2 Nov is still 1 Nov in UTC.
    const lateNightIst = new Date("2026-11-01T19:00:00Z");
    expect(dateKey(startOfToday(lateNightIst, "Asia/Kolkata"))).toBe("2026-11-02");
    expect(dateKey(startOfToday(lateNightIst, "UTC"))).toBe("2026-11-01");
  });

  it("counts whole days", () => {
    const a = new Date("2026-11-02T00:00:00Z");
    expect(daysBetween(a, addDays(a, 7))).toBe(7);
    expect(daysBetween(addDays(a, 3), a)).toBe(-3);
  });
});
