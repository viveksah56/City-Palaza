"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { settingsSchema, type SettingsValues } from "@/validations/settings";
import { updateSettingsAction } from "@/server/actions";

export function SettingsForm({ defaults, canEdit }: { defaults: SettingsValues; canEdit: boolean }) {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SettingsValues>({ resolver: zodResolver(settingsSchema), defaultValues: defaults });
  const num = { valueAsNumber: true } as const;
  const nullableNum = { setValueAs: (value: string) => value === "" ? null : Number(value) } as const;
  return (
    <form noValidate className="grid max-w-3xl gap-6" onSubmit={handleSubmit(async (v) => {
      const res = await updateSettingsAction(v);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Settings saved");
      router.refresh();
    })}>
      <fieldset disabled={!canEdit} className="grid gap-6">
        <Card>
          <CardHeader><CardTitle>Shop</CardTitle><CardDescription>Printed at the top of every receipt.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Shop name" htmlFor="shopName" required error={errors.shopName?.message}><Input id="shopName" {...register("shopName")} /></Field>
            <Field label="City" htmlFor="city" error={errors.city?.message}><Input id="city" {...register("city")} /></Field>
            <Field label="Address" htmlFor="address" error={errors.address?.message} className="sm:col-span-2"><Input id="address" {...register("address")} /></Field>
            <Field label="Phone" htmlFor="phone" error={errors.phone?.message}><Input id="phone" {...register("phone")} /></Field>
            <Field label="Email" htmlFor="s-email" error={errors.email?.message}><Input id="s-email" type="email" {...register("email")} /></Field>
            <Field label="PAN number" htmlFor="panNumber" required error={errors.panNumber?.message} hint="Printed on customer receipts."><Input id="panNumber" inputMode="numeric" maxLength={9} className="font-mono" {...register("panNumber")} /></Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Sales rules</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Currency" htmlFor="currency" error={errors.currency?.message} hint="3-letter code, e.g. NPR"><Input id="currency" maxLength={3} className="uppercase" {...register("currency")} /></Field>
            <Field label="Invoice prefix" htmlFor="invoicePrefix" error={errors.invoicePrefix?.message} hint="Sale numbers look like CP-000123"><Input id="invoicePrefix" {...register("invoicePrefix")} /></Field>
            <Field label="Nepal VAT rate (%)" htmlFor="taxRate" error={errors.taxRate?.message} hint="Default is 13%. VAT is added to discounted prices at checkout."><Input id="taxRate" type="number" step="0.01" min="0" max="100" {...register("taxRate", num)} /></Field>
            <Field label="Employee discount limit (%)" htmlFor="employeeDiscountLimit" error={errors.employeeDiscountLimit?.message} hint="The most an employee can discount a sale. Admins have no limit."><Input id="employeeDiscountLimit" type="number" step="0.01" min="0" max="100" {...register("employeeDiscountLimit", num)} /></Field>
            <Field label="Employee total discount ceiling (%)" htmlFor="employeeMaxTotalDiscountPercent" error={errors.employeeMaxTotalDiscountPercent?.message} hint="Optional cap for promotions plus manual discounts. Leave blank to disable."><Input id="employeeMaxTotalDiscountPercent" type="number" step="0.01" min="0" max="100" {...register("employeeMaxTotalDiscountPercent", nullableNum)} /></Field>
          </CardContent>
        </Card>
      </fieldset>
      {canEdit && <div className="flex justify-end"><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save settings"}</Button></div>}
    </form>
  );
}
