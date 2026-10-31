import Link from "next/link";
import { AlertTriangle, CircleDot } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { ShiftSummary } from "@/server/shifts.service";
import { OpenShiftDialog } from "./shift-dialogs";

/** Slim status strip above the terminal: green when a till is open, amber CTA when it is not. */
export function ShiftBar({ shift, currency, canOpen }: { shift: ShiftSummary | null; currency: string; canOpen: boolean }) {
  if (!shift) {
    return (
      <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
        <span className="flex items-center gap-2 font-medium"><AlertTriangle className="size-4" aria-hidden /> No open register shift. Sales will not be tied to a cash drawer.</span>
        {canOpen && <OpenShiftDialog currency={currency} variant="outline" />}
      </div>
    );
  }
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm">
      <span className="flex items-center gap-2 font-medium"><CircleDot className="size-4 text-success" aria-hidden /> Register open since {formatDateTime(shift.openedAt)} · {shift.openedBy}</span>
      <span className="flex items-center gap-4 text-muted-foreground">
        <span>{shift.salesCount} sale{shift.salesCount === 1 ? "" : "s"}</span>
        <span>Cash in drawer <span className="num font-semibold text-foreground">{formatCurrency(shift.expectedCash, currency)}</span></span>
        <Link href="/register" className="font-medium text-primary hover:underline">Manage</Link>
      </span>
    </div>
  );
}
