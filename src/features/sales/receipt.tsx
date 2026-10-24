import Image from "next/image";
import { formatCurrency, formatDateTime, fullName } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import type { Settings } from "@/server/settings.service";
import type { getSaleForUser } from "@/server/sales.service";

type Sale = NonNullable<Awaited<ReturnType<typeof getSaleForUser>>>;

export function Receipt({ sale, settings }: { sale: Sale; settings: Settings }) {
  const currency = settings.currency;
  const money = (value: { toString(): string }) => formatCurrency(value, currency);
  const discountSplitAvailable = sale.items.every((item) => item.itemDiscount !== null && item.saleDiscount !== null);
  const itemDiscountTotal = sale.items.reduce((total, item) => total.plus(item.itemDiscount ?? 0), sale.discount.minus(sale.discount));
  const saleWideDiscountTotal = sale.items.reduce((total, item) => total.plus(item.saleDiscount ?? 0), sale.discount.minus(sale.discount));

  return (
    <article aria-label={`Tax invoice ${sale.saleNumber}`} className="receipt-document mx-auto w-full max-w-5xl border border-border/70 bg-white p-5 text-slate-900 shadow-card sm:p-8 print:max-w-none print:border-0 print:p-0 print:shadow-none">
      <header className="grid gap-5 border-b-2 border-slate-800 pb-5 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="flex items-start gap-4">
          <Image src="/citypalaza-icon.png" alt="" width={56} height={56} className="size-14 rounded-lg object-cover" />
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight">{settings.shopName}</h2>
            <p className="mt-1 text-sm text-slate-600">{[settings.address, settings.city].filter(Boolean).join(", ")}</p>
            {settings.phone && <p className="text-sm text-slate-600">Phone: {settings.phone}</p>}
            {settings.email && <p className="text-sm text-slate-600">Email: {settings.email}</p>}
            <p className="mt-1 text-sm font-semibold">PAN No.: {settings.panNumber}</p>
          </div>
        </div>
        <div className="sm:text-right">
          <h1 className="text-2xl font-bold uppercase tracking-wide text-slate-800">Tax Invoice</h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-500">Customer copy</p>
          <p className="mt-3 font-mono text-base font-semibold">{sale.saleNumber}</p>
          <p className="text-sm text-slate-600">{formatDateTime(sale.createdAt)}</p>
        </div>
      </header>

      <section aria-label="Invoice parties" className="grid gap-5 border-b border-slate-200 py-5 sm:grid-cols-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bill to</h3>
          <p className="mt-1 font-semibold">{sale.customer?.name ?? "Walk-in customer"}</p>
          {sale.customer?.phone && <p className="text-sm text-slate-600">{sale.customer.phone}</p>}
          {sale.customer?.email && <p className="text-sm text-slate-600">{sale.customer.email}</p>}
          {sale.customer?.address && <p className="text-sm text-slate-600">{sale.customer.address}</p>}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm sm:justify-self-end">
          <dt className="text-slate-500">Payment method</dt><dd className="text-right font-medium">{PAYMENT_METHOD_LABELS[sale.paymentMethod]}</dd>
          <dt className="text-slate-500">Payment status</dt><dd className="text-right font-medium">{sale.paymentStatus === "PAID" ? "Paid" : sale.paymentStatus}</dd>
          <dt className="text-slate-500">Served by</dt><dd className="text-right">{fullName(sale.employee)}</dd>
          {sale.status === "VOIDED" && <><dt className="font-semibold text-red-700">Status</dt><dd className="text-right font-bold text-red-700">VOIDED</dd></>}
        </dl>
      </section>

      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[42rem] border-collapse text-sm print:min-w-0">
          <thead>
            <tr className="border-b border-slate-400 text-left text-xs uppercase tracking-wide text-slate-600">
              <th className="py-3 pr-2">Item description</th>
              <th className="px-2 py-3 text-right">Qty</th>
              <th className="px-2 py-3 text-right">Unit price (excl. VAT)</th>
              <th className="px-2 py-3 text-right">Discount</th>
              <th className="px-2 py-3 text-right">Taxable</th>
              <th className="px-2 py-3 text-right">VAT</th>
              <th className="py-3 pl-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id} className="break-inside-avoid border-b border-slate-200 align-top">
                <td className="py-3 pr-2">
                  <p className="font-semibold">{item.productName}</p>
                  {item.sku && <p className="mt-0.5 text-xs text-slate-500">SKU: {item.sku}</p>}
                  {item.serialSnapshot.length > 0 && <p className="break-all font-mono text-xs text-slate-500">IMEI / serial: {item.serialSnapshot.join(", ")}</p>}
                  {discountSplitAvailable ? (
                    <p className="mt-1 text-xs text-slate-600">Item discount {money(item.itemDiscount ?? 0)} · Sale discount share {money(item.saleDiscount ?? 0)}</p>
                  ) : Number(item.discount) > 0 ? (
                    <p className="mt-1 text-xs text-slate-600">Discount: {money(item.discount)} (combined on legacy sale)</p>
                  ) : null}
                </td>
                <td className="px-2 py-3 text-right tabular-nums">{item.quantity}</td>
                <td className="px-2 py-3 text-right tabular-nums">{money(item.unitPrice)}</td>
                <td className="px-2 py-3 text-right tabular-nums">{money(item.discount)}</td>
                <td className="px-2 py-3 text-right tabular-nums">{money(item.subtotal.minus(item.discount))}</td>
                <td className="px-2 py-3 text-right tabular-nums">{money(item.tax)}</td>
                <td className="py-3 pl-2 text-right font-semibold tabular-nums">{money(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section aria-label="Invoice totals" className="ml-auto mt-5 grid w-full max-w-sm gap-2 text-sm">
        <div className="flex justify-between gap-4"><span className="text-slate-600">Subtotal</span><span className="tabular-nums">{money(sale.subtotal)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-slate-600">Discount</span><span className="tabular-nums">-{money(sale.discount)}</span></div>
        {discountSplitAvailable && <>
          <div className="flex justify-between gap-4 text-xs text-slate-500"><span>Product discounts</span><span className="tabular-nums">{money(itemDiscountTotal)}</span></div>
          <div className="flex justify-between gap-4 text-xs text-slate-500"><span>Sale-wide discount</span><span className="tabular-nums">{money(saleWideDiscountTotal)}</span></div>
        </>}
        <div className="flex justify-between gap-4 border-t border-slate-200 pt-2"><span className="text-slate-600">Taxable amount</span><span className="tabular-nums">{money(sale.subtotal.minus(sale.discount))}</span></div>
        <div className="flex justify-between gap-4"><span className="text-slate-600">VAT ({sale.taxRate.toString()}%)</span><span className="tabular-nums">{money(sale.tax)}</span></div>
        <div className="flex justify-between gap-4 border-t-2 border-slate-800 pt-2 text-lg font-bold"><span>Total</span><span className="tabular-nums">{money(sale.total)}</span></div>
        <div className="flex justify-between gap-4"><span className="text-slate-600">Amount paid</span><span className="tabular-nums">{money(sale.amountPaid)}</span></div>
        {sale.amountPaid.lt(sale.total) && <div className="flex justify-between gap-4 font-semibold"><span>Balance due</span><span className="tabular-nums">{money(sale.total.minus(sale.amountPaid))}</span></div>}
      </section>

      {sale.payments.length > 0 && <section className="mt-6 break-inside-avoid border-t border-slate-200 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Payment record</h3>
        <ul className="mt-2 grid gap-1 text-xs text-slate-600">{sale.payments.map((payment) => <li key={payment.id} className="flex justify-between gap-3"><span>{formatDateTime(payment.receivedAt)} · {PAYMENT_METHOD_LABELS[payment.method]}</span><span className="tabular-nums">{money(payment.amount)}</span></li>)}</ul>
      </section>}

      <footer className="mt-10 grid break-inside-avoid gap-6 border-t border-slate-200 pt-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <p className="text-xs text-slate-500">Thank you for shopping at {settings.shopName}.</p>
        <div className="min-w-52 text-center">
          <p className="font-serif text-2xl italic text-slate-800">{fullName(sale.employee)}</p>
          <div className="mt-1 border-t border-slate-500 pt-1 text-xs text-slate-600">System-generated sign-off · {fullName(sale.employee)}</div>
        </div>
      </footer>
    </article>
  );
}
