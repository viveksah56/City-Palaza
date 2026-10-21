import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import {PERMISSION, hasPermission} from "@/lib/rbac/permission";
import { toParams, type SearchParams } from "@/lib/url";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { EmptyState } from "@/components/shared/states";
import { Pagination } from "@/components/shared/data-table";
import { ReportCard } from "@/components/shared/report-card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { InventoryTable } from "@/features/inventory/inventory-table";
import { listInventory, parseInventoryQuery } from "@/server/inventory.service";
import { getCategories } from "@/server/products.service";
import { getInventorySummary } from "@/server/reports.service";
import { getSettings } from "@/server/settings.service";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePermission(PERMISSION.INVENTORY_VIEW);
  const sp = await searchParams;
  const categories = await getCategories();
  const q = parseInventoryQuery({ ...sp, category: undefined });
  const catSlug = toParams(sp).category;
  q.categoryId = categories.find((c) => c.slug === catSlug)?.id;
  const [result, summary, settings] = await Promise.all([listInventory(q), getInventorySummary(), getSettings()]);
  const params = toParams(sp);
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Current stock. Every change is recorded with a reason."
        actions={hasPermission(user.role, PERMISSION.INVENTORY_HISTORY_VIEW) ? <Button asChild variant="outline"><Link href="/inventory/history"><History /> Stock history</Link></Button> : undefined}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <ReportCard label="Units in stock" value={summary.units} />
        <ReportCard label="Stock value at cost" value={<CurrencyDisplay value={summary.costValue} currency={settings.currency} />} />
        <ReportCard label="Low stock" value={summary.lowStock} tone={summary.lowStock ? "warning" : "default"} />
        <ReportCard label="Out of stock" value={summary.outOfStock} tone={summary.outOfStock ? "danger" : "default"} />
      </div>
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-4">
          <SearchInput placeholder="Search name, SKU or barcode" />
          <FilterSelect param="category" label="Category" options={categories.map((c) => ({ value: c.slug, label: c.name }))} />
          <FilterSelect param="stock" label="Stock" options={[{ value: "in", label: "In stock" }, { value: "low", label: "Low stock" }, { value: "out", label: "Out of stock" }]} />
        </div>
        <InventoryTable
          rows={result.rows}
          currency={settings.currency}
          canAdd={hasPermission(user.role, PERMISSION.INVENTORY_ADD)}
          canAdjust={hasPermission(user.role, PERMISSION.INVENTORY_ADJUST)}
          url={{ basePath: "/inventory", params }}
          sort={{ key: q.sort, order: q.order }}
          empty={<EmptyState title="No products match" description="Adjust the filters, or add products first." action={<Button asChild variant="outline"><Link href="/inventory">Clear filters</Link></Button>} />}
        />
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} url={{ basePath: "/inventory", params }} />
      </Card>
    </>
  );
}
