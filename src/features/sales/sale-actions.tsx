"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { voidSaleAction } from "@/server/actions";

export function PrintButton() {
  return <Button variant="outline" onClick={() => window.print()}><Printer /> Print</Button>;
}

export function DownloadReceipt({ slug }: { slug: string }) {
  return <Button asChild variant="outline"><a href={`/api/sales/${slug}/receipt`} download><Download /> Download PDF</a></Button>;
}

export function VoidSaleDialog({ saleId, saleNumber }: { saleId: string; saleNumber: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" className="text-destructive"><Ban /> Void sale</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void {saleNumber}?</DialogTitle>
          <DialogDescription>The sale stays on record as voided. Stock is returned to inventory, and sold IMEIs/serials go back in stock. This can’t be undone.</DialogDescription>
        </DialogHeader>
        <Field label="Reason for voiding" htmlFor="void-reason" required error={error}>
          <Textarea id="void-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!error} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Keep sale</Button>
          <Button
            variant="destructive" disabled={pending}
            onClick={() => start(async () => {
              const res = await voidSaleAction({ saleId, reason });
              if (!res.ok) { setError(res.fieldErrors?.reason?.[0] ?? res.error); return void toast.error(res.error); }
              toast.success("Sale voided and stock restored");
              setOpen(false);
              router.refresh();
            })}
          >{pending ? "Voiding…" : "Void sale"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
