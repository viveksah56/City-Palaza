"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/badges";
import { formatDate } from "@/lib/format";
import { formatDevice } from "@/lib/imei";
import { claimWarrantyAction } from "@/server/actions";
import type { WarrantyRow } from "@/server/warranties.service";

export function WarrantyTable({ rows, canClaim, showCustomer = true }: { rows: WarrantyRow[]; canClaim: boolean; showCustomer?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tag</TableHead><TableHead>Device</TableHead>{showCustomer && <TableHead>Customer</TableHead>}<TableHead>Sale</TableHead><TableHead>Valid until</TableHead><TableHead>Status</TableHead><TableHead className="w-24" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((w) => (
          <TableRow key={w.id}>
            <TableCell className="font-mono text-xs">{w.tag}</TableCell>
            <TableCell><p className="font-medium">{w.productName}</p>{w.imei1 && <p className="font-mono text-xs text-muted-foreground">{formatDevice(w.imei1, w.imei2)}</p>}</TableCell>
            {showCustomer && <TableCell>{w.customerName ?? "Walk-in"}{w.customerPhone && <span className="block text-xs text-muted-foreground">{w.customerPhone}</span>}</TableCell>}
            <TableCell><Link href={`/sales/${w.saleSlug}`} className="text-primary hover:underline">{w.saleNumber}</Link></TableCell>
            <TableCell className="num">{formatDate(w.endsAt)}</TableCell>
            <TableCell>{w.expired ? <Badge variant="destructive">Expired</Badge> : <StatusBadge status={w.status} />}</TableCell>
            <TableCell className="text-right">{canClaim && w.status === "ACTIVE" && !w.expired && <ClaimDialog warranty={w} />}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ClaimDialog({ warranty }: { warranty: WarrantyRow }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline">Claim</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Record warranty claim</DialogTitle><DialogDescription>{warranty.productName} · {warranty.tag}</DialogDescription></DialogHeader>
        <Field label="Claim details" htmlFor="claim-notes" required error={error}><Textarea id="claim-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} aria-invalid={!!error} /></Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending} onClick={() => start(async () => {
            const res = await claimWarrantyAction(warranty.id, notes);
            if (!res.ok) { setError(res.error); return; }
            toast.success("Warranty marked as claimed");
            setOpen(false);
            router.refresh();
          })}>{pending ? "Saving…" : "Mark claimed"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
