import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSION, hasPermission } from "@/lib/rbac/permission";
import { PageHeader } from "@/components/shared/page-header";
import { WarrantyLookup } from "@/features/warranties/warranty-lookup";

export const metadata: Metadata = { title: "Warranty lookup" };

export default async function WarrantiesPage() {
  const user = await requirePermission(PERMISSION.WARRANTY_VIEW);
  return (
    <>
      <PageHeader title="Warranty lookup" description="Scan a device IMEI or enter the warranty tag printed on the receipt." />
      <WarrantyLookup canClaim={hasPermission(user.role, PERMISSION.WARRANTY_MANAGE)} />
    </>
  );
}
