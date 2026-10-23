"use client";
import * as React from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useCart, type CartItem } from "@/stores/cart-store";
import { formatCurrency } from "@/lib/format";
import { money } from "@/lib/money";
import { IconButton } from "@/components/shared/icon-button";
import { api } from "@/lib/axios";

export function SaleCart({ currency }: { currency: string }) {
  const { items, setQuantity, remove, setDiscount } = useCart();
  if (items.length === 0) return <p className="rounded-2xl bg-secondary/60 p-8 text-center text-sm text-muted-foreground">The cart is empty. Search for a product and tap it to add it.</p>;
  return (
    <ul aria-label="Products added to this sale" className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-secondary/40">
      {items.map((i) => (
        <li key={i.productId} className="grid gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{i.name}</p>
              <p className="text-xs text-muted-foreground num">{formatCurrency(i.unitPrice, currency)} each{Number(i.discountPercent) > 0 ? ` · ${i.discountPercent}% off` : ""}</p>
            </div>
            <IconButton label={`Remove ${i.name}`} variant="ghost" onClick={() => remove(i.productId)}><Trash2 className="text-destructive" /></IconButton>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
            <Input aria-label={`Manual discount for ${i.name}`} type="number" min="0" step="0.01" inputMode="decimal" value={i.discount?.value ?? ""} onChange={(event) => setDiscount(i.productId, event.target.value === "" ? undefined : { type: i.discount?.type ?? "PERCENT", value: event.target.value })} placeholder="Item discount" />
            <NativeSelect aria-label={`Discount type for ${i.name}`} value={i.discount?.type ?? "PERCENT"} onChange={(event) => setDiscount(i.productId, i.discount ? { ...i.discount, type: event.target.value as "PERCENT" | "FIXED" } : undefined)}><option value="PERCENT">%</option><option value="FIXED">{currency}</option></NativeSelect>
          </div>
          {i.trackingType === "QUANTITY" ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <IconButton label="Decrease quantity" variant="secondary" className="size-9" onClick={() => setQuantity(i.productId, i.quantity - 1)} disabled={i.quantity <= 1}><Minus /></IconButton>
                <Input aria-label={`Quantity for ${i.name}`} type="number" min={1} max={i.available} value={i.quantity} onChange={(e) => setQuantity(i.productId, Number(e.target.value))} className="h-9 w-16 rounded-full bg-card px-1 text-center" />
                <IconButton label="Increase quantity" variant="secondary" className="size-9" onClick={() => setQuantity(i.productId, i.quantity + 1)} disabled={i.quantity >= i.available}><Plus /></IconButton>
              </div>
              <span className="num text-sm font-medium">{formatCurrency(money(i.unitPrice).times(i.quantity), currency)}</span>
            </div>
          ) : (
            <SerialPicker item={i} currency={currency} />
          )}
        </li>
      ))}
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
      <p className="num text-right text-sm font-medium">{item.serials.length} × = {formatCurrency(money(item.unitPrice).times(item.serials.length), currency)}</p>
    </fieldset>
  );
}
