import {PERMISSION} from "@/lib/rbac/permission";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import { toParams, type SearchParams } from "@/lib/url";
import { formatDateTime, fullName } from "@/lib/format";
import { TX_TYPES } from "@/lib/constants";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { DataTable, Pagination, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/states";
import { listInventoryHistory, parseHistoryQuery } from "@/server/inventory.service";
import { ReportCard } from "@/components/shared/report-card";

export const metadata = { title: "Stock history" };

const TYPE_VARIANT = { INITIAL_STOCK: "secondary", PURCHASE: "success", SALE: "muted", RETURN: "warning", ADJUSTMENT: "secondary", DAMAGE: "destructive", LOST: "destructive" } as const;

export default async function HistoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePermission(PERMISSION.INVENTORY_HISTORY_VIEW);
  const sp = await searchParams;
  const q = parseHistoryQuery(sp);
  const result = await listInventoryHistory(q);
  const params = toParams(sp);
  type Row = (typeof result.rows)[number];
  const columns: Column<Row>[] = [
    { key: "when", header: "When", cell: (t) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(t.createdAt)}</span> },
    { key: "product", header: "Product", cell: (t) => <div><Link href={`/products/${t.productId}`} className="font-medium hover:underline">{t.product.name}</Link><p className="font-mono text-xs text-muted-foreground">{t.product.sku}</p></div> },
    { key: "type", header: "Type", cell: (t) => <Badge variant={TYPE_VARIANT[t.type]}>{t.type.replace("_", " ").toLowerCase()}</Badge> },
    { key: "qty", header: "Change", align: "right", cell: (t) => <span className={`num font-medium ${t.quantity < 0 ? "text-destructive" : "text-success"}`}>{t.quantity > 0 ? "+" : ""}{t.quantity}</span> },
    { key: "bal", header: "Before → after", align: "right", cell: (t) => <span className="num text-muted-foreground">{t.previousQuantity} → {t.newQuantity}</span> },
    { key: "reason", header: "Reason / reference", cell: (t) => <span className="text-sm">{t.reason ?? "—"}{t.referenceId && t.referenceType?.startsWith("SALE") ? <> · <Link className="text-primary hover:underline" href={`/sales/${t.referenceId}`}>view sale</Link></> : null}</span> },
    { key: "by", header: "By", cell: (t) => <span className="whitespace-nowrap">{fullName(t.user)}</span> },
  ];
  return (
    <>
      <PageHeader title="Stock history" description="Every stock movement: who, when, how many and why." />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <ReportCard label="Matching movements" value={result.total} hint="For the selected filters" />
        <ReportCard label="Units moved on this page" value={result.rows.reduce((sum, row) => sum + row.quantity, 0)} hint="Net change across visible entries" accent="purple" />
        <ReportCard label="Page" value={`${result.page} of ${result.totalPages}`} hint={`${result.rows.length} entries shown`} accent="teal" />
      </div>
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-4">
          <SearchInput placeholder="Search product or SKU" />
          <FilterSelect param="type" label="Type" options={TX_TYPES.map((t) => ({ value: t, label: t.replace("_", " ").toLowerCase() }))} />
          <DateRangePicker defaultPreset="last30" />
        </div>
        <DataTable columns={columns} rows={result.rows} rowKey={(r) => r.id} empty={<EmptyState title="No stock movements in this period" />} />
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} url={{ basePath: "/inventory/history", params }} />
      </Card>
    </>
  );
}
