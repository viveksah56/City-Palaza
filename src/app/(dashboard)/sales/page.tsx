import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import {PERMISSION, hasPermission} from "@/lib/rbac/permission";
import { toParams, type SearchParams } from "@/lib/url";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { fullName } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { EmptyState } from "@/components/shared/states";
import { Pagination } from "@/components/shared/data-table";
import { SaleTable } from "@/features/sales/sale-table";
import { listSales, parseSalesQuery } from "@/server/sales.service";
import { listEmployeeOptions } from "@/server/employees.service";
import { getSettings } from "@/server/settings.service";
import { getSalesSummary } from "@/server/reports.service";
import { ReportCard } from "@/components/shared/report-card";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { ReportExports } from "@/features/reports/report-exports";
import { resolveRange } from "@/lib/dates";
import { first } from "@/lib/url";

export const metadata: Metadata = { title: "Sales" };

export default async function SalesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePermission(PERMISSION.SALE_VIEW);
  const sp = await searchParams;
  const all = hasPermission(user.role, PERMISSION.SALE_VIEW_ALL);
  const query = parseSalesQuery(sp);
  const range = resolveRange(first(sp.range), first(sp.from), first(sp.to), { fallback: "last30" });
  const [result, settings, staff, overview] = await Promise.all([
    listSales(user, query), getSettings(), all ? listEmployeeOptions() : Promise.resolve([]),
    getSalesSummary({ from: query.from, to: query.to }, all ? undefined : user.id),
  ]);
  const params = toParams(sp);
  return (
    <>
      <PageHeader
        title={all ? "Sales" : "My sales"}
        description={all ? "Every sale across the shop." : "Sales you’ve made."}
        actions={<><ReportExports range={range} scope="sales" />{hasPermission(user.role, PERMISSION.SALE_CREATE) && <Button asChild><Link href="/sales/new"><Plus /> New sale</Link></Button>}</>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <ReportCard label="Completed sales" value={overview.count} hint="In the selected period" />
        <ReportCard label="Booked sales" value={<CurrencyDisplay value={overview.total} currency={settings.currency} />} hint="Completed transactions" accent="blue" />
        <ReportCard label="Collected" value={<CurrencyDisplay value={overview.collected} currency={settings.currency} />} hint="Payments received in period" accent="green" />
        <ReportCard label="Outstanding" value={<CurrencyDisplay value={overview.outstanding} currency={settings.currency} />} hint="Balance due on period sales" accent="orange" />
        <ReportCard label="Average sale" value={<CurrencyDisplay value={overview.averageSale} currency={settings.currency} />} hint="Net per completed sale, excluding tax" accent="purple" />
      </div>
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-4">
          <SearchInput placeholder="Sale number or customer" />
          <DateRangePicker defaultPreset="last30" />
          {all && <FilterSelect param="employee" label="Employee" options={staff.map((e) => ({ value: e.id, label: fullName(e) }))} />}
          <FilterSelect param="payment" label="Payment" options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }))} />
          <FilterSelect param="status" label="Status" options={[{ value: "COMPLETED", label: "Completed" }, { value: "VOIDED", label: "Voided" }]} />
        </div>
        <SaleTable rows={result.rows} currency={settings.currency} showEmployee={all} sort={query.sort} order={query.order} url={{ basePath: "/sales", params }} empty={<EmptyState title="No sales in this period" description="Try a wider date range, or make a sale." action={<Button asChild><Link href="/sales/new">New sale</Link></Button>} />} />
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} url={{ basePath: "/sales", params }} />
      </Card>
    </>
  );
}
