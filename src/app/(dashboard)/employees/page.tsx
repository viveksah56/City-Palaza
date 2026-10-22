import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import {PERMISSION, hasPermission} from "@/lib/rbac/permission";
import { toParams, type SearchParams } from "@/lib/url";
import { formatDateTime, fullName } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { StatusBadge } from "@/components/shared/badges";
import { DataTable, Pagination, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/states";
import { getEmployeeOverview, listEmployees, parseEmployeeQuery } from "@/server/employees.service";
import { EmployeeCreateDialog } from "@/features/employees/employee-create-dialog";
import { DeleteEmployeeButton } from "@/features/employees/employee-actions";
import { ReportCard } from "@/components/shared/report-card";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePermission(PERMISSION.EMPLOYEE_VIEW);
  const sp = await searchParams;
  const query = parseEmployeeQuery(sp);
  const [result, overview] = await Promise.all([listEmployees(query), getEmployeeOverview()]);
  const params = toParams(sp);
  type Row = (typeof result.rows)[number];
  const columns: Column<Row>[] = [
    { key: "n", header: "Name", sortKey: "firstName", cell: (e) => <div><Link href={`/employees/${e.id}`} className="font-medium hover:text-primary hover:underline">{fullName(e)}</Link><p className="text-xs text-muted-foreground">{e.email}</p></div> },
    { key: "r", header: "Role", sortKey: "role", cell: (e) => <StatusBadge status={e.role} /> },
    { key: "s", header: "Status", sortKey: "status", cell: (e) => <StatusBadge status={e.status} /> },
    { key: "c", header: "Sales", align: "right", cell: (e) => <span className="num">{e._count.sales}</span> },
    { key: "l", header: "Last sign-in", sortKey: "lastLoginAt", cell: (e) => (e.lastLoginAt ? formatDateTime(e.lastLoginAt) : "Never") },
    ...(hasPermission(user.role, PERMISSION.EMPLOYEE_DELETE) ? [{ key: "a", header: <span className="sr-only">Actions</span>, align: "right" as const, cell: (e: Row) => <DeleteEmployeeButton id={e.id} isSelf={e.id === user.id} compact /> }] : []),
  ];
  return (
    <>
      <PageHeader title="Team accounts" description="Manage employee and admin access and review team sales activity." actions={hasPermission(user.role, PERMISSION.EMPLOYEE_CREATE) ? <EmployeeCreateDialog /> : undefined} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <ReportCard label="Team members" value={overview.total} hint="All employee accounts" />
        <ReportCard label="Active" value={overview.active} hint="Can sign in" accent="green" />
        <ReportCard label="Inactive or suspended" value={overview.disabled} hint="Access is disabled" accent="orange" />
      </div>
      <Card className="gap-0 py-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-4">
          <SearchInput placeholder="Search name or email" />
          <FilterSelect param="status" label="Status" options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }, { value: "SUSPENDED", label: "Suspended" }]} />
        </div>
        <DataTable columns={columns} rows={result.rows} rowKey={(r) => r.id} url={{ basePath: "/employees", params }} sort={{ key: query.sort, order: query.order }} empty={<EmptyState title="No employees match" />} />
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} url={{ basePath: "/employees", params }} />
      </Card>
    </>
  );
}
