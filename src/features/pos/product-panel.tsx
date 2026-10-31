"use client";
import * as React from "react";
import { Search, ShieldCheck, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { StockBadge } from "@/components/shared/badges";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CartDevice } from "@/stores/cart-store";
import type { ProductRow } from "@/server/products.service";
import { displayName } from "./cart-helpers";
import { useProductSearch } from "./pos-queries";
import { ScannerInput } from "./scanner-input";

export type PosCategory = { id: string; name: string };

export function ProductPanel({ currency, categories, onAdd }: { currency: string; categories: PosCategory[]; onAdd: (product: ProductRow, device?: CartDevice) => void }) {
  const [term, setTerm] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 180);
    return () => clearTimeout(timer);
  }, [term]);
  const search = useProductSearch(debounced, categoryId);
  const results = search.data ?? [];

  return (
    <section aria-label="Find products" className="flex min-h-0 min-w-0 flex-col gap-3">
      <ScannerInput onAdd={onAdd} onNotFound={setTerm} />
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground" />
        <Input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search brand, model, SKU or IMEI" aria-label="Search products" className="h-11 rounded-lg pl-10 text-sm shadow-none" />
      </div>
      <div role="group" aria-label="Category filter" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {[{ id: null, name: "All" }, ...categories].map((category) => {
          const selected = categoryId === category.id;
          return (
            <button
              key={category.id ?? "all"}
              type="button"
              aria-pressed={selected}
              onClick={() => setCategoryId(category.id)}
              className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground")}
            >{category.name}</button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy={search.isFetching}>
          {results.map((p) => {
            const out = p.quantity <= 0;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={out}
                  onClick={() => onAdd(p)}
                  className="flex h-full w-full flex-col justify-between gap-3 rounded-xl border border-border bg-card p-3.5 text-left transition-[border-color,background-color,transform] duration-100 hover:border-primary/50 hover:bg-accent/40 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {p.trackingType === "IMEI" && <Smartphone aria-label="IMEI tracked" className="size-3.5" />}
                      <span className="truncate">{[p.brand, p.category].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="mt-0.5 block text-sm font-semibold leading-snug">{displayName(p)}</span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">{p.sku}</span>
                  </span>
                  <span className="flex items-end justify-between gap-2">
                    <span className="grid">
                      <span className="num text-base font-bold">{formatCurrency(p.sellingPrice, currency)}</span>
                      {p.warrantyMonths > 0 && <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><ShieldCheck className="size-3" aria-hidden />{p.warrantyMonths} mo warranty</span>}
                    </span>
                    <span className="flex flex-col items-end gap-1"><StockBadge status={p.stockStatus} /><span className="num text-xs text-muted-foreground">{p.quantity} left</span></span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {!search.isFetching && results.length === 0 && (
          <p role={search.isError ? "alert" : undefined} className={cn("py-12 text-center text-sm", search.isError ? "text-destructive" : "text-muted-foreground")}>
            {search.isError ? "Products could not be loaded. Try your search again." : term || categoryId ? "No active product matches that search." : "No active products are available for sale."}
          </p>
        )}
      </div>
    </section>
  );
}
