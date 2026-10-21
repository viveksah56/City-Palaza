import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requirePermission } from "@/lib/auth/guards";
import {PERMISSION, hasPermission, type Permission} from "@/lib/rbac/permission";
import { resolveRange } from "@/lib/dates";
import { first, buildHref, toParams, type SearchParams } from "@/lib/url";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { cn } from "@/lib/utils";
import { SalesReport, ProfitReport, InventoryReport, EmployeeReport } from "@/features/reports/report-sections";
import { LoadingSkeleton } from "@/components/shared/states";

export const metadata: Metadata = { title: "Reports" };

const TABS: { key: string; label: string; permission: Permission }[] = [
  { key: "sales", label: "Sales", permission: PERMISSION.REPORT_SALES },
  { key: "profit", label: "Profit", permission: PERMISSION.REPORT_PROFIT },
  { key: "inventory", label: "Inventory", permission: PERMISSION.REPORT_INVENTORY },
  { key: "employees", label: "Employee performance", permission: PERMISSION.REPORT_SALES },
];

export default function ReportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<LoadingSkeleton rows={5} cards={4} />}>
      <ReportsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ReportsContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePermission(PERMISSION.REPORT_VIEW);
  const sp = await searchParams;
  const tabs = TABS.filter((t) => hasPermission(user.role, t.permission));
  const tab = tabs.find((t) => t.key === first(sp.tab))?.key ?? tabs[0]!.key;
  const range = resolveRange(first(sp.range), first(sp.from), first(sp.to), { fallback: "last30" });
  const params = toParams(sp);
  return (
    <>
      <PageHeader title="Reports" description="Built from recorded sales and stock, so past figures don’t change when prices do." actions={tab !== "inventory" ? <DateRangePicker defaultPreset="last30" /> : undefined} />
      <div role="tablist" aria-label="Report type" className="scrollbar-none mb-8 inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-secondary p-1">
        {tabs.map((t) => (
          <Link key={t.key} role="tab" aria-selected={tab === t.key} href={buildHref("/reports", params, { tab: t.key })} className={cn("whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200", tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{t.label}</Link>
        ))}
      </div>
      {tab === "sales" && <SalesReport range={range} />}
      {tab === "profit" && <ProfitReport range={range} />}
      {tab === "inventory" && <InventoryReport />}
      {tab === "employees" && <EmployeeReport range={range} />}
    </>
  );
}
