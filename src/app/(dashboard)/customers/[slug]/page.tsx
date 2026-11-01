import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import {PERMISSION, hasPermission} from "@/lib/rbac/permission";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/states";
import { SaleTable } from "@/features/billing/sale-table";
import { getCustomerBySlug } from "@/server/customers.service";
import { listSales, parseSalesQuery } from "@/server/sales.service";
import { getSettings } from "@/server/settings.service";
import { listCustomerWarranties } from "@/server/warranties.service";
import { WarrantyTable } from "@/features/warranties/warranty-table";

export default async function CustomerPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requirePermission(PERMISSION.CUSTOMER_VIEW);
  const { slug } = await params;
  const customer = await getCustomerBySlug(slug);
  if (!customer) notFound();
  const q = { ...parseSalesQuery({ range: "thisYear" }), customerId: customer.id, pageSize: 50, take: 50 };
  const [sales, settings, warranties] = await Promise.all([listSales(user, q), getSettings(), hasPermission(user.role, PERMISSION.WARRANTY_VIEW) ? listCustomerWarranties(user, customer.id) : Promise.resolve([])]);
  return (
    <>
      <PageHeader title={customer.name} description={customer.lastPurchaseAt ? `Last purchase ${formatDate(customer.lastPurchaseAt)}` : "No purchases yet"} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <Card className="h-fit"><CardHeader><CardTitle>Contact</CardTitle></CardHeader><CardContent className="grid gap-2 text-sm [overflow-wrap:anywhere]">
          <p><span className="text-muted-foreground">Phone: </span>{customer.phone ?? "—"}</p>
          <p><span className="text-muted-foreground">Email: </span>{customer.email ?? "—"}</p>
          <p><span className="text-muted-foreground">Address: </span>{customer.address ?? "—"}</p>
          {customer.notes && <p><span className="text-muted-foreground">Notes: </span>{customer.notes}</p>}
        </CardContent></Card>
        <Card className="gap-0 py-0">
          <CardHeader className="p-4"><CardTitle>Purchase history{!hasPermission(user.role, PERMISSION.SALE_VIEW_ALL) ? " (your sales)" : ""}</CardTitle></CardHeader>
          <SaleTable rows={sales.rows} currency={settings.currency} showEmployee={hasPermission(user.role, PERMISSION.SALE_VIEW_ALL)} empty={<EmptyState title="No purchases this year" />} />
        </Card>
        {warranties.length > 0 && (
          <Card className="gap-0 overflow-x-auto py-0 xl:col-span-2">
            <CardHeader className="p-4"><CardTitle>Device warranties</CardTitle></CardHeader>
            <WarrantyTable rows={warranties} showCustomer={false} canClaim={hasPermission(user.role, PERMISSION.WARRANTY_MANAGE)} />
          </Card>
        )}
      </div>
    </>
  );
}
