import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import {PERMISSION, hasPermission} from "@/lib/rbac/permission";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, StockBadge } from "@/components/shared/badges";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { ProductAdminActions } from "@/features/products/product-admin-actions";
import { ProductModal } from "@/features/products/product-modal";
import { SkuCode } from "@/components/shared/sku-code";
import { getBrands, getCategories, getProductBySlug } from "@/server/products.service";
import { listSerialsByProductSlug } from "@/server/inventory.service";
import { getSettings } from "@/server/settings.service";
import { TRACKING_LABELS } from "@/lib/constants";
import { Pencil } from "lucide-react";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requirePermission(PERMISSION.PRODUCT_VIEW);
  const { slug } = await params;
  const canEdit = hasPermission(user.role, PERMISSION.PRODUCT_UPDATE);
  const canSeeCost = hasPermission(user.role, PERMISSION.INVENTORY_VIEW);
  const product = await getProductBySlug(slug, canSeeCost);
  if (!product) notFound();
  const settings = await getSettings();

  if (!canEdit) {
    return (
      <>
        <PageHeader title={product.variantLabel ? `${product.name} · ${product.variantLabel}` : product.name} description={<div className="flex flex-wrap items-center gap-2"><SkuCode value={product.sku} /><span>{product.category}{product.brand ? ` · ${product.brand}` : ""}</span></div>} actions={<Button asChild><Link href="/sales/new">Start a sale</Link></Button>} />
        <Card className="max-w-xl">
          <CardContent className="grid gap-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Selling price</span><CurrencyDisplay value={product.sellingPrice} currency={settings.currency} className="font-semibold" /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Availability</span><span className="flex items-center gap-2 num">{product.quantity} <StockBadge status={product.stockStatus} /></span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tracking</span><span>{TRACKING_LABELS[product.trackingType]}</span></div>
            {product.description && <p className="border-t pt-3 text-muted-foreground">{product.description}</p>}
          </CardContent>
        </Card>
      </>
    );
  }

  const [categories, brands, serials] = await Promise.all([getCategories(), getBrands(), product.trackingType === "QUANTITY" ? [] : listSerialsByProductSlug(slug)]);
  return (
    <>
      <PageHeader
        title={product.variantLabel ? `${product.name} · ${product.variantLabel}` : product.name}
        description={<div className="flex flex-wrap items-center gap-2"><SkuCode value={product.sku} /><span>{product.quantity} in stock</span></div>}
        actions={
          <>
            <StatusBadge status={product.status} />
            <StockBadge status={product.stockStatus} />
            <ProductModal
              categories={categories}
              brands={brands}
              product={{
                id: product.id,
                defaults: {
                  sku: product.sku,
                  barcode: product.barcode ?? "",
                  name: product.name,
                  variantLabel: product.variantLabel ?? "",
                  description: product.description ?? "",
                  categoryId: product.categoryId,
                  brandId: product.brandId ?? "",
                  purchasePrice: Number(product.purchasePrice ?? 0),
                  sellingPrice: Number(product.sellingPrice),
                  maxDiscountPercent: Number(product.maxDiscountPercent),
                  trackingType: product.trackingType,
                },
              }}
              trigger={<Button variant="outline"><Pencil /> Edit product</Button>}
            />
            <ProductAdminActions id={product.id} canDelete={hasPermission(user.role, PERMISSION.PRODUCT_DELETE)} />
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card className="h-fit">
          <CardHeader><CardTitle>Product details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
            <div><p className="text-muted-foreground">Category</p><p className="mt-1 font-medium">{product.category}</p></div>
            <div><p className="text-muted-foreground">Brand</p><p className="mt-1 font-medium">{product.brand ?? "No brand"}</p></div>
            <div><p className="text-muted-foreground">Selling price</p><CurrencyDisplay value={product.sellingPrice} currency={settings.currency} className="mt-1 font-medium" /></div>
            <div><p className="text-muted-foreground">Purchase price</p><CurrencyDisplay value={product.purchasePrice ?? 0} currency={settings.currency} className="mt-1 font-medium" /></div>
            <div><p className="text-muted-foreground">Stock on hand</p><p className="num mt-1 font-medium">{product.quantity}</p></div>
            <div><p className="text-muted-foreground">Tracking</p><p className="mt-1 font-medium">{TRACKING_LABELS[product.trackingType]}</p></div>
            {product.description && <p className="border-t pt-4 text-muted-foreground sm:col-span-2">{product.description}</p>}
          </CardContent>
        </Card>
        {product.trackingType !== "QUANTITY" && (
          <Card className="h-fit">
            <CardHeader><CardTitle>Registered devices</CardTitle></CardHeader>
            <CardContent>
              {serials.length === 0 ? <p className="text-sm text-muted-foreground">No devices registered yet. Add them from Inventory → Add stock.</p> : (
                <ul className="max-h-96 divide-y overflow-y-auto text-sm">
                  {serials.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2 py-2"><span className="font-mono text-[13px]">{s.serial}</span><StatusBadge status={s.status} /></li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
