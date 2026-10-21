import { DomainError } from "./errors";
import { ROLE, type Role } from "@/lib/constants/roles";
import { D, money, sum, ZERO, Decimal, type MoneyInput } from "./money";

/**
 * Pure, server-authoritative sale maths (also reused client-side for a live PREVIEW only).
 *
 * Per line:  subtotal = unitPrice × qty
 *            promo    = subtotal × product.discountPercent / 100
 * Sale-level discount (percent or fixed) applies to Σ(subtotal − promo) and is allocated
 * proportionally to lines (last line absorbs rounding) so per-line profit stays exact.
 * Tax (exclusive) = (subtotal − line discount) × taxRate / 100.
 * Line total = subtotal − discount + tax.
 */
export type CalcLineInput = {
  productId: string;
  unitPrice: MoneyInput;
  unitCost: MoneyInput;
  quantity: number;
  promoPercent?: MoneyInput;
};

export type DiscountInput = { type: "PERCENT" | "FIXED"; value: MoneyInput } | null | undefined;

export type CalcLine = {
  productId: string;
  quantity: number;
  unitPrice: Decimal;
  unitCost: Decimal;
  subtotal: Decimal;
  promoDiscount: Decimal;
  saleDiscount: Decimal;
  discount: Decimal;
  tax: Decimal;
  total: Decimal;
  profit: Decimal;
};

export type SaleCalculation = {
  lines: CalcLine[];
  subtotal: Decimal;
  promoDiscount: Decimal;
  saleDiscount: Decimal;
  discount: Decimal;
  tax: Decimal;
  total: Decimal;
  profit: Decimal;
  /** Manual (cashier-applied) discount as % of the pre-discount net – what the employee limit checks. */
  manualDiscountPercent: Decimal;
};

export function calculateSale(
  input: { lines: CalcLineInput[]; discount?: DiscountInput; taxRatePercent?: MoneyInput },
): SaleCalculation {
  const taxRate = D(input.taxRatePercent ?? 0);
  if (taxRate.isNegative() || taxRate.gt(100)) throw new DomainError("VALIDATION", "Invalid tax rate.");

  const base = input.lines.map((l) => {
    if (!Number.isInteger(l.quantity) || l.quantity < 1) throw new DomainError("VALIDATION", "Quantity must be a whole number of at least 1.");
    const unitPrice = money(l.unitPrice);
    const subtotal = money(unitPrice.times(l.quantity));
    const promoPct = D(l.promoPercent ?? 0);
    const promoDiscount = money(subtotal.times(promoPct).div(100));
    return { l, unitPrice, unitCost: money(l.unitCost), subtotal, promoDiscount, net: subtotal.minus(promoDiscount) };
  });

  const netTotal = sum(base.map((b) => b.net));

  let saleDiscountTotal = ZERO;
  if (input.discount) {
    const v = D(input.discount.value);
    if (v.isNegative()) throw new DomainError("VALIDATION", "Discount cannot be negative.");
    if (input.discount.type === "PERCENT") {
      if (v.gt(100)) throw new DomainError("VALIDATION", "Discount cannot exceed 100%.");
      saleDiscountTotal = money(netTotal.times(v).div(100));
    } else {
      saleDiscountTotal = money(v);
    }
    if (saleDiscountTotal.gt(netTotal)) throw new DomainError("VALIDATION", "Discount cannot be greater than the sale amount.");
  }

  let allocated = ZERO;
  const lines: CalcLine[] = base.map((b, i) => {
    const isLast = i === base.length - 1;
    const share = netTotal.isZero()
      ? ZERO
      : isLast
        ? saleDiscountTotal.minus(allocated)
        : money(saleDiscountTotal.times(b.net).div(netTotal));
    allocated = allocated.plus(share);
    const discount = b.promoDiscount.plus(share);
    const taxable = b.subtotal.minus(discount);
    const tax = money(taxable.times(taxRate).div(100));
    const total = taxable.plus(tax);
    return {
      productId: b.l.productId,
      quantity: b.l.quantity,
      unitPrice: b.unitPrice,
      unitCost: b.unitCost,
      subtotal: b.subtotal,
      promoDiscount: b.promoDiscount,
      saleDiscount: share,
      discount,
      tax,
      total,
      // (historical selling price − historical purchase price) × qty, net of discounts given
      profit: taxable.minus(b.unitCost.times(b.l.quantity)),
    };
  });

  return {
    lines,
    subtotal: sum(lines.map((l) => l.subtotal)),
    promoDiscount: sum(lines.map((l) => l.promoDiscount)),
    saleDiscount: saleDiscountTotal,
    discount: sum(lines.map((l) => l.discount)),
    tax: sum(lines.map((l) => l.tax)),
    total: sum(lines.map((l) => l.total)),
    profit: sum(lines.map((l) => l.profit)),
    manualDiscountPercent: netTotal.isZero() ? ZERO : saleDiscountTotal.div(netTotal).times(100),
  };
}

/** Employees are capped by the configured limit; admins are unrestricted. */
export function assertDiscountAllowed(
  manualDiscountPercent: MoneyInput,
  role: Role,
  employeeLimitPercent: MoneyInput,
) {
  if (role === ROLE.ADMIN) return;
  const pct = D(manualDiscountPercent);
  const limit = D(employeeLimitPercent);
  if (pct.gt(limit)) {
    throw new DomainError(
      "DISCOUNT_NOT_ALLOWED",
      `Discounts above ${limit.toDecimalPlaces(2).toString()}% need an admin. You applied ${pct.toDecimalPlaces(2).toString()}%.`,
    );
  }
}

/** profit = (historical unit selling price − historical unit purchase price) × quantity */
export function lineProfit(unitPrice: MoneyInput, unitCost: MoneyInput, quantity: number, discount: MoneyInput = 0): Decimal {
  return money(D(unitPrice).minus(D(unitCost)).times(quantity).minus(D(discount)));
}
