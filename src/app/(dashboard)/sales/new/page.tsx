import type { Metadata } from "next";
import {PERMISSION, hasRole} from "@/lib/rbac/permission";
import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/shared/page-header";
import { SalesTerminal } from "@/features/sales/sales-terminal";
import { ROLE } from "@/lib/constants/roles";
import { getSettings } from "@/server/settings.service";
import { QueryProvider } from "@/components/providers/query-provider";

export const metadata: Metadata = { title: "New sale" };

export default async function NewSalePage() {
  const user = await requirePermission(PERMISSION.SALE_CREATE);
  const s = await getSettings();
  return (
    <>
      <PageHeader title="New sale" description="Add products, pick payment, complete." />
      <QueryProvider><SalesTerminal currency={s.currency} taxRate={s.taxRate} discountLimit={s.employeeDiscountLimit} isAdmin={hasRole(user.role, ROLE.ADMIN)} /></QueryProvider>
    </>
  );
}
