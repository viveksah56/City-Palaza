import { describe, expect, it } from "vitest";
import { resolveRange } from "@/lib/dates";

describe("Kathmandu report ranges", () => {
  it("maps local day boundaries to UTC with the +05:45 offset", () => {
    const range = resolveRange("custom", "2026-10-23", "2026-10-23");
    expect(range.from.toISOString()).toBe("2026-10-22T18:15:00.000Z");
    expect(range.to.toISOString()).toBe("2026-10-23T18:15:00.000Z");
  });

  it("uses exclusive end boundaries across month and year transitions", () => {
    const month = resolveRange("custom", "2026-01-31", "2026-02-01");
    expect(month.to.getTime() - month.from.getTime()).toBe(2 * 86_400_000);
    const year = resolveRange("thisYear", undefined, undefined, { now: new Date("2026-12-31T12:00:00.000Z") });
    expect(year.from.toISOString()).toBe("2025-12-31T18:15:00.000Z");
    expect(year.to.toISOString()).toBe("2026-12-31T18:15:00.000Z");
  });

  it("falls back to the last 30 days for invalid custom ranges", () => {
    const range = resolveRange("custom", "2026-10-24", "2026-10-23", { now: new Date("2026-10-23T12:00:00.000Z") });
    expect(range.preset).toBe("last30");
  });
});
