import { formatCurrency } from "@/lib/format";
import type { SaleCalculation } from "@/lib/sales-calc";

/** Live PREVIEW of totals (same pure function as the server). The server result is final. */
export function SaleSummary({ calc, currency, taxRate }: { calc: SaleCalculation | null; currency: string; taxRate: number }) {
  const row = (label: string, v: string, strong = false) => (
    <div className={`flex justify-between ${strong ? "border-t pt-2 text-base font-semibold" : "text-sm text-muted-foreground"}`}><dt>{label}</dt><dd className="num">{v}</dd></div>
  );
  const f = (x: { toString(): string } | undefined) => formatCurrency(x ?? 0, currency);
  return (
    <dl className="grid gap-1.5" aria-live="polite">
      {row("Subtotal", f(calc?.subtotal))}
      {row("Product discounts", `-${f(calc?.manualDiscount.minus(calc.saleDiscount))}`)}
      {row("Sale-wide discount", `-${f(calc?.saleDiscount)}`)}
      {row("Total discount", `-${f(calc?.discount)}`)}
      {row("Taxable amount", f(calc?.subtotal.minus(calc.discount)))}
      {row(`VAT (${taxRate}%)`, f(calc?.tax))}
      {row("Total", f(calc?.total), true)}
    </dl>
  );
}
