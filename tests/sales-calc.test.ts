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

  it("accepts a manual percentage discount when a 100% promotion makes the cart zero", () => {
    const c = calculateSale({
      lines: [line({ unitPrice: "307.00", quantity: 2, promoPercent: 100 })],
      discount: { type: "PERCENT", value: 2 },
    });
    expect(c.total.toFixed(2)).toBe("0.00");
    expect(c.manualDiscount.toFixed(2)).toBe("0.00");
    expect(c.lines[0]!.total.toFixed(2)).toBe("0.00");
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

  it("allocates cents by largest remainder and never gives a line more than its net", () => {
    const c = calculateSale({
      lines: [line({ productId: "zero", unitPrice: "0.01", unitCost: 0, promoPercent: 100 }), line({ productId: "a", unitPrice: "0.03", unitCost: 0 }), line({ productId: "b", unitPrice: "0.02", unitCost: 0 })],
      discount: { type: "FIXED", value: "0.02" },
    });
    expect(c.lines[0]!.saleDiscount.toFixed(2)).toBe("0.00");
    expect(c.lines.reduce((total, item) => total.plus(item.saleDiscount), c.lines[0]!.saleDiscount.minus(c.lines[0]!.saleDiscount)).toFixed(2)).toBe("0.02");
    for (const item of c.lines) {
      expect(item.saleDiscount.gte(0)).toBe(true);
      expect(item.discount.lte(item.subtotal)).toBe(true);
      expect(item.tax.gte(0)).toBe(true);
      expect(item.total.gte(0)).toBe(true);
    }
  });

  it("preserves line and cart manual discounts after promotions", () => {
    const c = calculateSale({
      lines: [line({ unitPrice: 100, unitCost: 50, quantity: 1, promoPercent: 10, discount: { type: "FIXED", value: 5 } })],
      discount: { type: "PERCENT", value: 10 },
    });
    expect(c.promoDiscount.toFixed(2)).toBe("10.00");
    expect(c.manualDiscount.toFixed(2)).toBe("13.50");
    expect(c.lines[0]!.discount.toFixed(2)).toBe("23.50");
    expect(c.effectiveDiscountPercent.toFixed(2)).toBe("23.50");
  });

  it("rejects invalid quantities", () => {
    expect(() => calculateSale({ lines: [line({ quantity: 0 })] })).toThrow(DomainError);
    expect(() => calculateSale({ lines: [line({ quantity: 1.5 })] })).toThrow(DomainError);
  });
});

describe("employee discount limit", () => {
  it("lets employees discount up to the limit only", () => {
    expect(() => assertDiscountAllowed("0.01", "0.20", "EMPLOYEE", 5)).not.toThrow();
    const largeCart = calculateSale({ lines: [line({ unitPrice: "100000.00", unitCost: 0, quantity: 1 })], discount: { type: "PERCENT", value: "5.01" } });
    expect(() => assertDiscountAllowed(largeCart.manualDiscount, largeCart.netAfterPromo, "EMPLOYEE", 5)).toThrow(/5\.00%.*NPR 5000\.00/);
    for (let cents = 1; cents <= 20_000; cents += 1) {
      const price = (cents / 100).toFixed(2);
      const sale = calculateSale({ lines: [line({ unitPrice: price, unitCost: 0, quantity: 1 })], discount: { type: "PERCENT", value: 5 } });
      expect(() => assertDiscountAllowed(sale.manualDiscount, sale.netAfterPromo, "EMPLOYEE", 5)).not.toThrow();
    }
  });
  it("is unrestricted for admins", () => {
    expect(() => assertDiscountAllowed(60, 100, "ADMIN", 5)).not.toThrow();
  });
  it("measures the manual discount percentage from the calculation", () => {
    const c = calculateSale({ lines: [line()], discount: { type: "FIXED", value: 100 } }); // 100 / 2000
    expect(c.manualDiscountPercent.toFixed(2)).toBe("5.00");
  });

  it("preserves discount invariants across 5,000 deterministic randomized carts", () => {
    let seed = 942_381;
    const random = (max: number) => {
      seed = (seed * 16_807) % 2_147_483_647;
      return seed % max;
    };
    for (let run = 0; run < 5_000; run += 1) {
      const lines = Array.from({ length: 1 + random(8) }, (_, index) => {
        const cents = 1 + random(200_000);
        const promo = [0, 100, random(10_001) / 100][random(3)]!;
        return line({ productId: `${run}-${index}`, unitPrice: (cents / 100).toFixed(2), unitCost: (random(cents + 1) / 100).toFixed(2), quantity: 1 + random(10), promoPercent: promo, discount: random(2) ? { type: "PERCENT", value: random(10_001) / 100 } : undefined });
      });
      const base = calculateSale({ lines });
      const cartCents = base.netAfterPromo.minus(base.manualDiscount).times(100).toNumber();
      const discount = random(2) ? { type: "PERCENT" as const, value: random(10_001) / 100 } : { type: "FIXED" as const, value: (Math.floor(cartCents * random(101) / 100) / 100).toFixed(2) };
      const result = calculateSale({ lines, discount, taxRatePercent: random(2) ? 0 : 13 });
      const allocated = result.lines.reduce((sum, item) => sum.plus(item.saleDiscount), result.lines[0]!.saleDiscount.minus(result.lines[0]!.saleDiscount));
      expect(allocated.toFixed(2)).toBe(result.saleDiscount.toFixed(2));
      const lineTotal = result.lines.reduce((sum, item) => sum.plus(item.total), result.lines[0]!.total.minus(result.lines[0]!.total));
      expect(result.total.toFixed(2)).toBe(lineTotal.toFixed(2));
      for (const item of result.lines) {
        expect(item.discount.gte(0)).toBe(true);
        expect(item.discount.lte(item.subtotal)).toBe(true);
        expect(item.tax.gte(0)).toBe(true);
        expect(item.total.gte(0)).toBe(true);
        if (item.subtotal.minus(item.promoDiscount).minus(item.itemManualDiscount).isZero()) expect(item.saleDiscount.isZero()).toBe(true);
      }
    }
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
