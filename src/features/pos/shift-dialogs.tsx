"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import { money } from "@/lib/money";
import { openShiftSchema, closeShiftSchema, type OpenShiftInput, type CloseShiftInput } from "@/validations/shift";
import { closeShiftAction, openShiftAction } from "@/server/actions";

const numberOrNaN = { setValueAs: (v: string) => (v === "" || v === undefined ? Number.NaN : Number(v)) } as const;

export function OpenShiftDialog({ currency, variant = "default" }: { currency: string; variant?: "default" | "outline" }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<OpenShiftInput>({ resolver: zodResolver(openShiftSchema), defaultValues: { openingBalance: 0, notes: "" } });
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) reset({ openingBalance: 0, notes: "" }); }}>
      <DialogTrigger asChild><Button variant={variant}><Unlock /> Open register</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Open register</DialogTitle><DialogDescription>Count the cash in the drawer and enter it as the opening balance ({currency}).</DialogDescription></DialogHeader>
        <form noValidate className="grid gap-4" onSubmit={handleSubmit(async (v) => {
          const res = await openShiftAction(v);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Register opened");
          setOpen(false);
          router.refresh();
        })}>
          <Field label="Opening balance" htmlFor="opening-balance" required error={errors.openingBalance?.message}><Input id="opening-balance" type="number" step="0.01" min="0" inputMode="decimal" autoFocus {...register("openingBalance", numberOrNaN)} /></Field>
          <Field label="Note" htmlFor="open-notes" error={errors.notes?.message}><Textarea id="open-notes" rows={2} {...register("notes")} /></Field>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Opening…" : "Open register"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CloseShiftDialog({ shiftId, expectedCash, currency }: { shiftId: string; expectedCash: string; currency: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<CloseShiftInput>({ resolver: zodResolver(closeShiftSchema), defaultValues: { shiftId, countedCash: Number(expectedCash), notes: "" } });
  const counted = watch("countedCash");
  const variance = typeof counted === "number" && !Number.isNaN(counted) ? money(counted).minus(expectedCash) : null;
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) reset({ shiftId, countedCash: Number(expectedCash), notes: "" }); }}>
      <DialogTrigger asChild><Button variant="outline"><Lock /> Close register</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Close register</DialogTitle><DialogDescription>Count the drawer. Expected cash is the opening balance plus today’s cash sales.</DialogDescription></DialogHeader>
        <form noValidate className="grid gap-4" onSubmit={handleSubmit(async (v) => {
          const res = await closeShiftAction(v);
          if (!res.ok) return void toast.error(res.error);
          toast.success(Number(res.data.variance) === 0 ? "Register closed — drawer balanced" : `Register closed — variance ${formatCurrency(res.data.variance, currency)}`);
          setOpen(false);
          router.refresh();
        })}>
          <div className="flex items-baseline justify-between rounded-lg bg-secondary/60 px-4 py-3 text-sm"><span>Expected in drawer</span><span className="num text-lg font-bold">{formatCurrency(expectedCash, currency)}</span></div>
          <Field label="Counted cash" htmlFor="counted-cash" required error={errors.countedCash?.message}><Input id="counted-cash" type="number" step="0.01" min="0" inputMode="decimal" autoFocus {...register("countedCash", numberOrNaN)} /></Field>
          {variance && !variance.isZero() && <p role="status" className={variance.isNegative() ? "text-sm font-medium text-destructive" : "text-sm font-medium text-warning"}>{variance.isNegative() ? "Short by" : "Over by"} {formatCurrency(variance.abs(), currency)}</p>}
          <Field label="Note" htmlFor="close-notes" error={errors.notes?.message} hint="Explain any variance."><Textarea id="close-notes" rows={2} {...register("notes")} /></Field>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Closing…" : "Close register"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
