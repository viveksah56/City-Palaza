"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { customerSchema, type CustomerValues } from "@/validations/customer";
import { saveCustomerAction } from "@/server/actions";

export function CustomerFormDialog({ customer }: { customer?: { id: string; name: string; phone: string | null; email: string | null; address: string | null } }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { id: customer?.id, name: customer?.name ?? "", phone: customer?.phone ?? "", email: customer?.email ?? "", address: customer?.address ?? "" },
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      {customer ? (
        <Tooltip><TooltipTrigger asChild><DialogTrigger asChild><Button size="icon" variant="ghost" aria-label={`Edit ${customer.name}`} title={`Edit ${customer.name}`}><Pencil /></Button></DialogTrigger></TooltipTrigger><TooltipContent>Edit customer</TooltipContent></Tooltip>
      ) : <DialogTrigger asChild><Button><Plus /> Add customer</Button></DialogTrigger>}
      <DialogContent>
        <DialogHeader><DialogTitle>{customer ? "Edit customer" : "Add customer"}</DialogTitle></DialogHeader>
        <form noValidate className="grid gap-4" onSubmit={handleSubmit(async (v) => {
          const res = await saveCustomerAction(v);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Customer saved");
          setOpen(false);
          router.refresh();
        })}>
          <Field label="Name" htmlFor="c-name" required error={errors.name?.message}><Input id="c-name" {...register("name")} /></Field>
          <Field label="Phone" htmlFor="c-phone" error={errors.phone?.message}><Input id="c-phone" inputMode="tel" {...register("phone")} /></Field>
          <Field label="Email" htmlFor="c-email" error={errors.email?.message}><Input id="c-email" type="email" {...register("email")} /></Field>
          <Field label="Address" htmlFor="c-address" error={errors.address?.message}><Input id="c-address" {...register("address")} /></Field>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save customer"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
