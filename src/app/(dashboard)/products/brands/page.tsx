import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission, PERMISSION } from "@/lib/rbac/permission";
import { PageHeader } from "@/components/shared/page-header";
import { ReportCard } from "@/components/shared/report-card";
import { TAXONOMY_KIND } from "@/lib/constants/categories";
import { getBrands } from "@/server/products.service";
import { TaxonomyManager } from "@/features/products/taxonomy-manager";

export const metadata: Metadata = { title: "Brands" };

export default async function BrandsPage() {
  const user = await requirePermission(PERMISSION.BRAND_VIEW);
  const brands = await getBrands();
  return (
    <>
      <PageHeader title="Brands" description="Manage the manufacturers and labels attached to your products." />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:max-w-xs sm:gap-4">
        <ReportCard label="Active brands" value={brands.filter((item) => item.isActive).length} hint={`${brands.length} total brands`} accent="purple" />
      </div>
      <TaxonomyManager kind={TAXONOMY_KIND.BRAND} items={brands} canCreate={hasPermission(user.role, PERMISSION.BRAND_CREATE)} canUpdate={hasPermission(user.role, PERMISSION.BRAND_UPDATE)} canDelete={hasPermission(user.role, PERMISSION.BRAND_DELETE)} />
    </>
  );
}
