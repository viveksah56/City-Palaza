"use client";
import * as React from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCart, type CartDevice, type CartItem } from "@/stores/cart-store";
import { formatCurrency } from "@/lib/format";
import { money } from "@/lib/money";
import type { CalcLine } from "@/lib/sales-calc";
import { IconButton } from "@/components/shared/icon-button";
import { api } from "@/lib/axios";

export function CartLines({ currency, isAdmin, calcLines }: { currency: string; isAdmin: boolean; calcLines: CalcLine[] }) {
  const { items, setQuantity, remove, setDiscount } = useCart();
  const calculated = React.useMemo(() => new Map(calcLines.map((line) => [line.productId, line])), [calcLines]);
  if (items.length === 0) return <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Cart is empty. Scan an IMEI or barcode, or tap a product.</p>;
  return (
    <ul aria-label="Products in this sale" className="grid gap-2">
      {items.map((i) => {
        const line = calculated.get(i.productId);
        const fallbackTotal = money(i.unitPrice).times(i.quantity).times(100 - (i.discount?.type === "PERCENT" ? Number(i.discount.value) : 0)).div(100);
        return (
          <li key={i.productId} className="grid gap-2.5 rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug">{i.name}</p>
                <p className="num text-xs text-muted-foreground">{formatCurrency(i.unitPrice, currency)} each</p>
              </div>
              <IconButton label={`Remove ${i.name}`} variant="ghost" className="-mt-1 -mr-1 size-8" onClick={() => remove(i.productId)}><Trash2 className="text-destructive" /></IconButton>
            </div>

            {i.trackingType === "QUANTITY" ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <IconButton label="Decrease quantity" variant="secondary" className="size-9" onClick={() => setQuantity(i.productId, i.quantity - 1)} disabled={i.quantity <= 1}><Minus /></IconButton>
                  <Input aria-label={`Quantity for ${i.name}`} type="number" min={1} max={i.available} value={i.quantity} onChange={(e) => setQuantity(i.productId, Number(e.target.value))} className="h-9 w-14 rounded-lg px-1 text-center" />
                  <IconButton label="Increase quantity" variant="secondary" className="size-9" onClick={() => setQuantity(i.productId, i.quantity + 1)} disabled={i.quantity >= i.available}><Plus /></IconButton>
                </div>
                <p className="num text-base font-bold">{formatCurrency(line?.total ?? fallbackTotal, currency)}</p>
              </div>
            ) : (
              <DevicePicker item={i} />
            )}

            <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-xs text-muted-foreground">
              <label htmlFor={`discount-${i.productId}`} className="flex items-center gap-2">
                Item discount
                <span className="relative w-20">
                  <Input id={`discount-${i.productId}`} aria-label={`Item discount percentage for ${i.name}`} type="number" min="0" max={!isAdmin ? i.maxDiscountPercent : 100} step="0.01" inputMode="decimal" value={i.discount?.value ?? ""} onChange={(event) => setDiscount(i.productId, event.target.value === "" ? undefined : { type: "PERCENT", value: event.target.value })} placeholder="0" className="h-8 pr-6 text-sm" />
                  <span aria-hidden className="pointer-events-none absolute inset-y-0 right-2 flex items-center">%</span>
                </span>
                {!isAdmin && <span>max {i.maxDiscountPercent}%</span>}
              </label>
              {i.trackingType !== "QUANTITY" && <p className="num text-base font-bold text-foreground">{formatCurrency(line?.total ?? fallbackTotal, currency)}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type DeviceOption = { id: string; serial: string; imei2: string | null };

function DevicePicker({ item }: { item: CartItem }) {
  const setSerials = useCart((s) => s.setSerials);
  const [list, setList] = React.useState<DeviceOption[] | null>(null);
  const [error, setError] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    api.get<{ serials: DeviceOption[] }>(`/products/${item.slug}/serials`)
      .then(({ data }) => { if (live) setList(data.serials); })
      .catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, [item.slug]);

  const selected: CartDevice[] = item.serials.map((serial) => ({ serial, imei2: item.imei2[serial] ?? null }));
  const toggle = (d: DeviceOption) =>
    setSerials(item.productId, item.serials.includes(d.serial) ? selected.filter((x) => x.serial !== d.serial) : [...selected, { serial: d.serial, imei2: d.imei2 }]);

  return (
    <div className="grid gap-1.5">
      {selected.length > 0 && (
        <ul className="grid gap-1" aria-label="Selected devices">
          {selected.map((d) => (
            <li key={d.serial} className="rounded-md bg-primary/10 px-2 py-1 font-mono text-[12px] leading-tight text-foreground">
              <span className="text-muted-foreground">IMEI 1</span> {d.serial}{d.imei2 && <><br /><span className="text-muted-foreground">IMEI 2</span> {d.imei2}</>}
            </li>
          ))}
        </ul>
      )}
      <details className="group" open={selected.length === 0}>
        <summary className="cursor-pointer text-xs font-medium text-primary">{selected.length === 0 ? "Choose device" : "Change devices"} ({list?.length ?? "…"} in stock)</summary>
        {error ? <p role="alert" className="mt-1 text-xs text-destructive">Could not load devices. Remove and add this product again.</p> : list === null ? <p className="mt-1 text-xs text-muted-foreground">Loading devices…</p> : list.length === 0 ? <p className="mt-1 text-xs text-destructive">No devices in stock.</p> : (
          <div className="mt-1 grid max-h-32 gap-0.5 overflow-y-auto">
            {list.map((d) => (
              <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 font-mono text-[12px] hover:bg-secondary">
                <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={item.serials.includes(d.serial)} onChange={() => toggle(d)} />
                {d.serial}{d.imei2 ? ` / ${d.imei2}` : ""}
              </label>
            ))}
          </div>
        )}
      </details>
    </div>
  );
}
