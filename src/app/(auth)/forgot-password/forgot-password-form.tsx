"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { forgotPasswordSchema } from "@/validations/employee";
import { formatCooldown, useCooldown } from "@/hooks/use-cooldown";

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { seconds: cooldownSeconds, start: startCooldown } = useCooldown();

  return (
    <form noValidate className="grid gap-4" onSubmit={async (event) => {
      event.preventDefault();
      setError(null);
      const parsed = forgotPasswordSchema.safeParse({ email });
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      setBusy(true);
      try {
        const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
        const result = await response.json() as { message?: string; error?: string; retryAfterSeconds?: number };
        if (response.status === 429) {
          startCooldown(response.headers.get("Retry-After") ?? result.retryAfterSeconds ?? 300);
          setError(result.error ?? "Too many requests. Please wait before trying again.");
        } else if (!response.ok) setError(result.error ?? "We couldn’t send a reset link right now. Please try again shortly.");
        else setSent(true);
      } catch {
        setError("We couldn’t reach the password reset service. Please try again shortly.");
      } finally {
        setBusy(false);
      }
    }}>
      {sent ? <p role="status" className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm leading-6 text-muted-foreground">If an active account matches that email, a password reset link will arrive shortly.</p> : <>
        {error && <p role="alert" aria-live="polite" className="text-sm text-destructive">{error}{cooldownSeconds > 0 && <> Try again in {formatCooldown(cooldownSeconds)}.</>}</p>}
        <Field label="Work email" htmlFor="reset-email"><Input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={busy || cooldownSeconds > 0}>{busy ? "Sending…" : cooldownSeconds > 0 ? `Try again in ${formatCooldown(cooldownSeconds)}` : "Send reset link"}</Button>
      </>}
    </form>
  );
}
