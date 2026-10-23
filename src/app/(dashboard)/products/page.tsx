import type { Metadata } from "next";
import Link from "next/link";
import { Tags } from "lucide-react";
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
import { ProductTable } from "@/features/products/product-table";
import { ProductImportDialog } from "@/features/products/product-import-dialog";
import { QueryProvider } from "@/components/providers/query-provider";
import { ProductModal } from "@/features/products/product-modal";
import { getBrands, getCategories, listProducts, parseProductQuery } from "@/server/products.service";
import { getSettings } from "@/server/settings.service";
import { getInventorySummary } from "@/server/reports.service";
import { ReportCard } from "@/components/shared/report-card";
import { first } from "@/lib/url";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePermission(PERMISSION.PRODUCT_VIEW);
  const sp = await searchParams;
  const canSeeCost = hasPermission(user.role, PERMISSION.INVENTORY_VIEW);
  const q = parseProductQuery(sp);
  const categoriesPromise = getCategories();
  const resultPromise = first(sp.category)
    ? categoriesPromise.then((categories) => listProducts(parseProductQuery(sp, new Map(categories.map((c) => [c.slug, c.id]))), canSeeCost))
    : listProducts(q, canSeeCost);
  const [categories, brands, settings, overview, result] = await Promise.all([
    categoriesPromise, getBrands(), getSettings(), getInventorySummary(), resultPromise,
  ]);
  const params = toParams(sp);

  return (
    <>
      <PageHeader
        title="Products"
        description={canSeeCost ? "Your catalogue, prices and live stock." : "Search products and check selling prices and stock."}
        actions={
          <>
            {hasPermission(user.role, PERMISSION.CATEGORY_VIEW) && <Button asChild variant="outline"><Link href="/products/categories"><Tags /> Categories &amp; brands</Link></Button>}
            {hasPermission(user.role, PERMISSION.PRODUCT_CREATE) && <QueryProvider><ProductImportDialog /></QueryProvider>}
            {hasPermission(user.role, PERMISSION.PRODUCT_CREATE) && <ProductModal categories={categories.filter((c) => c.isActive)} brands={brands.filter((b) => b.isActive)} />}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <ReportCard label="Active products" value={overview.products} hint="In the catalogue" />
        <ReportCard label="Units in stock" value={overview.units} hint="Across active products" accent="green" />
        <ReportCard label="Low stock" value={overview.lowStock} hint="At or below minimum" tone={overview.lowStock ? "warning" : "default"} />
        <ReportCard label="Out of stock" value={overview.outOfStock} hint="Needs replenishment" tone={overview.outOfStock ? "danger" : "default"} />
      </div>
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-4">
          <SearchInput placeholder="Search name, SKU, barcode or IMEI" />
          <FilterSelect param="category" label="Category" options={categories.map((c) => ({ value: c.slug, label: c.name }))} />
          <FilterSelect param="brand" label="Brand" options={brands.map((b) => ({ value: b.id, label: b.name }))} />
          <FilterSelect param="stock" label="Stock" options={[{ value: "in", label: "In stock" }, { value: "low", label: "Low stock" }, { value: "out", label: "Out of stock" }]} />
          {hasPermission(user.role, PERMISSION.PRODUCT_UPDATE) && <FilterSelect param="status" label="Status" options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }, { value: "DISCONTINUED", label: "Discontinued" }]} />}
        </div>
        <ProductTable
          rows={result.rows}
          canSeeCost={canSeeCost}
          currency={settings.currency}
          role={user.role}
          url={{ basePath: "/products", params }}
          sort={{ key: q.sort, order: q.order }}
          categories={categories}
          brands={brands}
          empty={<EmptyState title="No products match" description="Try a different search or clear the filters." action={<Button asChild variant="outline"><Link href="/products">Clear filters</Link></Button>} />}
        />
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} url={{ basePath: "/products", params }} />
      </Card>
    </>
  );
}
