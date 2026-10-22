import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSION, hasPermission } from "@/lib/rbac/permission";
import { PageHeader } from "@/components/shared/page-header";
import { TaxonomyManager } from "@/features/products/taxonomy-manager";
import { TAXONOMY_KIND } from "@/lib/constants/categories";
import { getCategories } from "@/server/products.service";
import { ReportCard } from "@/components/shared/report-card";

export const metadata: Metadata = { title: "Categories & brands" };

export default async function CatalogPage() {
  const user = await requirePermission(PERMISSION.CATEGORY_VIEW);
  const categories = await getCategories();
  return (
    <>
      <PageHeader title="Categories" description="Group products so they’re easy to find at the counter and in reports." />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:max-w-xs sm:gap-4">
        <ReportCard label="Active categories" value={categories.filter((item) => item.isActive).length} hint={`${categories.length} total categories`} />
      </div>
      <TaxonomyManager kind={TAXONOMY_KIND.CATEGORY} items={categories} canCreate={hasPermission(user.role, PERMISSION.CATEGORY_CREATE)} canUpdate={hasPermission(user.role, PERMISSION.CATEGORY_UPDATE)} canDelete={hasPermission(user.role, PERMISSION.CATEGORY_DELETE)} />
    </>
  );
}
