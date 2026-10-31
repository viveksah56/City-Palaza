import { formatCurrency } from "@/lib/format";
import type { SaleCalculation } from "@/lib/sales-calc";

/** Live PREVIEW of totals (same pure function as the server). The server result is final. */
export function CheckoutSummary({ calc, currency }: { calc: SaleCalculation | null; currency: string }) {
  const f = (x: { toString(): string } | undefined) => formatCurrency(x ?? 0, currency);
  const row = (label: string, value: string) => <div className="flex justify-between text-sm text-muted-foreground"><dt>{label}</dt><dd className="num">{value}</dd></div>;
  return (
    <dl className="grid gap-1" aria-live="polite">
      {row("Subtotal", f(calc?.subtotal))}
      {calc && !calc.discount.isZero() && row("Discount", `-${f(calc.discount)}`)}
      <div className="mt-1 flex items-baseline justify-between border-t border-border pt-2">
        <dt className="text-base font-semibold">Total</dt>
        <dd className="num text-3xl font-bold tracking-tight">{f(calc?.total)}</dd>
      </div>
    </dl>
  );
}
