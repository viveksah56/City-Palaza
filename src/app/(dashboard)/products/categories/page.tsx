import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guards";
import {PERMISSION, hasPermission} from "@/lib/rbac/permission";
import { PageHeader } from "@/components/shared/page-header";
import { TaxonomyManager } from "@/features/products/taxonomy-manager";
import { TAXONOMY_KIND } from "@/lib/constants/categories";
import { getBrands, getCategories } from "@/server/products.service";
import { ReportCard } from "@/components/shared/report-card";

export const metadata: Metadata = { title: "Categories & brands" };

export default async function CatalogPage() {
  const user = await requirePermission(PERMISSION.CATEGORY_VIEW);
  const [categories, brands] = await Promise.all([getCategories(), getBrands()]);
  return (
    <>
      <PageHeader title="Categories & brands" description="Group products so they’re easy to find at the counter and easy to report on." />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4">
        <ReportCard label="Active categories" value={categories.filter((item) => item.isActive).length} hint={`${categories.length} total categories`} />
        <ReportCard label="Active brands" value={brands.filter((item) => item.isActive).length} hint={`${brands.length} total brands`} accent="purple" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <TaxonomyManager kind={TAXONOMY_KIND.CATEGORY} items={categories} canCreate={hasPermission(user.role, PERMISSION.CATEGORY_CREATE)} canUpdate={hasPermission(user.role, PERMISSION.CATEGORY_UPDATE)} canDelete={hasPermission(user.role, PERMISSION.CATEGORY_DELETE)} />
        <TaxonomyManager kind={TAXONOMY_KIND.BRAND} items={brands} canCreate={hasPermission(user.role, PERMISSION.BRAND_CREATE)} canUpdate={hasPermission(user.role, PERMISSION.BRAND_UPDATE)} canDelete={hasPermission(user.role, PERMISSION.BRAND_DELETE)} />
      </div>
    </>
  );
}
