import Link from "next/link";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge, StockBadge } from "@/components/shared/badges";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { TRACKING_LABELS } from "@/lib/constants";
import type { ProductRow } from "@/server/products.service";
import { SkuCode } from "@/components/shared/sku-code";
import { ProductAdminActions } from "./product-admin-actions";
import { IconButton } from "@/components/shared/icon-button";
import { Pencil } from "lucide-react";
import { PERMISSION, hasPermission } from "@/lib/rbac/permission";
import type { Role } from "@/lib/constants/roles";
import { ProductModal } from "./product-modal";
import type { ProductFormValues } from "@/validations/product";

type Option = { id: string; name: string };

export function ProductTable({
  rows, canSeeCost, currency, role, url, sort, empty, categories, brands,
}: {
  rows: ProductRow[];
  canSeeCost: boolean;
  currency: string;
  role: Role;
  url: { basePath: string; params: Record<string, string | undefined> };
  sort: { key?: string; order?: "asc" | "desc" };
  empty?: React.ReactNode;
  categories: Option[];
  brands: Option[];
}) {
  const columns: Column<ProductRow>[] = [
    {
      key: "name", header: "Product", sortKey: "name",
      cell: (p) => (
        <div className="min-w-48">
          <Link href={`/products/${p.slug}`} className="font-medium hover:text-primary hover:underline">{p.name}</Link>
          <p className="text-xs text-muted-foreground">{p.variantLabel ? `${p.variantLabel} · ` : ""}{p.category}{p.brand ? ` · ${p.brand}` : ""} · {TRACKING_LABELS[p.trackingType]}</p>
        </div>
      ),
    },
    { key: "sku", header: "SKU", sortKey: "sku", cell: (p) => <SkuCode value={p.sku} /> },
    ...(canSeeCost ? [{ key: "cost", header: "Cost", sortKey: "purchasePrice", align: "right" as const, cell: (p: ProductRow) => <CurrencyDisplay value={p.purchasePrice} currency={currency} className="text-muted-foreground" /> }] : []),
    { key: "price", header: "Price", sortKey: "sellingPrice", align: "right", cell: (p) => <CurrencyDisplay value={p.sellingPrice} currency={currency} className="font-medium" /> },
    { key: "qty", header: "Stock", sortKey: "quantity", align: "right", cell: (p) => <span className="num">{p.quantity}</span> },
    { key: "status", header: "Availability", cell: (p) => (p.status === "ACTIVE" ? <StockBadge status={p.stockStatus} /> : <StatusBadge status={p.status} />) },
    ...(hasPermission(role, PERMISSION.PRODUCT_UPDATE) || hasPermission(role, PERMISSION.PRODUCT_DELETE) ? [{
      key: "actions", header: <span className="sr-only">Actions</span>, align: "right" as const,
      cell: (p: ProductRow) => <div className="flex items-center justify-end gap-1.5">
        {hasPermission(role, PERMISSION.PRODUCT_UPDATE) && (
          <ProductModal
            categories={categories}
            brands={brands}
            product={{
              id: p.id,
              defaults: {
                sku: p.sku,
                barcode: p.barcode ?? "",
                name: p.name,
                variantLabel: p.variantLabel ?? "",
                description: p.description ?? "",
                categoryId: p.categoryId,
                brandId: p.brandId ?? "",
                purchasePrice: Number(p.purchasePrice ?? 0),
                sellingPrice: Number(p.sellingPrice),
                maxDiscountPercent: Number(p.maxDiscountPercent),
                trackingType: p.trackingType,
              } satisfies Partial<ProductFormValues>,
            }}
            trigger={<IconButton label={`Edit ${p.name}`} variant="outline"><Pencil /></IconButton>}
          />
        )}
        {hasPermission(role, PERMISSION.PRODUCT_DELETE) && <ProductAdminActions id={p.id} canDelete compact />}
      </div>,
    }] : []),
  ];
  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} url={url} sort={sort} empty={empty} />;
}
