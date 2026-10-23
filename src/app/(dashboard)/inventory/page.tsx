import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSION, hasPermission } from "@/lib/rbac/permission";
import { first, toParams, type SearchParams } from "@/lib/url";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { EmptyState } from "@/components/shared/states";
import { Pagination } from "@/components/shared/data-table";
import { ReportCard } from "@/components/shared/report-card";
import { InventoryTable } from "@/features/inventory/inventory-table";
import { getCategories } from "@/server/products.service";
import { getInventorySummary } from "@/server/reports.service";
import { listInventory, parseInventoryQuery } from "@/server/inventory.service";
import { getSettings } from "@/server/settings.service";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePermission(PERMISSION.INVENTORY_VIEW);
  const sp = await searchParams;
  const q = parseInventoryQuery(sp);
  const categoriesPromise = getCategories();
  const resultPromise = categoriesPromise.then((categories) => {
    const categorySlug = first(sp.category);
    const categoryId = categories.find((category) => category.slug === categorySlug)?.id;
    return listInventory({ ...q, categoryId });
  });
  const [categories, settings, summary, result] = await Promise.all([
    categoriesPromise,
    getSettings(),
    getInventorySummary(),
    resultPromise,
  ]);
  const params = toParams(sp);
  const canAdd = hasPermission(user.role, PERMISSION.INVENTORY_ADD);
  const canRemove = hasPermission(user.role, PERMISSION.INVENTORY_ADJUST);

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Record stock received and stock removed. Product details are managed in Products."
        actions={<Button asChild variant="outline"><Link href="/inventory/history"><History /> Stock history</Link></Button>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <ReportCard label="Products" value={summary.products} hint="In the catalogue" />
        <ReportCard label="Units on hand" value={summary.units} hint="Current stock" accent="green" />
        <ReportCard label="Low stock" value={summary.lowStock} hint="At or below minimum" tone={summary.lowStock ? "warning" : "default"} />
        <ReportCard label="Out of stock" value={summary.outOfStock} hint="Needs replenishment" tone={summary.outOfStock ? "danger" : "default"} />
      </div>
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-4">
          <SearchInput placeholder="Search name, SKU or barcode" />
          <FilterSelect param="category" label="Category" options={categories.map((category) => ({ value: category.slug, label: category.name }))} />
          <FilterSelect param="stock" label="Stock" options={[{ value: "in", label: "In stock" }, { value: "low", label: "Low stock" }, { value: "out", label: "Out of stock" }]} />
        </div>
        <InventoryTable
          rows={result.rows}
          currency={settings.currency}
          canAdd={canAdd}
          canAdjust={canRemove}
          url={{ basePath: "/inventory", params }}
          sort={{ key: q.sort, order: q.order }}
          empty={<EmptyState title="No products match" description="Try another search or clear the filters." />}
        />
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} url={{ basePath: "/inventory", params }} />
      </Card>
    </>
  );
}
