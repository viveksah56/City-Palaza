import { describe, expect, it } from "vitest";
import { assertDiscountAllowed, calculateSale, lineProfit } from "@/lib/sales-calc";
import { formatCurrency } from "@/lib/format";
import { DomainError } from "@/lib/errors";

const line = (o: Partial<Parameters<typeof calculateSale>[0]["lines"][number]> = {}) => ({ productId: "p1", unitPrice: "1000.00", unitCost: "800.00", quantity: 2, ...o });

describe("sale totals", () => {
  it("computes subtotal, tax and total with exact decimals", () => {
    const c = calculateSale({ lines: [line({ unitPrice: "0.10", unitCost: "0.05", quantity: 3 })], taxRatePercent: 13 });
    expect(c.subtotal.toFixed(2)).toBe("0.30"); // never 0.30000000000000004
    expect(c.tax.toFixed(2)).toBe("0.04");
    expect(c.total.toFixed(2)).toBe("0.34");
  });

  it("applies tax to the discounted amount", () => {
    const c = calculateSale({ lines: [line()], discount: { type: "PERCENT", value: 10 }, taxRatePercent: 13 });
    expect(c.subtotal.toFixed(2)).toBe("2000.00");
    expect(c.discount.toFixed(2)).toBe("200.00");
    expect(c.tax.toFixed(2)).toBe("234.00");
    expect(c.total.toFixed(2)).toBe("2034.00");
  });

  it("applies a product's standing promo discount", () => {
    const c = calculateSale({ lines: [line({ promoPercent: 5 })], taxRatePercent: 0 });
    expect(c.promoDiscount.toFixed(2)).toBe("100.00");
    expect(c.total.toFixed(2)).toBe("1900.00");
  });

  it("supports fixed-amount discounts and rejects ones larger than the sale", () => {
    expect(calculateSale({ lines: [line()], discount: { type: "FIXED", value: 150 } }).total.toFixed(2)).toBe("1850.00");
    expect(() => calculateSale({ lines: [line()], discount: { type: "FIXED", value: 2500 } })).toThrow(DomainError);
    expect(() => calculateSale({ lines: [line()], discount: { type: "PERCENT", value: 101 } })).toThrow(DomainError);
    expect(() => calculateSale({ lines: [line()], discount: { type: "FIXED", value: -1 } })).toThrow(DomainError);
  });

  it("allocates sale discount across lines so allocations sum exactly", () => {
    const c = calculateSale({
      lines: [line({ productId: "a", unitPrice: "333.33", quantity: 1 }), line({ productId: "b", unitPrice: "333.33", quantity: 1 }), line({ productId: "c", unitPrice: "333.34", quantity: 1 })],
      discount: { type: "FIXED", value: "100.00" },
    });
    expect(c.lines.reduce((a, l) => a.plus(l.saleDiscount), c.lines[0]!.saleDiscount.minus(c.lines[0]!.saleDiscount)).toFixed(2)).toBe("100.00");
    expect(c.discount.toFixed(2)).toBe("100.00");
    expect(c.total.toFixed(2)).toBe("900.00");
  });

  it("rejects invalid quantities", () => {
    expect(() => calculateSale({ lines: [line({ quantity: 0 })] })).toThrow(DomainError);
    expect(() => calculateSale({ lines: [line({ quantity: 1.5 })] })).toThrow(DomainError);
  });
});

describe("employee discount limit", () => {
  it("lets employees discount up to the limit only", () => {
    expect(() => assertDiscountAllowed(5, "EMPLOYEE", 5)).not.toThrow();
    expect(() => assertDiscountAllowed("5.01", "EMPLOYEE", 5)).toThrow(/admin/);
  });
  it("is unrestricted for admins", () => {
    expect(() => assertDiscountAllowed(60, "ADMIN", 5)).not.toThrow();
  });
  it("measures the manual discount percentage from the calculation", () => {
    const c = calculateSale({ lines: [line()], discount: { type: "FIXED", value: 100 } }); // 100 / 2000
    expect(c.manualDiscountPercent.toFixed(2)).toBe("5.00");
  });
});

describe("profit", () => {
  it("equals (selling − purchase) × quantity with no discount", () => {
    expect(lineProfit("1000", "800", 3).toFixed(2)).toBe("600.00");
    const c = calculateSale({ lines: [line({ quantity: 3 })] });
    expect(c.profit.toFixed(2)).toBe("600.00");
  });
  it("uses the historical prices passed in, not current ones", () => {
    const before = calculateSale({ lines: [line({ unitPrice: "1000", unitCost: "800" })] });
    // the product's price later changes – a re-calculation of the OLD snapshot must not move
    expect(before.profit.toFixed(2)).toBe("400.00");
    expect(calculateSale({ lines: [line({ unitPrice: "1000", unitCost: "800" })] }).profit.toFixed(2)).toBe(before.profit.toFixed(2));
  });
  it("accounts for discounts given", () => {
    const c = calculateSale({ lines: [line()], discount: { type: "FIXED", value: 100 } });
    expect(c.profit.toFixed(2)).toBe("300.00");
  });
});

describe("NPR formatting", () => {
  it("uses Indian digit grouping and 2 decimals", () => {
    expect(formatCurrency("1234567.5")).toBe("Rs 12,34,567.50");
    expect(formatCurrency(0)).toBe("Rs 0.00");
    expect(formatCurrency("-999.999")).toBe("-Rs 1,000.00");
  });
});
