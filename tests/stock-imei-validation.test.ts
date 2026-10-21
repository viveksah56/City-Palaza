import { describe, expect, it } from "vitest";
import { stockStatus } from "@/lib/stock";
import { imeiFromBody, isValidImei, normalizeSerial, normalizeSerials } from "@/lib/imei";
import { productSchema } from "@/validations/product";
import { createSaleSchema } from "@/validations/sale";
import { resolveRange } from "@/lib/dates";

describe("stock status", () => {
  it("derives IN_STOCK / LOW_STOCK / OUT_OF_STOCK from quantity and minimum", () => {
    expect(stockStatus(0, 5)).toBe("OUT_OF_STOCK");
    expect(stockStatus(1, 5)).toBe("LOW_STOCK");
    expect(stockStatus(5, 5)).toBe("LOW_STOCK");
    expect(stockStatus(6, 5)).toBe("IN_STOCK");
    expect(stockStatus(-1, 0)).toBe("OUT_OF_STOCK");
  });
});

describe("IMEI / serial handling", () => {
  it("validates 15-digit Luhn IMEIs", () => {
    const ok = imeiFromBody("35482109612345");
    expect(isValidImei(ok)).toBe(true);
    expect(isValidImei(ok.slice(0, 14) + ((Number(ok[14]) + 1) % 10))).toBe(false);
    expect(isValidImei("123")).toBe(false);
    expect(isValidImei("abcdefghijklmno")).toBe(false);
  });
  it("normalises scanner input", () => expect(normalizeSerial(" ab-12 34\n")).toBe("AB1234"));
  it("rejects duplicates inside one submission", () => {
    const a = imeiFromBody("35000000000001");
    expect(() => normalizeSerials([a, a], "IMEI")).toThrow(/Duplicate/);
  });
  it("rejects malformed IMEIs and serials", () => {
    expect(() => normalizeSerials(["12345"], "IMEI")).toThrow(/valid/);
    expect(() => normalizeSerials(["!!"], "SERIALIZED")).toThrow(/valid/);
    expect(normalizeSerials(["sn-0001"], "SERIALIZED")).toEqual(["SN0001"]);
  });
});

describe("product validation", () => {
  const ok = { sku: "IP15-128", name: "iPhone 15", categoryId: "c1", purchasePrice: 90000, sellingPrice: 100000, discountPercent: 0, minStock: 2, trackingType: "IMEI" as const, status: "ACTIVE" as const };
  it("accepts a valid product", () => expect(productSchema.safeParse(ok).success).toBe(true));
  it("rejects bad SKU, negative or 3-decimal prices, and missing category", () => {
    expect(productSchema.safeParse({ ...ok, sku: "bad sku!" }).success).toBe(false);
    expect(productSchema.safeParse({ ...ok, sellingPrice: -1 }).success).toBe(false);
    expect(productSchema.safeParse({ ...ok, sellingPrice: 10.123 }).success).toBe(false);
    expect(productSchema.safeParse({ ...ok, categoryId: "" }).success).toBe(false);
  });
});

describe("sale input validation", () => {
  it("never accepts prices/totals – only product ids and quantities", () => {
    const parsed = createSaleSchema.parse({ items: [{ productId: "p", quantity: 1, price: 1, total: 1 }], paymentMethod: "CASH", total: 1 });
    expect(JSON.stringify(parsed)).not.toContain("price");
    expect(JSON.stringify(parsed)).not.toContain('"total"');
  });
  it("requires at least one item and a valid payment method", () => {
    expect(createSaleSchema.safeParse({ items: [], paymentMethod: "CASH" }).success).toBe(false);
    expect(createSaleSchema.safeParse({ items: [{ productId: "p", quantity: 1 }], paymentMethod: "BITCOIN" }).success).toBe(false);
  });
});

describe("date ranges", () => {
  const now = new Date("2026-03-15T10:00:00Z");
  it("resolves today in the shop's timezone with an exclusive end", () => {
    const r = resolveRange("today", undefined, undefined, { now, tz: "Asia/Kathmandu" });
    expect(r.to.getTime() - r.from.getTime()).toBe(86_400_000);
    expect(r.from.toISOString()).toBe("2026-03-14T18:15:00.000Z"); // 00:00 NPT (UTC+5:45)
  });
  it("falls back safely on bad custom ranges", () => {
    expect(resolveRange("custom", "nope", "2026-01-01", { now }).preset).toBe("last30");
  });
});
