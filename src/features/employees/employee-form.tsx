"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/ui/field";
import { employeeCreateSchema, employeeUpdateSchema, type EmployeeCreateValues, type EmployeeUpdateValues } from "@/validations/employee";
import { createEmployeeAction, updateEmployeeAction } from "@/server/actions";
import { ROLE, type Role } from "@/lib/constants/roles";

export function EmployeeForm({ employee, onCancel, onSuccess }: { employee?: { id: string; firstName: string; lastName: string; email: string; phone: string | null; role: Role }; onCancel?: () => void; onSuccess?: () => void }) {
  const router = useRouter();
  const edit = !!employee;
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EmployeeCreateValues & { id?: string }>({
    resolver: zodResolver(edit ? (employeeUpdateSchema as unknown as typeof employeeCreateSchema) : employeeCreateSchema),
    defaultValues: { id: employee?.id, firstName: employee?.firstName ?? "", lastName: employee?.lastName ?? "", email: employee?.email ?? "", phone: employee?.phone ?? "", role: employee?.role ?? ROLE.EMPLOYEE, password: "" },
  });
  return (
    <form noValidate onSubmit={handleSubmit(async (v) => {
      const res = edit ? await updateEmployeeAction(v as EmployeeUpdateValues) : await createEmployeeAction(v);
      if (!res.ok) return void toast.error(res.error);
      toast.success(edit ? "Account updated" : "Account created");
      onSuccess?.();
      router.push("/employees");
      router.refresh();
    })}>
      <Card className="max-w-2xl"><CardContent className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="firstName" required error={errors.firstName?.message}><Input id="firstName" {...register("firstName")} /></Field>
        <Field label="Last name" htmlFor="lastName" required error={errors.lastName?.message}><Input id="lastName" {...register("lastName")} /></Field>
        <Field label="Email" htmlFor="email" required error={errors.email?.message} className="sm:col-span-2"><Input id="email" type="email" autoComplete="off" {...register("email")} /></Field>
        <Field label="Phone" htmlFor="phone" error={errors.phone?.message}><Input id="phone" inputMode="tel" {...register("phone")} /></Field>
        <Field label="Role" htmlFor="role" hint="Employees can sell and view stock. Admins can do everything."><NativeSelect id="role" {...register("role")}><option value={ROLE.EMPLOYEE}>Employee</option><option value={ROLE.ADMIN}>Admin</option></NativeSelect></Field>
        {!edit && <Field label="Temporary password" htmlFor="password" required error={errors.password?.message} hint="At least 10 characters with upper case, lower case and a number." className="sm:col-span-2"><Input id="password" type="password" autoComplete="new-password" {...register("password")} /></Field>}
        <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={onCancel ?? (() => router.back())}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : edit ? "Save changes" : "Create account"}</Button></div>
      </CardContent></Card>
    </form>
  );
}
