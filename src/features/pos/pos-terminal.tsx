"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/stores/cart-store";
import { calculateSale, type SaleCalculation } from "@/lib/sales-calc";
import { money } from "@/lib/money";
import { formatCurrency } from "@/lib/format";
import { createSaleAction } from "@/server/actions";
import type { ProductRow } from "@/server/products.service";
import type { CartDevice } from "@/stores/cart-store";
import { toCartProduct } from "./cart-helpers";
import { CartLines } from "./cart-panel";
import { CheckoutSummary } from "./checkout-summary";
import { CustomerLookup, type NewCustomerDraft } from "./customer-lookup";
import { DiscountManager, type SaleDiscount } from "./discount-manager";
import { PaymentDialog, type PaymentSelection } from "./payment-dialog";
import type { CustomerSearchResult } from "./pos-queries";
import { ProductPanel, type PosCategory } from "./product-panel";

export type PosTerminalProps = {
  currency: string;
  categories: PosCategory[];
  discountLimit: number;
  totalDiscountLimit: number | null;
  isAdmin: boolean;
};

export function PosTerminal({ currency, categories, discountLimit, totalDiscountLimit, isAdmin }: PosTerminalProps) {
  const router = useRouter();
  const cart = useCart();
  const [customer, setCustomer] = React.useState<CustomerSearchResult | null>(null);
  const [newCustomer, setNewCustomer] = React.useState<NewCustomerDraft | null>(null);
  const [discount, setDiscount] = React.useState<SaleDiscount>(null);
  const [notes, setNotes] = React.useState("");
  const [paying, setPaying] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const idempotencyKey = React.useRef<string | null>(null);

  React.useEffect(() => () => cart.clear(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const addProduct = React.useCallback((product: ProductRow, device?: CartDevice) => cart.add(toCartProduct(product), device), [cart]);

  const { calc, calcError } = React.useMemo<{ calc: SaleCalculation | null; calcError: string | null }>(() => {
    const lines = cart.items.filter((i) => i.quantity > 0).map((i) => ({ productId: i.productId, unitPrice: i.unitPrice, unitCost: 0, quantity: i.quantity, discount: i.discount ? { ...i.discount, value: Number(i.discount.value) } : null }));
    if (!lines.length) return { calc: null, calcError: null };
    try { return { calc: calculateSale({ lines, discount }), calcError: null }; }
    catch (e) { return { calc: null, calcError: e instanceof Error ? e.message : "Could not calculate totals." }; }
  }, [cart.items, discount]);

  const warnings: string[] = [];
  if (!isAdmin && calc) {
    if (calc.manualDiscount.gt(money(calc.netAfterPromo.times(discountLimit).div(100)))) warnings.push(`Manual discounts are above your ${discountLimit}% limit. Ask an admin to apply it.`);
    const overProduct = calc.lines.some((line) => {
      const item = cart.items.find((entry) => entry.productId === line.productId);
      return !!item && line.itemManualDiscount.gt(money(line.subtotal.times(item.maxDiscountPercent).div(100)));
    });
    if (overProduct) warnings.push("A product discount is above its admin-set limit.");
    if (totalDiscountLimit !== null && calc.discount.gt(money(calc.subtotal.times(totalDiscountLimit).div(100)))) warnings.push(`Discounts exceed your ${totalDiscountLimit}% total limit.`);
  }
  if (calcError) warnings.push(calcError);

  const ready = !!calc && cart.items.every((i) => i.quantity > 0) && warnings.length === 0;
  const unitCount = cart.items.reduce((n, i) => n + i.quantity, 0);

  async function complete(selection: PaymentSelection) {
    setSubmitting(true);
    idempotencyKey.current ??= crypto.randomUUID();
    try {
      const res = await createSaleAction({
        items: cart.items.filter((i) => i.quantity > 0).map((i) => ({ productId: i.productId, quantity: i.quantity, serials: i.trackingType === "QUANTITY" ? undefined : i.serials, discount: i.discount ? { type: i.discount.type, value: Number(i.discount.value) } : undefined })),
        customerId: customer?.id ?? null,
        newCustomer: !customer && newCustomer ? { name: newCustomer.name, phone: newCustomer.phone, address: newCustomer.address } : null,
        discount,
        paymentMethod: selection.method,
        amountTendered: selection.amountTendered,
        notes: notes.trim() || null,
        idempotencyKey: idempotencyKey.current,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`Sale ${res.data.saleNumber} completed`);
      idempotencyKey.current = null;
      cart.clear();
      setPaying(false);
      router.push(`/sales/${res.data.slug}?new=1`);
    } catch {
      toast.error("The sale could not be completed. Try again; the request is safe to retry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-0 gap-4 lg:h-[calc(100dvh-10.5rem)] lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_28rem]">
      <ProductPanel currency={currency} categories={categories} onAdd={addProduct} />

      <aside id="cart" aria-label="Current sale" className="flex min-h-0 scroll-mt-20 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-base font-semibold"><ShoppingCart className="size-4" aria-hidden /> Current sale <span className="text-sm font-normal text-muted-foreground">({unitCount} item{unitCount === 1 ? "" : "s"})</span></h2>
          <Button type="button" variant="ghost" size="sm" disabled={cart.items.length === 0} onClick={() => { cart.clear(); setDiscount(null); }}><Trash2 /> Clear</Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <CartLines currency={currency} isAdmin={isAdmin} calcLines={calc?.lines ?? []} />
        </div>

        <div className="grid gap-3 border-t border-border bg-secondary/30 p-4">
          <CustomerLookup customer={customer} newCustomer={newCustomer} onSelect={setCustomer} onCreate={setNewCustomer} />
          <DiscountManager currency={currency} isAdmin={isAdmin} limitPercent={discountLimit} warnings={warnings} onChange={setDiscount} />
          <Textarea aria-label="Note" rows={1} placeholder="Note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-9 resize-none py-2 text-sm" />
          <CheckoutSummary calc={calc} currency={currency} />
          <Button type="button" size="lg" disabled={!ready} onClick={() => setPaying(true)} className="h-14 text-lg font-semibold">
            Charge {calc ? formatCurrency(calc.total, currency) : ""}
          </Button>
        </div>
      </aside>

      {calc && (
        <PaymentDialog open={paying} onOpenChange={setPaying} total={calc.total.toFixed(2)} currency={currency} submitting={submitting} onConfirm={(selection) => void complete(selection)} />
      )}

      {cart.items.length > 0 && (
        <a href="#cart" className="glass fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between rounded-full border border-border/60 px-5 py-3 text-sm font-medium shadow-pop transition-transform active:scale-[0.98] lg:hidden">
          <span>{unitCount} item{unitCount === 1 ? "" : "s"} in sale</span>
          <span className="num text-primary">{calc ? formatCurrency(calc.total, currency) : "Review"} →</span>
        </a>
      )}
    </div>
  );
}
