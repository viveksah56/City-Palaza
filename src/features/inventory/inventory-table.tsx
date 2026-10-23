import Link from "next/link";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StockBadge } from "@/components/shared/badges";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { StockActions } from "./inventory-adjustment-form";
import { TRACKING_LABELS } from "@/lib/constants";
import type { listInventory } from "@/server/inventory.service";

type Row = Awaited<ReturnType<typeof listInventory>>["rows"][number];

export function InventoryTable({ rows, currency, canAdd, canAdjust, url, sort, empty }: {
  rows: Row[]; currency: string; canAdd: boolean; canAdjust: boolean;
  url: { basePath: string; params: Record<string, string | undefined> };
  sort: { key?: string; order?: "asc" | "desc" };
  empty?: React.ReactNode;
}) {
  const columns: Column<Row>[] = [
    { key: "name", header: "Product", sortKey: "name", cell: (p) => (<div className="min-w-44"><Link href={`/products/${p.slug}`} className="font-medium hover:text-primary hover:underline">{p.name}</Link><p className="text-xs text-muted-foreground">{p.variantLabel ? `${p.variantLabel} · ` : ""}{p.category} · {TRACKING_LABELS[p.trackingType]}</p></div>) },
    { key: "sku", header: "SKU", sortKey: "sku", cell: (p) => <span className="font-mono text-[13px]">{p.sku}</span> },
    { key: "qty", header: "On hand", sortKey: "quantity", align: "right", cell: (p) => <span className="num font-medium">{p.quantity}</span> },
    { key: "cost", header: "Stock value (cost)", align: "right", cell: (p) => <CurrencyDisplay value={Number(p.purchasePrice) * p.quantity} currency={currency} className="text-muted-foreground" /> },
    { key: "status", header: "Status", cell: (p) => <StockBadge status={p.stockStatus} /> },
    { key: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: (p) => <StockActions product={{ id: p.id, name: p.name, sku: p.sku, trackingType: p.trackingType, quantity: p.quantity }} canAdd={canAdd} canAdjust={canAdjust} /> },
  ];
  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} url={url} sort={sort} empty={empty} />;
}
