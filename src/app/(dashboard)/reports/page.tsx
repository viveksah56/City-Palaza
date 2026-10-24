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
import { ReportExports } from "@/features/reports/report-exports";
import { BarChart3, Boxes, TrendingUp, Users } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Reports" };

const TABS: { key: string; label: string; permission: Permission; icon: typeof BarChart3 }[] = [
  { key: "sales", label: "Sales", permission: PERMISSION.REPORT_SALES, icon: BarChart3 },
  { key: "profit", label: "Profit", permission: PERMISSION.REPORT_PROFIT, icon: TrendingUp },
  { key: "inventory", label: "Inventory", permission: PERMISSION.REPORT_INVENTORY, icon: Boxes },
  { key: "employees", label: "Employee performance", permission: PERMISSION.REPORT_SALES, icon: Users },
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
  const tab = tabs.find((t) => t.key === first(sp.report) || t.key === first(sp.tab))?.key ?? tabs[0]!.key;
  const range = resolveRange(first(sp.range), first(sp.from), first(sp.to), { fallback: "last30" });
  const params = toParams(sp);
  return (
    <div className="report-page min-w-0 space-y-5 sm:space-y-6">
      <PageHeader title="Reports" description="Built from recorded sales and stock, so past figures don’t change when prices do." actions={<div className="report-toolbar flex min-w-0 flex-wrap items-center gap-2 print:hidden">{tab !== "inventory" ? <DateRangePicker defaultPreset="last30" /> : <span className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground">As of {formatDate(new Date())}</span>}<ReportExports range={tab === "inventory" ? undefined : range} scope="report" reportTab={tab} /></div>} />
      <nav aria-label="Report type" className="scrollbar-none -mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-1 print:hidden">
        {tabs.map((t) => {
          const Icon = t.icon;
          return <Link key={t.key} aria-current={tab === t.key ? "page" : undefined} href={buildHref("/reports", params, { report: t.key, tab: undefined })} className={cn("inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors", tab === t.key ? "border-primary/30 bg-primary/10 text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground")}><Icon aria-hidden="true" className="size-4" />{t.label}</Link>;
        })}
      </nav>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/70 pb-4 text-xs text-muted-foreground">
        <span>Period: {tab === "inventory" ? "Current stock snapshot" : `${formatDate(range.from)} – ${formatDate(new Date(range.to.getTime() - 1))}`}</span>
        <span aria-hidden="true">·</span><span>Generated {formatDateTime(new Date())}</span>
        {tab !== "inventory" && <><span aria-hidden="true">·</span><span>Prices as recorded at time of sale</span></>}
      </div>
      {tab === "sales" && <SalesReport range={range} />}
      {tab === "profit" && <ProfitReport range={range} />}
      {tab === "inventory" && <InventoryReport />}
      {tab === "employees" && <EmployeeReport range={range} />}
    </div>
  );
}
