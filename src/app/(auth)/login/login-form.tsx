"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { loginSchema, type LoginValues } from "@/validations/employee";
import { loginAction } from "@/server/actions";
import Link from "next/link";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [error, setError] = React.useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        const res = await loginAction(values, redirectTo);
        if (!res.ok) return setError(res.error);
      })}
    >
      {error && <p role="alert" className="rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-destructive">{error}</p>}
      <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="username" autoFocus aria-invalid={!!formState.errors.email} {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={formState.errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!formState.errors.password} {...register("password")} />
      </Field>
      <div className="-mt-2 flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Forgot password?</Link>
      </div>
      <Button type="submit" size="lg" className="mt-2 w-full" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}
