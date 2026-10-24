import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePermission } from "@/lib/auth/guards";
import {PERMISSION, hasPermission} from "@/lib/rbac/permission";
import { fullName, formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { Receipt } from "@/features/sales/receipt";
import { DownloadReceipt, PrintButton, VoidSaleDialog } from "@/features/sales/sale-actions";
import { getSaleForUserBySlug } from "@/server/sales.service";
import { getSettings } from "@/server/settings.service";
import { SettlePaymentDialog } from "@/features/sales/settle-payment-dialog";
import { money } from "@/lib/money";

export default async function SaleDetailPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ new?: string }> }) {
  const user = await requirePermission(PERMISSION.SALE_VIEW);
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const sale = await getSaleForUserBySlug(user, slug);
  if (!sale) notFound();
  const settings = await getSettings();
  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={sale.saleNumber}
          description={sp.new ? "Sale completed. Print or download the receipt for the customer." : undefined}
          actions={
            <>
              <StatusBadge status={sale.status} />
              <PrintButton />
              <DownloadReceipt slug={sale.slug} />
              {sale.status === "COMPLETED" && money(sale.total).minus(sale.amountPaid).gt(0) && hasPermission(user.role, PERMISSION.SALE_SETTLE) && <SettlePaymentDialog saleId={sale.id} saleNumber={sale.saleNumber} balance={money(sale.total).minus(sale.amountPaid).toFixed(2)} />}
              {hasPermission(user.role, PERMISSION.SALE_VOID) && sale.status === "COMPLETED" && <VoidSaleDialog saleId={sale.id} saleNumber={sale.saleNumber} />}
              {hasPermission(user.role, PERMISSION.SALE_CREATE) && <Button asChild><Link href="/sales/new">New sale</Link></Button>}
            </>
          }
        />
        {sale.status === "VOIDED" && (
          <p role="status" className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Voided {sale.voidedAt ? formatDateTime(sale.voidedAt) : ""} by {sale.voidedBy ? fullName(sale.voidedBy) : "an admin"}: {sale.voidReason}
          </p>
        )}
      </div>
      <div className="rounded-2xl border border-border/70 bg-muted/40 p-2 shadow-sm sm:p-5 lg:p-7">
        <Receipt sale={sale} settings={settings} />
      </div>
    </>
  );
}
