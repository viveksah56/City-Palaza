"use client";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Banknote, CreditCard, Landmark, QrCode, Smartphone, Wallet, Ellipsis } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { money } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { PaymentMethodValue } from "./payment-method-selector";

const ICONS = { CASH: Banknote, CARD: CreditCard, UPI: QrCode, ESEWA: Smartphone, KHALTI: Wallet, BANK_TRANSFER: Landmark, OTHER: Ellipsis } satisfies Record<PaymentMethodValue, React.ComponentType<{ className?: string }>>;

export type PaymentSelection = { method: PaymentMethodValue; amountTendered: number | null };

/** Rounds up to the next "note-friendly" amounts so the cashier can tap instead of typing. */
export function tenderSuggestions(total: number): number[] {
  const steps = [50, 100, 500, 1000, 5000];
  const out = new Set<number>();
  for (const step of steps) {
    const up = Math.ceil(total / step) * step;
    if (up > total) out.add(up);
  }
  return [...out].slice(0, 4);
}

export function PaymentDialog({ open, onOpenChange, total, currency, submitting, onConfirm }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: string;
  currency: string;
  submitting: boolean;
  onConfirm: (selection: PaymentSelection) => void;
}) {
  const totalNumber = money(total).toNumber();
  const schema = React.useMemo(
    () =>
      z
        .object({ method: z.enum(PAYMENT_METHODS), tendered: z.number({ invalid_type_error: "Enter the cash received" }).min(0).max(99_999_999).nullable() })
        .superRefine((v, ctx) => {
          if (v.method !== "CASH") return;
          if (v.tendered === null || Number.isNaN(v.tendered)) ctx.addIssue({ code: "custom", path: ["tendered"], message: "Enter the cash received" });
          else if (v.tendered + 1e-9 < totalNumber) ctx.addIssue({ code: "custom", path: ["tendered"], message: `Must be at least ${formatCurrency(total, currency)}` });
        }),
    [totalNumber, total, currency],
  );
  type Form = z.infer<typeof schema>;
  const { register, control, setValue, handleSubmit, reset, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { method: "CASH", tendered: totalNumber } });
  React.useEffect(() => { if (open) reset({ method: "CASH", tendered: totalNumber }); }, [open, totalNumber, reset]);

  const [method, tendered] = useWatch({ control, name: ["method", "tendered"] });
  const change = method === "CASH" && typeof tendered === "number" && !Number.isNaN(tendered) ? Math.max(0, money(tendered).minus(total).toNumber()) : 0;
  const short = method === "CASH" && typeof tendered === "number" && !Number.isNaN(tendered) && tendered + 1e-9 < totalNumber;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!submitting) onOpenChange(next); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Take payment</DialogTitle>
          <DialogDescription>Choose how the customer is paying.</DialogDescription>
        </DialogHeader>
        <p className="num rounded-xl bg-primary/10 py-4 text-center text-4xl font-bold tracking-tight">{formatCurrency(total, currency)}</p>

        <form noValidate className="grid gap-4" onSubmit={handleSubmit((v) => onConfirm({ method: v.method, amountTendered: v.method === "CASH" ? v.tendered : null }))}>
          <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => {
              const Icon = ICONS[m];
              const selected = method === m;
              return (
                <button key={m} type="button" role="radio" aria-checked={selected} onClick={() => setValue("method", m, { shouldValidate: true })}
                  className={cn("flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary")}>
                  <Icon className="size-5" aria-hidden />{PAYMENT_METHOD_LABELS[m]}
                </button>
              );
            })}
          </div>

          {method === "CASH" && (
            <div className="grid gap-3">
              <Field label="Cash received" htmlFor="tendered" required error={errors.tendered?.message}>
                <Input id="tendered" type="number" step="0.01" min="0" inputMode="decimal" autoFocus className="h-12 text-xl font-semibold" aria-invalid={!!errors.tendered}
                  {...register("tendered", { setValueAs: (v: string) => (v === "" || v === undefined ? null : Number(v)) })} />
              </Field>
              <div className="flex flex-wrap gap-2" aria-label="Quick amounts">
                <Button type="button" variant="outline" size="sm" onClick={() => setValue("tendered", totalNumber, { shouldValidate: true })}>Exact</Button>
                {tenderSuggestions(totalNumber).map((amount) => (
                  <Button key={amount} type="button" variant="outline" size="sm" onClick={() => setValue("tendered", amount, { shouldValidate: true })}>{formatCurrency(amount, currency)}</Button>
                ))}
              </div>
              <div className={cn("flex items-baseline justify-between rounded-xl border px-4 py-3", short ? "border-destructive/40 bg-destructive/10" : "border-success/40 bg-success/10")} aria-live="polite">
                <span className="text-sm font-medium">{short ? "Still to collect" : "Change to return"}</span>
                <span className="num text-2xl font-bold">{formatCurrency(short && typeof tendered === "number" ? money(total).minus(tendered) : change, currency)}</span>
              </div>
            </div>
          )}
          {method !== "CASH" && <p className="rounded-lg bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">Confirm only after the {PAYMENT_METHOD_LABELS[method]} payment has gone through on the customer’s side.</p>}

          <Button type="submit" size="lg" disabled={submitting} className="h-12 text-base">{submitting ? "Completing…" : `Confirm ${formatCurrency(total, currency)}`}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
