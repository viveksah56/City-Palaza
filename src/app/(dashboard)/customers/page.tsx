import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import {PERMISSION, hasPermission} from "@/lib/rbac/permission";
import { toParams, type SearchParams } from "@/lib/url";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/shared/search-input";
import { DataTable, Pagination, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/states";
import { CustomerFormDialog } from "@/features/customers/customer-form-dialog";
import { getCustomerOverview, listCustomers, parseCustomerQuery } from "@/server/customers.service";
import { ReportCard } from "@/components/shared/report-card";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePermission(PERMISSION.CUSTOMER_VIEW);
  const sp = await searchParams;
  const query = parseCustomerQuery(sp);
  const [result, overview] = await Promise.all([listCustomers(query), getCustomerOverview()]);
  const params = toParams(sp);
  type Row = (typeof result.rows)[number];
  const canEdit = hasPermission(user.role, PERMISSION.CUSTOMER_UPDATE);
  const columns: Column<Row>[] = [
    { key: "name", header: "Customer", sortKey: "name", cell: (c) => <Link href={`/customers/${c.id}`} className="font-medium hover:text-primary hover:underline">{c.name}</Link> },
    { key: "phone", header: "Phone", sortKey: "phone", cell: (c) => c.phone ?? "—" },
    { key: "email", header: "Email", sortKey: "email", cell: (c) => c.email ?? "—" },
    { key: "orders", header: "Purchases", align: "right", cell: (c) => <span className="num">{c._count.sales}</span> },
    { key: "last", header: "Last purchase", sortKey: "lastPurchaseAt", cell: (c) => (c.lastPurchaseAt ? formatDate(c.lastPurchaseAt) : "—") },
    ...(canEdit ? [{ key: "edit", header: <span className="sr-only">Edit</span>, align: "right" as const, cell: (c: Row) => <CustomerFormDialog customer={c} /> }] : []),
  ];
  return (
    <>
      <PageHeader title="Customers" description="Optional for walk-ins, handy for repeat buyers." actions={hasPermission(user.role, PERMISSION.CUSTOMER_CREATE) ? <CustomerFormDialog /> : undefined} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <ReportCard label="All customers" value={overview.customers} hint="Saved customer profiles" />
        <ReportCard label="Customers with purchases" value={overview.purchasingCustomers} hint="At least one completed sale" accent="green" />
        <ReportCard label="Matching this search" value={result.total} hint="Results in the current view" accent="purple" />
      </div>
      <Card className="gap-0 py-0">
        <div className="border-b border-border/60 p-4"><SearchInput placeholder="Search name, phone or email" /></div>
        <DataTable columns={columns} rows={result.rows} rowKey={(r) => r.id} url={{ basePath: "/customers", params }} sort={{ key: query.sort, order: query.order }} empty={<EmptyState title="No customers found" description="Customers you add at the counter show up here." />} />
        <Pagination page={result.page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} url={{ basePath: "/customers", params }} />
      </Card>
    </>
  );
}
