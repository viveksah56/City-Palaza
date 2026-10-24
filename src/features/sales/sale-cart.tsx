"use client";
import * as React from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCart, type CartItem } from "@/stores/cart-store";
import { formatCurrency } from "@/lib/format";
import { money } from "@/lib/money";
import type { CalcLine } from "@/lib/sales-calc";
import { IconButton } from "@/components/shared/icon-button";
import { api } from "@/lib/axios";

export function SaleCart({ currency, isAdmin, calcLines }: { currency: string; isAdmin: boolean; calcLines: CalcLine[] }) {
  const { items, setQuantity, remove, setDiscount } = useCart();
  const calculated = React.useMemo(() => new Map(calcLines.map((line) => [line.productId, line])), [calcLines]);
  if (items.length === 0) return <p className="rounded-2xl bg-secondary/60 p-8 text-center text-sm text-muted-foreground">The cart is empty. Search for a product and tap it to add it.</p>;
  return (
    <ul aria-label="Products added to this sale" className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-secondary/40">
      {items.map((i) => {
        const line = calculated.get(i.productId);
        const discountPercent = i.discount?.type === "PERCENT" ? Math.min(100, Math.max(0, Number(i.discount.value))) : 0;
        const afterItemDiscountUnit = money(i.unitPrice).times(100 - discountPercent).div(100);
        const afterAllDiscountsUnit = line ? money(line.subtotal.minus(line.discount)).div(i.quantity) : afterItemDiscountUnit;
        return (
          <li key={i.productId} className="grid gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{i.name}</p>
                <p className="text-xs text-muted-foreground num">Unit price: {formatCurrency(i.unitPrice, currency)} each</p>
                {!isAdmin && <p className="text-xs text-muted-foreground">Item discount limit: {i.maxDiscountPercent}%</p>}
              </div>
              <IconButton label={`Remove ${i.name}`} variant="ghost" onClick={() => remove(i.productId)}><Trash2 className="text-destructive" /></IconButton>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
              <label htmlFor={`discount-${i.productId}`} className="text-xs text-muted-foreground">Item discount (%)</label>
              <span className="text-right text-xs text-muted-foreground">After all discounts / unit, before VAT</span>
              <div className="relative w-24">
                <Input id={`discount-${i.productId}`} aria-label={`Item discount percentage for ${i.name}`} type="number" min="0" max={!isAdmin ? i.maxDiscountPercent : 100} step="0.01" inputMode="decimal" value={i.discount?.value ?? ""} onChange={(event) => setDiscount(i.productId, event.target.value === "" ? undefined : { type: "PERCENT", value: event.target.value })} placeholder="0" className="h-9 pr-7 text-sm" />
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">%</span>
              </div>
              <span className="num text-right text-xs font-medium">{formatCurrency(afterAllDiscountsUnit, currency)}</span>
            </div>
            {line && (
              <dl className="grid gap-1 border-t border-border/60 pt-2 text-xs">
                <div className="flex justify-between gap-3 text-muted-foreground"><dt>Item discount</dt><dd className="num">−{formatCurrency(line.itemManualDiscount, currency)}</dd></div>
                <div className="flex justify-between gap-3 text-muted-foreground"><dt>Sale discount share</dt><dd className="num">−{formatCurrency(line.saleDiscount, currency)}</dd></div>
                <div className="flex justify-between gap-3 text-muted-foreground"><dt>Taxable after discounts</dt><dd className="num">{formatCurrency(line.subtotal.minus(line.discount), currency)}</dd></div>
                <div className="flex justify-between gap-3 text-muted-foreground"><dt>VAT</dt><dd className="num">{formatCurrency(line.tax, currency)}</dd></div>
              </dl>
            )}
            {i.trackingType === "QUANTITY" ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <IconButton label="Decrease quantity" variant="secondary" className="size-9" onClick={() => setQuantity(i.productId, i.quantity - 1)} disabled={i.quantity <= 1}><Minus /></IconButton>
                  <Input aria-label={`Quantity for ${i.name}`} type="number" min={1} max={i.available} value={i.quantity} onChange={(e) => setQuantity(i.productId, Number(e.target.value))} className="h-9 w-16 rounded-lg bg-card px-1 text-center" />
                  <IconButton label="Increase quantity" variant="secondary" className="size-9" onClick={() => setQuantity(i.productId, i.quantity + 1)} disabled={i.quantity >= i.available}><Plus /></IconButton>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">Line total incl. VAT</p>
                  <p className="num text-sm font-semibold">{formatCurrency(line?.total ?? money(afterAllDiscountsUnit).times(i.quantity), currency)}</p>
                </div>
              </div>
            ) : (
              <SerialPicker item={i} currency={currency} lineTotal={line?.total.toString()} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SerialPicker({ item, currency, lineTotal }: { item: CartItem; currency: string; lineTotal?: string }) {
  const setSerials = useCart((s) => s.setSerials);
  const [list, setList] = React.useState<{ id: string; serial: string }[] | null>(null);
  const [error, setError] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    api.get<{ serials: { id: string; serial: string }[] }>(`/products/${item.slug}/serials`)
      .then(({ data }) => { if (live) setList(data.serials); })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [item.slug]);
  const toggle = (s: string) => setSerials(item.productId, item.serials.includes(s) ? item.serials.filter((x) => x !== s) : [...item.serials, s]);
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1 text-xs font-medium text-muted-foreground">Choose the {item.trackingType === "IMEI" ? "IMEI" : "serial"} being sold</legend>
      {error ? <p role="alert" className="text-xs text-destructive">Could not load available devices. Try removing and adding this product again.</p> : list === null ? <p className="text-xs text-muted-foreground">Loading devices…</p> : list.length === 0 ? <p className="text-xs text-destructive">No devices in stock.</p> : (
        <div className="grid max-h-32 gap-1 overflow-y-auto">
          {list.map((d) => (
            <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 font-mono text-[13px] hover:bg-card">
              <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={item.serials.includes(d.serial)} onChange={() => toggle(d.serial)} />
              {d.serial}
            </label>
          ))}
        </div>
      )}
      <p className="num text-right text-sm font-semibold">Line total incl. VAT: {formatCurrency(lineTotal ?? money(item.unitPrice).times(item.serials.length).times(100 - (item.discount?.type === "PERCENT" ? Number(item.discount.value) : 0)).div(100), currency)}</p>
    </fieldset>
  );
}
