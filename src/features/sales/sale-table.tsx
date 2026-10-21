import Link from "next/link";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/badges";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { formatDateTime, fullName } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import type { listSales } from "@/server/sales.service";
import type { SortOrder } from "@/lib/pagination";

type Row = Awaited<ReturnType<typeof listSales>>["rows"][number];

export function SaleTable({ rows, currency, showEmployee, empty, url, sort, order }: { rows: Row[]; currency: string; showEmployee: boolean; empty?: React.ReactNode; url?: { basePath: string; params: Record<string, string | undefined> }; sort?: string; order?: SortOrder }) {
  const columns: Column<Row>[] = [
    { key: "no", header: "Sale", sortKey: "saleNumber", cell: (s) => <Link href={`/sales/${s.id}`} className="font-mono text-[13px] font-medium text-primary hover:underline">{s.saleNumber}</Link> },
    { key: "when", header: "Date", sortKey: "createdAt", cell: (s) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(s.createdAt)}</span> },
    { key: "cust", header: "Customer", cell: (s) => s.customer?.name ?? <span className="text-muted-foreground">Walk-in</span> },
    ...(showEmployee ? [{ key: "emp", header: "Employee", cell: (s: Row) => fullName(s.employee) }] : []),
    { key: "items", header: "Items", align: "right" as const, cell: (s: Row) => <span className="num">{s._count.items}</span> },
    { key: "pay", header: "Payment", cell: (s: Row) => PAYMENT_METHOD_LABELS[s.paymentMethod] },
    { key: "status", header: "Status", sortKey: "paymentStatus", cell: (s: Row) => <div className="flex gap-1">{s.status === "VOIDED" ? <StatusBadge status="VOIDED" /> : <StatusBadge status={s.paymentStatus} />}</div> },
    { key: "total", header: "Total", sortKey: "total", align: "right" as const, cell: (s: Row) => <CurrencyDisplay value={s.total} currency={currency} className="font-medium" /> },
  ];
  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} empty={empty} url={url} sort={sort && order ? { key: sort, order } : undefined} />;
}
