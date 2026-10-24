import { describe, expect, it } from "vitest";
import { formatNPRCompact, formatNumberCompact } from "@/lib/format";

describe("Nepali compact amount formatting", () => {
  const cases: [number | string | null | undefined, string][] = [
    [0, "Rs\u00a00"],
    [950, "Rs\u00a0950"],
    [999.99, "Rs\u00a0999.99"],
    [1_000, "Rs\u00a01K"],
    [12_500, "Rs\u00a012.5K"],
    [99_999, "Rs\u00a01L"],
    [100_000, "Rs\u00a01L"],
    [339_000, "Rs\u00a03.39L"],
    [3_388_345, "Rs\u00a033.88L"],
    [9_999_999, "Rs\u00a01Cr"],
    [10_000_000, "Rs\u00a01Cr"],
    [24_500_000, "Rs\u00a02.45Cr"],
    [-12_500, "-Rs\u00a012.5K"],
    [null, "–"],
    [undefined, "–"],
    [Number.NaN, "–"],
    ["1250.5", "Rs\u00a01.25K"],
  ];

  it.each(cases)("formats %s", (value, expected) => {
    expect(formatNPRCompact(value)).toBe(expected);
  });

  it("adds a leading sign for positive and negative deltas", () => {
    expect(formatNPRCompact(12_500, { showSign: true })).toBe("+Rs\u00a012.5K");
    expect(formatNPRCompact(-4_200, { showSign: true })).toBe("-Rs\u00a04.2K");
  });

  it("formats chart counts with Nepali lakh and crore suffixes", () => {
    expect(formatNumberCompact(1798)).toBe("1.8K");
    expect(formatNumberCompact(100_000)).toBe("1L");
  });
});
