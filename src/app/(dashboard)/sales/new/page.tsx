import type { Metadata } from "next";
import { PERMISSION, hasPermission, hasRole } from "@/lib/rbac/permission";
import { requirePermission } from "@/lib/auth/guards";
import { PosTerminal } from "@/features/pos/pos-terminal";
import { ShiftBar } from "@/features/pos/shift-bar";
import { ROLE } from "@/lib/constants/roles";
import { getSettings } from "@/server/settings.service";
import { getCategories } from "@/server/products.service";
import { getOpenShift } from "@/server/shifts.service";
import { QueryProvider } from "@/components/providers/query-provider";

export const metadata: Metadata = { title: "POS terminal" };

export default async function PosPage() {
  const user = await requirePermission(PERMISSION.SALE_CREATE);
  const [settings, categories, shift] = await Promise.all([getSettings(), getCategories(), getOpenShift()]);
  return (
    <div className="grid gap-3">
      <ShiftBar shift={shift} currency={settings.currency} canOpen={hasPermission(user.role, PERMISSION.SHIFT_OPEN)} />
      <QueryProvider>
        <PosTerminal
          currency={settings.currency}
          categories={categories.filter((c) => c.isActive).map((c) => ({ id: c.id, name: c.name }))}
          discountLimit={settings.employeeDiscountLimit}
          totalDiscountLimit={settings.employeeMaxTotalDiscountPercent}
          isAdmin={hasRole(user.role, ROLE.ADMIN)}
        />
      </QueryProvider>
    </div>
  );
}
