import { describe, expect, it } from "vitest";
import { deviceLines, legacyAdjustment, parseReceiptFormat, warrantyLines } from "@/lib/receipt-helpers";

describe("receipt helpers", () => {
  it("prints IMEI 1 and IMEI 2 when both exist", () => {
    expect(deviceLines({ serialSnapshot: ["111", "222"], imei2Snapshot: ["333", ""] })).toEqual(["IMEI 1: 111 · IMEI 2: 333", "IMEI/Serial: 222"]);
  });
  it("lists only active warranties", () => {
    const lines = warrantyLines([{ tag: "A-W1", endsAt: new Date("2027-01-01"), status: "ACTIVE" }, { tag: "A-W2", endsAt: new Date("2027-01-01"), status: "VOIDED" }]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("A-W1");
  });
  it("reports a legacy adjustment only when total differs from subtotal − discount", () => {
    expect(legacyAdjustment({ subtotal: "1000", discount: "100", total: "900" }).isZero()).toBe(true);
    expect(legacyAdjustment({ subtotal: "1000", discount: "0", total: "1130" }).toFixed(2)).toBe("130.00");
  });
  it("defaults to A4", () => {
    expect(parseReceiptFormat("thermal")).toBe("thermal");
    expect(parseReceiptFormat("x")).toBe("a4");
    expect(parseReceiptFormat(null)).toBe("a4");
  });
});
