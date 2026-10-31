"use client";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { settleSalePaymentAction } from "@/server/actions";

export function SettlePaymentDialog({ saleId, saleNumber, balance }: { saleId: string; saleNumber: string; balance: string }) {
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState(balance);
  const [method, setMethod] = React.useState<(typeof PAYMENT_METHODS)[number]>("CASH");
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await settleSalePaymentAction({ saleId, amount: Number(amount), method, note });
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Payment recorded for ${saleNumber}`);
      setOpen(false);
    } catch {
      toast.error("Payment could not be recorded. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return <>
    <Button variant="outline" onClick={() => setOpen(true)}>Record payment</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record payment</DialogTitle><DialogDescription>Outstanding balance for {saleNumber}: Rs {balance}</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <label className="grid gap-2 text-sm font-medium">Amount<Input type="number" min="0.01" max={balance} step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
          <label className="grid gap-2 text-sm font-medium">Payment method<NativeSelect value={method} onChange={(event) => setMethod(event.target.value as (typeof PAYMENT_METHODS)[number])}>{PAYMENT_METHODS.map((value) => <option key={value} value={value}>{PAYMENT_METHOD_LABELS[value]}</option>)}</NativeSelect></label>
          <label className="grid gap-2 text-sm font-medium">Note (optional)<Textarea maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} /></label>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save payment"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
