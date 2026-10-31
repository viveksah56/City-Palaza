import { formatCurrency, formatDateTime, fullName } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { deviceLines, legacyAdjustment, warrantyLines } from "@/lib/receipt-helpers";
import type { Settings } from "@/server/settings.service";
import type { ReceiptSale } from "./receipt";

/** 80 mm roll receipt. Fixed 80mm width, black on white regardless of theme, so it prints identically everywhere. */
export function ThermalReceipt({ sale, settings }: { sale: ReceiptSale; settings: Settings }) {
  const money = (value: { toString(): string }) => formatCurrency(value, settings.currency);
  const adjustment = legacyAdjustment(sale);
  const hasWarranty = sale.items.some((item) => warrantyLines(item.warranties).length > 0);
  const Row = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
    <div className={`flex justify-between gap-2 ${strong ? "text-sm font-bold" : ""}`}><span>{label}</span><span className="tabular-nums">{value}</span></div>
  );
  return (
    <article aria-label={`Receipt ${sale.saleNumber}`} className="receipt-document receipt-thermal mx-auto w-[80mm] bg-white px-[4mm] py-[4mm] font-mono text-[11px] leading-snug text-black shadow-xl print:w-[80mm] print:shadow-none">
      <header className="text-center">
        <h2 className="text-sm font-bold uppercase">{settings.shopName}</h2>
        {[settings.address, settings.city].filter(Boolean).length > 0 && <p>{[settings.address, settings.city].filter(Boolean).join(", ")}</p>}
        {settings.phone && <p>Tel: {settings.phone}</p>}
      </header>
      <hr className="my-2 border-t border-dashed border-black" />
      <p className="text-center font-bold">INVOICE</p>
      {sale.status === "VOIDED" && <p className="text-center text-sm font-bold">*** VOIDED ***</p>}
      <Row label="No." value={sale.saleNumber} strong />
      <Row label="Date" value={formatDateTime(sale.createdAt)} />
      <Row label="Cashier" value={fullName(sale.employee)} />
      <Row label="Customer" value={sale.customer?.name ?? "Walk-in"} />
      {sale.customer?.phone && <Row label="Phone" value={sale.customer.phone} />}
      <hr className="my-2 border-t border-dashed border-black" />
      <ul className="grid gap-2">
        {sale.items.map((item) => (
          <li key={item.id} className="break-inside-avoid">
            <p className="font-bold">{item.productName}</p>
            <Row label={`${item.quantity} × ${money(item.unitPrice)}`} value={money(item.subtotal)} />
            {Number(item.discount) > 0 && <Row label="  Discount" value={`-${money(item.discount)}`} />}
            {deviceLines(item).map((line) => <p key={line} className="break-all text-[9.5px]">{line}</p>)}
            {warrantyLines(item.warranties).map((line) => <p key={line} className="text-[9.5px]">{line}</p>)}
          </li>
        ))}
      </ul>
      <hr className="my-2 border-t border-dashed border-black" />
      <Row label="Subtotal" value={money(sale.subtotal)} />
      {Number(sale.discount) > 0 && <Row label="Discount" value={`-${money(sale.discount)}`} />}
      {!adjustment.isZero() && <Row label="Adjustment (legacy)" value={money(adjustment)} />}
      <Row label="TOTAL" value={money(sale.total)} strong />
      <Row label={PAYMENT_METHOD_LABELS[sale.paymentMethod]} value={money(sale.amountPaid)} />
      {sale.amountTendered && <Row label="Cash received" value={money(sale.amountTendered)} />}
      {sale.changeGiven && Number(sale.changeGiven) > 0 && <Row label="Change" value={money(sale.changeGiven)} />}
      {sale.amountPaid.lt(sale.total) && <Row label="Balance due" value={money(sale.total.minus(sale.amountPaid))} strong />}
      {hasWarranty && settings.warrantyTerms && (
        <>
          <hr className="my-2 border-t border-dashed border-black" />
          <p className="font-bold">WARRANTY TERMS</p>
          <p className="text-[9.5px]">{settings.warrantyTerms}</p>
        </>
      )}
      {settings.receiptFooter && <><hr className="my-2 border-t border-dashed border-black" /><p className="text-center">{settings.receiptFooter}</p></>}
    </article>
  );
}
