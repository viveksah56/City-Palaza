import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import {PERMISSION, hasPermission} from "@/lib/rbac/permission";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/states";
import { SaleTable } from "@/features/sales/sale-table";
import { getCustomerBySlug } from "@/server/customers.service";
import { listSales, parseSalesQuery } from "@/server/sales.service";
import { getSettings } from "@/server/settings.service";

export default async function CustomerPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requirePermission(PERMISSION.CUSTOMER_VIEW);
  const { slug } = await params;
  const customer = await getCustomerBySlug(slug);
  if (!customer) notFound();
  const q = { ...parseSalesQuery({ range: "thisYear" }), customerId: customer.id, pageSize: 50, take: 50 };
  const [sales, settings] = await Promise.all([listSales(user, q), getSettings()]);
  return (
    <>
      <PageHeader title={customer.name} description={customer.lastPurchaseAt ? `Last purchase ${formatDate(customer.lastPurchaseAt)}` : "No purchases yet"} />
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card className="h-fit"><CardHeader><CardTitle>Contact</CardTitle></CardHeader><CardContent className="grid gap-2 text-sm">
          <p><span className="text-muted-foreground">Phone: </span>{customer.phone ?? "—"}</p>
          <p><span className="text-muted-foreground">Email: </span>{customer.email ?? "—"}</p>
          <p><span className="text-muted-foreground">Address: </span>{customer.address ?? "—"}</p>
        </CardContent></Card>
        <Card className="gap-0 py-0">
          <CardHeader className="p-4"><CardTitle>Purchase history{!hasPermission(user.role, PERMISSION.SALE_VIEW_ALL) ? " (your sales)" : ""}</CardTitle></CardHeader>
          <SaleTable rows={sales.rows} currency={settings.currency} showEmployee={hasPermission(user.role, PERMISSION.SALE_VIEW_ALL)} empty={<EmptyState title="No purchases this year" />} />
        </Card>
      </div>
    </>
  );
}
