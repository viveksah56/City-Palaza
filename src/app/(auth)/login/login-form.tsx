"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { loginSchema, type LoginValues } from "@/validations/employee";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { formatCooldown, useCooldown } from "@/hooks/use-cooldown";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [error, setError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const { seconds: cooldownSeconds, start: startCooldown } = useCooldown();
  const { register, handleSubmit, formState } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        try {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...values, redirectTo }),
          });
          const result = await response.json() as { ok?: boolean; redirectTo?: string; error?: string; retryAfterSeconds?: number };
          if (response.status === 429) {
            const seconds = Number(response.headers.get("Retry-After")) || result.retryAfterSeconds || 300;
            startCooldown(seconds);
            setError(result.error ?? "Too many sign-in attempts. Please wait before trying again.");
            return;
          }
          if (!response.ok || !result.ok || !result.redirectTo) {
            setError(result.error ?? "We couldn’t complete sign-in. Please check your details and try again.");
            return;
          }
          window.location.assign(result.redirectTo);
        } catch {
          setError("We couldn’t reach the sign-in service. Check your connection and try again shortly.");
        }
      })}
    >
      {error && <p role="alert" aria-live="polite" className="rounded-xl bg-red/10 px-4 py-3 text-sm font-medium text-destructive">{error}{cooldownSeconds > 0 && <> Try again in {formatCooldown(cooldownSeconds)}.</>}</p>}
      <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="username" autoFocus aria-invalid={!!formState.errors.email} {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={formState.errors.password?.message}>
        <div className="relative">
          <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" aria-invalid={!!formState.errors.password} className="pr-11" {...register("password")} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-controls="password"
            aria-pressed={showPassword}
            onClick={() => setShowPassword((visible) => !visible)}
          >
            {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button>
        </div>
      </Field>
      <div className="-mt-2 flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-primary underline-offset-4 hover:underline">Forgot password?</Link>
      </div>
      <Button type="submit" size="lg" className="mt-2 w-full" disabled={formState.isSubmitting || cooldownSeconds > 0}>{formState.isSubmitting ? "Signing in…" : cooldownSeconds > 0 ? `Try again in ${formatCooldown(cooldownSeconds)}` : "Sign in"}</Button>
    </form>
  );
}
