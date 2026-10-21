"use client";
import * as React from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCart, type CartItem } from "@/stores/cart-store";
import { formatCurrency } from "@/lib/format";
import { money } from "@/lib/money";
import { IconButton } from "@/components/shared/icon-button";

export function SaleCart({ currency }: { currency: string }) {
  const { items, setQuantity, remove } = useCart();
  if (items.length === 0) return <p className="rounded-2xl bg-secondary/60 p-8 text-center text-sm text-muted-foreground">The cart is empty. Search for a product and tap it to add it.</p>;
  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-secondary/40">
      {items.map((i) => (
        <li key={i.productId} className="grid gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{i.name}</p>
              <p className="text-xs text-muted-foreground num">{formatCurrency(i.unitPrice, currency)} each{Number(i.discountPercent) > 0 ? ` · ${i.discountPercent}% off` : ""}</p>
            </div>
            <IconButton label={`Remove ${i.name}`} variant="ghost" onClick={() => remove(i.productId)}><Trash2 className="text-destructive" /></IconButton>
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
  React.useEffect(() => {
    let live = true;
    fetch(`/api/products/${item.productId}/serials`).then((r) => r.json()).then((d) => live && setList(d.serials ?? []));
    return () => { live = false; };
  }, [item.productId]);
  const toggle = (s: string) => setSerials(item.productId, item.serials.includes(s) ? item.serials.filter((x) => x !== s) : [...item.serials, s]);
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1 text-xs font-medium text-muted-foreground">Choose the {item.trackingType === "IMEI" ? "IMEI" : "serial"} being sold</legend>
      {list === null ? <p className="text-xs text-muted-foreground">Loading devices…</p> : list.length === 0 ? <p className="text-xs text-destructive">No devices in stock.</p> : (
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
