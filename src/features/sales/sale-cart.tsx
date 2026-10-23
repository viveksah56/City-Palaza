"use client";
import * as React from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCart, type CartItem } from "@/stores/cart-store";
import { formatCurrency } from "@/lib/format";
import { money } from "@/lib/money";
import { IconButton } from "@/components/shared/icon-button";
import { api } from "@/lib/axios";

export function SaleCart({ currency, isAdmin }: { currency: string; isAdmin: boolean }) {
  const { items, setQuantity, remove, setDiscount } = useCart();
  if (items.length === 0) return <p className="rounded-2xl bg-secondary/60 p-8 text-center text-sm text-muted-foreground">The cart is empty. Search for a product and tap it to add it.</p>;
  return (
    <ul aria-label="Products added to this sale" className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-secondary/40">
      {items.map((i) => {
        const discountPercent = i.discount?.type === "PERCENT" ? Math.min(100, Math.max(0, Number(i.discount.value))) : 0;
        const afterDiscountUnit = money(i.unitPrice).times(100 - discountPercent).div(100);
        const afterDiscountTotal = afterDiscountUnit.times(i.quantity);
        const lineDiscount = money(i.unitPrice).times(i.quantity).minus(afterDiscountTotal);
        return (
        <li key={i.productId} className="grid gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{i.name}</p>
              <p className="text-xs text-muted-foreground num">Unit price {formatCurrency(i.unitPrice, currency)}</p>
              {!isAdmin && <p className="text-xs text-muted-foreground">Maximum employee discount: {i.maxDiscountPercent}%</p>}
            </div>
            <IconButton label={`Remove ${i.name}`} variant="ghost" onClick={() => remove(i.productId)}><Trash2 className="text-destructive" /></IconButton>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-x-3 gap-y-1">
            <label htmlFor={`discount-${i.productId}`} className="text-xs text-muted-foreground">Discount</label>
            <span className="text-xs text-muted-foreground">After discount</span>
            <div className="relative w-24">
              <Input id={`discount-${i.productId}`} aria-label={`Manual discount percentage for ${i.name}`} type="number" min="0" max={!isAdmin ? i.maxDiscountPercent : 100} step="0.01" inputMode="decimal" value={i.discount?.value ?? ""} onChange={(event) => setDiscount(i.productId, event.target.value === "" ? undefined : { type: "PERCENT", value: event.target.value })} placeholder="0" className="h-9 pr-7 text-sm" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">%</span>
            </div>
            <span className="num text-right text-xs font-medium">{formatCurrency(afterDiscountUnit, currency)} ea</span>
          </div>
          {i.trackingType === "QUANTITY" ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <IconButton label="Decrease quantity" variant="secondary" className="size-9" onClick={() => setQuantity(i.productId, i.quantity - 1)} disabled={i.quantity <= 1}><Minus /></IconButton>
                <Input aria-label={`Quantity for ${i.name}`} type="number" min={1} max={i.available} value={i.quantity} onChange={(e) => setQuantity(i.productId, Number(e.target.value))} className="h-9 w-16 rounded-full bg-card px-1 text-center" />
                <IconButton label="Increase quantity" variant="secondary" className="size-9" onClick={() => setQuantity(i.productId, i.quantity + 1)} disabled={i.quantity >= i.available}><Plus /></IconButton>
              </div>
              <div className="text-right">
                {lineDiscount.gt(0) && <p className="num text-xs text-muted-foreground line-through">{formatCurrency(money(i.unitPrice).times(i.quantity), currency)}</p>}
                <p className="num text-sm font-medium">{formatCurrency(afterDiscountTotal, currency)}</p>
                {lineDiscount.gt(0) && <p className="num text-[11px] text-muted-foreground">−{formatCurrency(lineDiscount, currency)} discount</p>}
              </div>
            </div>
          ) : (
            <SerialPicker item={i} currency={currency} />
          )}
        </li>
        );
      })}
    </ul>
  );
}

function SerialPicker({ item, currency }: { item: CartItem; currency: string }) {
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
      <p className="num text-right text-sm font-medium">{item.serials.length} × = {formatCurrency(money(item.unitPrice).times(item.serials.length).times(100 - (item.discount?.type === "PERCENT" ? Number(item.discount.value) : 0)).div(100), currency)}</p>
    </fieldset>
  );
}
