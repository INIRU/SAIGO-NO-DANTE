import { describe, expect, it } from "vitest";
import { popularSince, updateWeekStart } from "@/lib/discovery/update-window";

const iso = (d: Date) => d.toISOString();

describe("updateWeekStart (Thursday 12:00 KST = Thursday 03:00 UTC)", () => {
  it("Thursday after noon KST starts that same day", () => {
    expect(iso(updateWeekStart(new Date("2026-10-15T04:00:00Z")))).toBe("2026-10-15T03:00:00.000Z");
  });
  it("Thursday before noon KST starts the previous Thursday", () => {
    expect(iso(updateWeekStart(new Date("2026-10-15T02:59:59Z")))).toBe("2026-10-08T03:00:00.000Z");
  });
  it("exactly 12:00 KST rolls over", () => {
    expect(iso(updateWeekStart(new Date("2026-10-15T03:00:00Z")))).toBe("2026-10-15T03:00:00.000Z");
  });
  it("Wednesday uses the previous Thursday", () => {
    expect(iso(updateWeekStart(new Date("2026-10-14T20:00:00Z")))).toBe("2026-10-08T03:00:00.000Z");
  });
  it("a UTC Wednesday that is already Thursday in KST (before noon) uses the previous Thursday", () => {
    expect(iso(updateWeekStart(new Date("2026-10-14T16:00:00Z")))).toBe("2026-10-08T03:00:00.000Z");
  });
  it("spans the year boundary", () => {
    expect(iso(updateWeekStart(new Date("2027-01-02T00:00:00Z")))).toBe("2026-12-31T03:00:00.000Z");
  });
});

describe("popularSince", () => {
  const now = new Date("2026-10-18T00:00:00Z");
  it("week is the current update week's UTC day", () => {
    expect(popularSince("week", now)).toBe("2026-10-15");
  });
  it("month starts three weeks before the weekly start", () => {
    expect(popularSince("month", now)).toBe("2026-09-24");
  });
  it("all has no lower bound", () => {
    expect(popularSince("all", now)).toBeNull();
  });
});
