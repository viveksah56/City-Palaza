"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/shared/icon-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StockBadge } from "@/components/shared/badges";
import { useCart } from "@/stores/cart-store";
import { calculateSale, type SaleCalculation } from "@/lib/sales-calc";
import { money } from "@/lib/money";
import { formatCurrency } from "@/lib/format";
import { createSaleAction } from "@/server/actions";
import { useCustomerSearch, useProductSearch } from "./sales-queries";
import { SaleCart } from "./sale-cart";
import { SaleSummary } from "./sale-summary";
import { PaymentMethodSelector, type PaymentMethodValue } from "./payment-method-selector";

type Cust = { id: string; name: string; phone: string | null };

export function SalesTerminal({ currency, taxRate, discountLimit, totalDiscountLimit, isAdmin }: { currency: string; taxRate: number; discountLimit: number; totalDiscountLimit: number | null; isAdmin: boolean }) {
  const router = useRouter();
  const cart = useCart();
  const [term, setTerm] = React.useState("");
  const [debouncedTerm, setDebouncedTerm] = React.useState("");
  const [customer, setCustomer] = React.useState<Cust | null>(null);
  const [newCust, setNewCust] = React.useState<{ name: string; phone: string } | null>(null);
  const [custTerm, setCustTerm] = React.useState("");
  const [debouncedCustomerTerm, setDebouncedCustomerTerm] = React.useState("");
  const [discType, setDiscType] = React.useState<"PERCENT" | "FIXED">("PERCENT");
  const [discValue, setDiscValue] = React.useState("");
  const [method, setMethod] = React.useState<PaymentMethodValue>("CASH");
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const idempotencyKey = React.useRef<string | null>(null);
  const productSearch = useProductSearch(debouncedTerm);
  const customerSearch = useCustomerSearch(debouncedCustomerTerm);
  const results = productSearch.data ?? [];
  const searching = productSearch.isFetching;
  const custResults = customerSearch.data ?? [];

  React.useEffect(() => { searchRef.current?.focus(); return () => cart.clear(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(term.trim()), 200);
    return () => clearTimeout(timer);
  }, [term]);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedCustomerTerm(custTerm.trim()), 250);
    return () => clearTimeout(timer);
  }, [custTerm]);

  const discNum = discValue === "" ? 0 : Number(discValue);
  const { calc, calcError } = React.useMemo<{ calc: SaleCalculation | null; calcError: string | null }>(() => {
    const lines = cart.items.filter((i) => i.quantity > 0).map((i) => ({ productId: i.productId, unitPrice: i.unitPrice, unitCost: 0, quantity: i.quantity, discount: i.discount ? { ...i.discount, value: Number(i.discount.value) } : null }));
    if (!lines.length) return { calc: null, calcError: null };
    try { return { calc: calculateSale({ lines, discount: discNum > 0 ? { type: discType, value: discNum } : null, taxRatePercent: taxRate }), calcError: null }; }
    catch (e) { return { calc: null, calcError: (e as Error).message }; }
  }, [cart.items, discNum, discType, taxRate]);

  const overManualLimit = !isAdmin && !!calc && calc.manualDiscount.gt(money(calc.netAfterPromo.times(discountLimit).div(100)));
  const overProductLimit = !isAdmin && !!calc && calc.lines.some((line) => {
    const item = cart.items.find((entry) => entry.productId === line.productId);
    return !!item && line.itemManualDiscount.gt(money(line.subtotal.times(item.maxDiscountPercent).div(100)));
  });
  const overTotalLimit = !isAdmin && totalDiscountLimit !== null && !!calc && calc.discount.gt(money(calc.subtotal.times(totalDiscountLimit).div(100)));
  const overLimit = overManualLimit || overProductLimit || overTotalLimit;

  async function submit() {
    setSubmitting(true);
    idempotencyKey.current ??= crypto.randomUUID();
    try {
    const res = await createSaleAction({
      items: cart.items.filter((i) => i.quantity > 0).map((i) => ({ productId: i.productId, quantity: i.quantity, serials: i.trackingType === "QUANTITY" ? undefined : i.serials, discount: i.discount ? { type: i.discount.type, value: Number(i.discount.value) } : undefined })),
      customerId: customer?.id ?? null,
      newCustomer: !customer && newCust?.name ? { name: newCust.name, phone: newCust.phone || null } : null,
      discount: discNum > 0 ? { type: discType, value: discNum } : null,
      paymentMethod: method,
      notes: notes || null,
      idempotencyKey: idempotencyKey.current,
    });
    if (!res.ok) return void toast.error(res.error);
    toast.success(`Sale ${res.data.saleNumber} completed`);
    idempotencyKey.current = null;
    cart.clear();
    router.push(`/sales/${res.data.slug}?new=1`);
    } catch {
      toast.error("The sale could not be completed. Try again; the request is safe to retry.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !!calc && !submitting && !overLimit && cart.items.every((i) => i.quantity > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem] xl:grid-cols-[1fr_26rem]">
      <section aria-label="Find products" className="min-w-0">
        <div className="relative mb-3">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" />
          <Input ref={searchRef} type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search name, SKU, barcode or IMEI" aria-label="Search products" className="h-11 rounded-lg border-border pl-10 text-sm shadow-none" />
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 lg:max-xl:grid-cols-2" aria-busy={searching}>
          {results.map((p) => {
            const out = p.quantity <= 0;
            return (
              <li key={p.id}>
                <button
                  type="button" disabled={out}
                  onClick={() => cart.add({ productId: p.id, slug: p.slug, name: p.variantLabel ? `${p.name} · ${p.variantLabel}` : p.name, sku: p.sku, unitPrice: p.sellingPrice, maxDiscountPercent: p.maxDiscountPercent, trackingType: p.trackingType, available: p.quantity })}
                  className="flex w-full items-start justify-between gap-3 rounded-xl border border-border bg-card p-3.5 text-left transition-[border-color,background-color] duration-150 hover:border-primary/45 hover:bg-accent/35 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{p.name}{p.variantLabel ? ` · ${p.variantLabel}` : ""}</span><span className="block font-mono text-xs text-muted-foreground">{p.sku}</span><span className="mt-1 block num mt-0.5 text-[15px] font-semibold">{formatCurrency(p.sellingPrice, currency)}</span></span>
                  <span className="flex shrink-0 flex-col items-end gap-1"><StockBadge status={p.stockStatus} /><span className="num text-xs text-muted-foreground">{p.quantity} left</span></span>
                </button>
              </li>
            );
          })}
        </ul>
        {!searching && results.length === 0 && <p role={productSearch.isError ? "alert" : undefined} className={`py-10 text-center text-sm ${productSearch.isError ? "text-destructive" : "text-muted-foreground"}`}>{productSearch.isError ? "Products could not be loaded. Try your search again." : term ? "No active product matches that search." : "No active products are available for sale."}</p>}
        {!searching && results.length > 0 && !term && <p className="pt-2 text-center text-xs text-muted-foreground">Showing available products. Search by name, SKU, barcode or IMEI to narrow the list.</p>}
      </section>

      <aside id="cart" aria-label="Current sale" className="grid scroll-mt-20 content-start gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
        <Card className="gap-4">
          <CardHeader><CardTitle>Current sale <span className="text-sm font-normal text-muted-foreground">({cart.items.length} product{cart.items.length === 1 ? "" : "s"})</span></CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <SaleCart currency={currency} isAdmin={isAdmin} calcLines={calc?.lines ?? []} />

            <div className="grid gap-1.5">
              <p className="text-sm font-medium">Customer <span className="font-normal text-muted-foreground">(optional)</span></p>
              {customer ? (
                <div className="flex items-center justify-between rounded-md border bg-accent px-4 py-2.5 text-sm text-accent-foreground"><span>{customer.name}{customer.phone ? ` · ${customer.phone}` : ""}</span><IconButton label="Remove customer" variant="ghost" className="size-7" onClick={() => setCustomer(null)}><X /></IconButton></div>
              ) : newCust ? (
                <div className="grid gap-2 rounded-xl bg-secondary/50 p-3">
                  <Input aria-label="New customer name" placeholder="Name" value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} />
                  <Input aria-label="New customer phone" placeholder="Phone" value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
                  <Button size="sm" variant="ghost" onClick={() => setNewCust(null)}>Cancel new customer</Button>
                </div>
              ) : (
                <>
                  <Input aria-label="Find customer" placeholder="Find by name or phone — or leave as walk-in" value={custTerm} onChange={(e) => setCustTerm(e.target.value)} />
                  {custResults.length > 0 && <ul className="overflow-hidden rounded-xl border border-border/60 bg-card">{custResults.map((c) => <li key={c.id}><button type="button" className="w-full px-4 py-2.5 text-left text-sm transition-colors hover:bg-secondary" onClick={() => { setCustomer(c); setCustTerm(""); setDebouncedCustomerTerm(""); }}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</button></li>)}</ul>}
                  <Button size="sm" variant="outline" onClick={() => setNewCust({ name: custTerm, phone: "" })}><UserPlus /> New customer</Button>
                </>
              )}
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="disc" className="text-sm font-medium">Discount {!isAdmin && <span className="font-normal text-muted-foreground">(up to {discountLimit}%)</span>}</label>
              <div className="flex gap-2">
                <Input id="disc" type="number" min="0" step="0.01" inputMode="decimal" value={discValue} onChange={(e) => setDiscValue(e.target.value)} placeholder="0" aria-invalid={overLimit} />
                <div className="w-28"><NativeSelect aria-label="Discount type" value={discType} onChange={(e) => setDiscType(e.target.value as "PERCENT" | "FIXED")}><option value="PERCENT">%</option><option value="FIXED">{currency}</option></NativeSelect></div>
              </div>
              {overManualLimit && <p role="alert" className="text-xs font-medium text-destructive">Manual discounts are above your {discountLimit}% limit. Ask an admin to apply it.</p>}
              {overProductLimit && <p role="alert" className="text-xs font-medium text-destructive">A product discount is above its admin-set limit. Reduce the discount or ask an admin to update the product limit.</p>}
              {overTotalLimit && <p role="alert" className="text-xs font-medium text-destructive">Promotions and manual discounts exceed your {totalDiscountLimit}% total limit.</p>}
              {calcError && <p role="alert" className="text-xs font-medium text-destructive">{calcError}</p>}
            </div>

            <div className="grid gap-1.5"><p className="text-sm font-medium">Payment</p><PaymentMethodSelector value={method} onChange={setMethod} /></div>
            <Textarea aria-label="Notes" rows={2} placeholder="Note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

            <SaleSummary calc={calc} currency={currency} taxRate={taxRate} />
            <Button size="lg" disabled={!canSubmit} onClick={submit}>{submitting ? "Completing…" : `Complete sale${calc ? ` · ${formatCurrency(calc.total, currency)}` : ""}`}</Button>
            <p className="text-xs text-muted-foreground">Final prices, discounts, tax and stock are checked again by the server when you complete the sale.</p>
          </CardContent>
        </Card>
      </aside>

      {cart.items.length > 0 && (
        <a
          href="#cart"
          className="glass fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between rounded-full border border-border/60 px-5 py-3 text-sm font-medium shadow-pop transition-transform active:scale-[0.98] lg:hidden"
        >
          <span>{cart.items.reduce((n, i) => n + i.quantity, 0)} item{cart.items.reduce((n, i) => n + i.quantity, 0) === 1 ? "" : "s"} in sale</span>
          <span className="num flex items-center gap-1 text-primary">{calc ? formatCurrency(calc.total, currency) : "Review"} →</span>
        </a>
      )}
    </div>
  );
}
