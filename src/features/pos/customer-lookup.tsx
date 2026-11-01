"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconButton } from "@/components/shared/icon-button";
import { customerSchema } from "@/validations/customer";
import { z } from "zod";
import { useCustomerSearch, type CustomerSearchResult } from "./pos-queries";

const quickCustomerSchema = customerSchema.pick({ name: true, phone: true, address: true });
type QuickCustomer = z.infer<typeof quickCustomerSchema>;
export type NewCustomerDraft = { name: string; phone: string | null; address: string | null };

export function CustomerLookup({ customer, newCustomer, onSelect, onCreate }: {
  customer: CustomerSearchResult | null;
  newCustomer: NewCustomerDraft | null;
  onSelect: (customer: CustomerSearchResult | null) => void;
  onCreate: (draft: NewCustomerDraft | null) => void;
}) {
  const [term, setTerm] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [dialog, setDialog] = React.useState(false);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 220);
    return () => clearTimeout(timer);
  }, [term]);
  const results = useCustomerSearch(debounced).data ?? [];

  const chosen = customer ? `${customer.name}${customer.phone ? ` · ${customer.phone}` : ""}` : newCustomer ? `${newCustomer.name}${newCustomer.phone ? ` · ${newCustomer.phone}` : ""} (new)` : null;

  return (
    <div className="grid gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</p>
      {chosen ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium">
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{chosen}</span>
          <IconButton label="Remove customer" variant="ghost" className="size-9 shrink-0" onClick={() => { onSelect(null); onCreate(null); }}><X /></IconButton>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <Input aria-label="Find customer" placeholder="Name or phone — blank = walk-in" value={term} onChange={(e) => setTerm(e.target.value)} className="h-9" />
            <Button type="button" size="sm" variant="outline" className="h-9 shrink-0" onClick={() => setDialog(true)}><UserPlus /> New</Button>
          </div>
          {results.length > 0 && (
            <ul className="overflow-hidden rounded-lg border border-border bg-card">
              {results.map((c) => (
                <li key={c.id}><button type="button" className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-secondary" onClick={() => { onSelect(c); setTerm(""); setDebounced(""); }}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</button></li>
              ))}
            </ul>
          )}
        </>
      )}
      <NewCustomerDialog open={dialog} onOpenChange={setDialog} initialName={term} onSave={(draft) => { onCreate(draft); setTerm(""); }} />
    </div>
  );
}

function NewCustomerDialog({ open, onOpenChange, initialName, onSave }: { open: boolean; onOpenChange: (open: boolean) => void; initialName: string; onSave: (draft: NewCustomerDraft) => void }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<QuickCustomer>({ resolver: zodResolver(quickCustomerSchema), defaultValues: { name: "", phone: "", address: "" } });
  React.useEffect(() => { if (open) reset({ name: /\d/.test(initialName) ? "" : initialName, phone: /\d/.test(initialName) ? initialName : "", address: "" }); }, [open, initialName, reset]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New customer</DialogTitle><DialogDescription>Saved to the customer ledger when the sale is completed. A phone number lets you find them (and their warranties) later.</DialogDescription></DialogHeader>
        <form noValidate className="grid gap-4" onSubmit={handleSubmit((v) => { onSave({ name: v.name, phone: v.phone?.trim() || null, address: v.address?.trim() || null }); onOpenChange(false); })}>
          <Field label="Name" htmlFor="nc-name" required error={errors.name?.message}><Input id="nc-name" autoFocus {...register("name")} /></Field>
          <Field label="Phone" htmlFor="nc-phone" error={errors.phone?.message}><Input id="nc-phone" inputMode="tel" {...register("phone")} /></Field>
          <Field label="Address" htmlFor="nc-address" error={errors.address?.message}><Input id="nc-address" {...register("address")} /></Field>
          <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit">Use customer</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
