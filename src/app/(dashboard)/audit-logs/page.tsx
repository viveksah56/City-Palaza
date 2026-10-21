import type { Metadata } from "next";
import {PERMISSION} from "@/lib/rbac/permission";
import { requirePermission } from "@/lib/auth/guards";
import { toParams, type SearchParams } from "@/lib/url";
import { formatDateTime, fullName } from "@/lib/format";
import { AUDIT_ACTIONS } from "@/lib/audit";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { DataTable, Pagination, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/states";
import { listAuditLogs, parseAuditQuery } from "@/server/audit.service";
import { listEmployeeOptions } from "@/server/employees.service";
import { ReportCard } from "@/components/shared/report-card";

export const metadata: Metadata = { title: "Audit logs" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePermission(PERMISSION.AUDIT_VIEW);
  const sp = await searchParams;
  const query = parseAuditQuery(sp);
  const [result, staff] = await Promise.all([listAuditLogs(query), listEmployeeOptions()]);
  const params = toParams(sp);
  type Row = (typeof result.rows)[number];
  const columns: Column<Row>[] = [
    { key: "w", header: "When", sortKey: "createdAt", cell: (a) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(a.createdAt)}</span> },
    { key: "a", header: "Who", cell: (a) => (a.actor ? fullName(a.actor) : "System") },
    { key: "x", header: "Action", sortKey: "action", cell: (a) => <Badge variant="secondary">{a.action.replace(/_/g, " ").toLowerCase()}</Badge> },
    { key: "d", header: "What happened", cell: (a) => <span className="block min-w-64 text-sm">{a.description}<span className="block font-mono text-xs text-muted-foreground">{a.entityType}{a.entityId ? ` · ${a.entityId}` : ""}</span></span> },
    { key: "i", header: "IP / device", cell: (a) => <span className="block max-w-48 truncate text-xs text-muted-foreground" title={a.userAgent ?? ""}>{a.ipAddress ?? "—"}</span> },
  ];
  return (
    <>
      <PageHeader title="Audit logs" description="A permanent record of important actions. Only admins can see this." />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <ReportCard label="Matching events" value={result.total} hint="For the selected filters" />
        <ReportCard label="Team accounts" value={staff.length} hint="Available in the person filter" accent="purple" />
        <ReportCard label="Current page" value={`${result.rows.length} of ${result.pageSize}`} hint={`Page ${result.page} of ${result.totalPages}`} accent="teal" />
      </div>
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-4">
          <SearchInput placeholder="Search description or entity ID" />
          <FilterSelect param="action" label="Action" options={AUDIT_ACTIONS.map((a) => ({ value: a, label: a.replace(/_/g, " ").toLowerCase() }))} className="w-full sm:w-52" />
          <FilterSelect param="actor" label="Person" options={staff.map((s) => ({ value: s.id, label: fullName(s) }))} />
          <DateRangePicker defaultPreset="last7" />
        </div>
        <DataTable columns={columns} rows={result.rows} rowKey={(r) => r.id} url={{ basePath: "/audit-logs", params }} sort={{ key: query.sort, order: query.order }} empty={<EmptyState title="No activity in this period" />} />
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} url={{ basePath: "/audit-logs", params }} />
      </Card>
    </>
  );
}
