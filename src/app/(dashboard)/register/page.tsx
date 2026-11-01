import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guards";
import { PERMISSION, hasPermission } from "@/lib/rbac/permission";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/states";
import { CloseShiftDialog, OpenShiftDialog } from "@/features/pos/shift-dialogs";
import { getOpenShift, listShifts } from "@/server/shifts.service";
import { getSettings } from "@/server/settings.service";
import { ROLE } from "@/lib/constants/roles";

export const metadata: Metadata = { title: "Cash register" };

export default async function RegisterPage() {
  const user = await requirePermission(PERMISSION.SHIFT_VIEW);
  const [open, history, settings] = await Promise.all([getOpenShift(), listShifts(user), getSettings()]);
  const money = (v: string) => formatCurrency(v, settings.currency);
  const canClose = !!open && hasPermission(user.role, PERMISSION.SHIFT_CLOSE) && (user.role === ROLE.ADMIN || open.openedById === user.id);
  return (
    <>
      <PageHeader title="Cash register" description="Open the drawer with a counted balance, close it at end of day and review variances." actions={!open && hasPermission(user.role, PERMISSION.SHIFT_OPEN) ? <OpenShiftDialog currency={settings.currency} /> : undefined} />
      {open ? (
        <Card className="mb-6">
          <CardHeader><CardTitle className="flex items-center gap-2">Current shift <StatusBadge status="OPEN" /></CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <dl className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div><dt className="text-muted-foreground">Opened</dt><dd className="font-medium">{formatDateTime(open.openedAt)}<br />by {open.openedBy}</dd></div>
              <div><dt className="text-muted-foreground">Opening balance</dt><dd className="num text-lg font-semibold">{money(open.openingBalance)}</dd></div>
              <div><dt className="text-muted-foreground">Cash sales ({open.salesCount} sales)</dt><dd className="num text-lg font-semibold">{money(open.cashSales)}</dd></div>
              <div><dt className="text-muted-foreground">Expected in drawer</dt><dd className="num text-lg font-bold">{money(open.expectedCash)}</dd></div>
            </dl>
            {canClose && <div><CloseShiftDialog shiftId={open.id} expectedCash={open.expectedCash} currency={settings.currency} /></div>}
          </CardContent>
        </Card>
      ) : null}
      <Card className="gap-0 overflow-x-auto py-0">
        <CardHeader className="p-4"><CardTitle>Shift history</CardTitle></CardHeader>
        {history.length === 0 ? <EmptyState title="No shifts yet" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Opened</TableHead><TableHead>Cashier</TableHead><TableHead className="text-right">Opening</TableHead><TableHead className="text-right">Cash sales</TableHead><TableHead className="text-right">Expected</TableHead><TableHead className="text-right">Counted</TableHead><TableHead className="text-right">Variance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {history.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{formatDateTime(s.openedAt)}</TableCell>
                  <TableCell>{s.openedBy}</TableCell>
                  <TableCell className="num text-right">{money(s.openingBalance)}</TableCell>
                  <TableCell className="num text-right">{money(s.cashSales)}</TableCell>
                  <TableCell className="num text-right">{money(s.expectedCash)}</TableCell>
                  <TableCell className="num text-right">{s.countedCash ? money(s.countedCash) : "—"}</TableCell>
                  <TableCell className={`num text-right font-medium ${s.variance && Number(s.variance) < 0 ? "text-destructive" : ""}`}>{s.variance ? money(s.variance) : "—"}</TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </>
  );
}
