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
  discount?: DiscountInput;
};

export type DiscountInput = { type: "PERCENT" | "FIXED"; value: MoneyInput } | null | undefined;

export type CalcLine = {
  productId: string;
  quantity: number;
  unitPrice: Decimal;
  unitCost: Decimal;
  subtotal: Decimal;
  promoDiscount: Decimal;
  itemManualDiscount: Decimal;
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
  manualDiscount: Decimal;
  discount: Decimal;
  tax: Decimal;
  total: Decimal;
  profit: Decimal;
  effectiveDiscountPercent: Decimal;
  netAfterPromo: Decimal;
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
    if (promoPct.isNegative() || promoPct.gt(100)) throw new DomainError("VALIDATION", "Promotion cannot exceed 100%.");
    const promoDiscount = money(subtotal.times(promoPct).div(100));
    const promoNet = subtotal.minus(promoDiscount);
    const itemManualDiscount = discountAmount(l.discount, promoNet);
    return { l, unitPrice, unitCost: money(l.unitCost), subtotal, promoDiscount, itemManualDiscount, net: promoNet.minus(itemManualDiscount) };
  });

  const netTotal = sum(base.map((b) => b.net));
  const saleDiscountTotal = discountAmount(input.discount, netTotal);
  const shares = allocateDiscount(base.map((b) => b.net), saleDiscountTotal);
  const lines: CalcLine[] = base.map((b, i) => {
    const share = shares[i] ?? ZERO;
    const manualDiscount = b.itemManualDiscount.plus(share);
    const discount = b.promoDiscount.plus(manualDiscount);
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
      itemManualDiscount: b.itemManualDiscount,
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
    saleDiscount: sum(lines.map((l) => l.saleDiscount)),
    manualDiscount: sum(lines.map((l) => l.saleDiscount.plus(l.itemManualDiscount))),
    discount: sum(lines.map((l) => l.discount)),
    tax: sum(lines.map((l) => l.tax)),
    total: sum(lines.map((l) => l.total)),
    profit: sum(lines.map((l) => l.profit)),
    effectiveDiscountPercent: sum(lines.map((l) => l.subtotal)).isZero() ? ZERO : sum(lines.map((l) => l.discount)).div(sum(lines.map((l) => l.subtotal))).times(100),
    netAfterPromo: sum(base.map((b) => b.subtotal.minus(b.promoDiscount))),
  };
}

function discountAmount(discount: DiscountInput, base: Decimal): Decimal {
  if (!discount) return ZERO;
  const value = D(discount.value);
  if (value.isNegative()) throw new DomainError("VALIDATION", "Discount cannot be negative.");
  if (discount.type === "PERCENT") {
    if (value.gt(100)) throw new DomainError("VALIDATION", "Discount cannot exceed 100%.");
    return money(base.times(value).div(100));
  }
  const amount = money(value);
  if (amount.gt(base)) throw new DomainError("VALIDATION", "Discount cannot be greater than the sale amount.");
  return amount;
}

function allocateDiscount(weights: Decimal[], amount: Decimal): Decimal[] {
  if (amount.isZero()) return weights.map(() => ZERO);
  const total = sum(weights);
  if (amount.gt(total)) throw new DomainError("VALIDATION", "Discount cannot be greater than the sale amount.");
  if (total.isZero()) return weights.map(() => ZERO);
  const cents = amount.times(100).toNumber();
  const allocations = weights.map((weight) => {
    if (weight.isZero()) return { amount: ZERO, remainder: ZERO, weight };
    const exactCents = amount.times(weight).div(total).times(100);
    const wholeCents = exactCents.floor();
    return { amount: new Decimal(wholeCents).div(100), remainder: exactCents.minus(wholeCents), weight };
  });
  let remaining = cents - allocations.reduce((sumCents, item) => sumCents + item.amount.times(100).toNumber(), 0);
  const order = allocations.map((item, index) => ({ ...item, index })).sort((a, b) =>
    b.remainder.comparedTo(a.remainder) || b.weight.comparedTo(a.weight) || a.index - b.index,
  );
  for (const item of order) {
    if (remaining <= 0) break;
    if (item.weight.gt(item.amount)) {
      allocations[item.index]!.amount = allocations[item.index]!.amount.plus("0.01");
      remaining -= 1;
    }
  }
  if (remaining !== 0) throw new DomainError("VALIDATION", "Discount allocation could not be completed.");
  return allocations.map((item) => item.amount);
}

/** Employees are capped by the configured limit; admins are unrestricted. */
export function assertDiscountAllowed(
  saleDiscount: MoneyInput,
  netTotal: MoneyInput,
  role: Role,
  employeeLimitPercent: MoneyInput,
  currency = "NPR",
) {
  if (role === ROLE.ADMIN) return;
  const limit = D(employeeLimitPercent);
  const applied = money(saleDiscount);
  const maximum = money(D(netTotal).times(limit).div(100));
  if (applied.gt(maximum)) {
    throw new DomainError(
      "DISCOUNT_NOT_ALLOWED",
      `Discount limit is ${limit.toFixed(2)}%. Maximum allowed: ${currency} ${maximum.toFixed(2)}.`,
    );
  }
}

/** profit = (historical unit selling price − historical unit purchase price) × quantity */
export function lineProfit(unitPrice: MoneyInput, unitCost: MoneyInput, quantity: number, discount: MoneyInput = 0): Decimal {
  return money(D(unitPrice).minus(D(unitCost)).times(quantity).minus(D(discount)));
}
