import { formatCurrency, formatDateTime, fullName } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import type { Settings } from "@/server/settings.service";
import type { getSaleForUser } from "@/server/sales.service";

type Sale = NonNullable<Awaited<ReturnType<typeof getSaleForUser>>>;

export function Receipt({ sale, settings }: { sale: Sale; settings: Settings }) {
  const m = (v: { toString(): string }) => formatCurrency(v, settings.currency);
  return (
    <article aria-label={`Receipt ${sale.saleNumber}`} className="mx-auto w-full max-w-md rounded-xl border border-border bg-card p-6 text-sm text-card-foreground shadow-card sm:p-8 print:max-w-none print:border-0 print:shadow-none">
      <header className="text-center">
        <h2 className="font-heading text-xl font-semibold">{settings.shopName}</h2>
        <p className="text-xs text-muted-foreground">{[settings.address, settings.city].filter(Boolean).join(", ")}</p>
        <p className="text-xs text-muted-foreground">{[settings.phone, settings.email].filter(Boolean).join(" · ")}</p>
      </header>
      {sale.status === "VOIDED" && <p className="my-3 border-2 border-destructive py-1 text-center font-bold tracking-wide text-destructive">VOIDED</p>}
      <dl className="my-4 grid grid-cols-2 gap-x-3 gap-y-1 border-y py-3 text-[13px]">
        <dt className="text-muted-foreground">Sale</dt><dd className="text-right font-mono">{sale.saleNumber}</dd>
        <dt className="text-muted-foreground">Date</dt><dd className="text-right">{formatDateTime(sale.createdAt)}</dd>
        <dt className="text-muted-foreground">Served by</dt><dd className="text-right">{fullName(sale.employee)}</dd>
        <dt className="text-muted-foreground">Customer</dt><dd className="text-right">{sale.customer?.name ?? "Walk-in"}</dd>
      </dl>
      <ul className="divide-y">
        {sale.items.map((i) => (
          <li key={i.id} className="py-2">
            <div className="flex justify-between gap-2"><span className="font-medium">{i.productName}</span><span className="num">{m(i.total)}</span></div>
            <p className="num text-xs text-muted-foreground">{i.quantity} × {m(i.unitPrice)}{Number(i.discount) > 0 ? ` · discount ${m(i.discount)}` : ""} · <span className="font-mono">{i.sku}</span></p>
            {i.serialSnapshot.length > 0 && <p className="font-mono text-xs text-muted-foreground">{i.serialSnapshot.join(", ")}</p>}
          </li>
        ))}
      </ul>
      <dl className="mt-3 grid gap-1 border-t pt-3">
        <div className="flex justify-between text-muted-foreground"><dt>Subtotal</dt><dd className="num">{m(sale.subtotal)}</dd></div>
        <div className="flex justify-between text-muted-foreground"><dt>Discount</dt><dd className="num">-{m(sale.discount)}</dd></div>
        <div className="flex justify-between text-muted-foreground"><dt>Tax ({sale.taxRate.toString()}%)</dt><dd className="num">{m(sale.tax)}</dd></div>
        <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>Total</dt><dd className="num">{m(sale.total)}</dd></div>
        <div className="flex justify-between text-muted-foreground"><dt>Paid by</dt><dd>{PAYMENT_METHOD_LABELS[sale.paymentMethod]} · {sale.paymentStatus.toLowerCase()}</dd></div>
        {sale.paymentStatus === "PARTIAL" && <div className="flex justify-between text-muted-foreground"><dt>Paid so far</dt><dd className="num">{m(sale.amountPaid)}</dd></div>}
      </dl>
      <footer className="mt-5 text-center text-xs text-muted-foreground">Thank you for shopping at {settings.shopName}</footer>
    </article>
  );
}
