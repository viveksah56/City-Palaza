"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { resetPasswordSchema } from "@/validations/employee";
import { formatCooldown, useCooldown } from "@/hooks/use-cooldown";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [complete, setComplete] = React.useState(false);
  const { seconds: cooldownSeconds, start: startCooldown } = useCooldown();

  return (
    <form noValidate className="grid gap-4" onSubmit={async (event) => {
      event.preventDefault();
      setError(null);
      const parsed = resetPasswordSchema.safeParse({ token, password, confirmPassword });
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check your password and try again.");
      setBusy(true);
      try {
        const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
        const result = await response.json() as { ok?: boolean; error?: string; retryAfterSeconds?: number };
        if (response.status === 429) {
          startCooldown(response.headers.get("Retry-After") ?? result.retryAfterSeconds ?? 300);
          return setError(result.error ?? "Too many password reset attempts. Please wait before trying again.");
        }
        if (!response.ok || !result.ok) return setError(result.error ?? "We couldn’t update your password. Please try again shortly.");
        setComplete(true);
        router.replace("/login");
        router.refresh();
      } catch {
        setError("We couldn’t reach the password reset service. Please try again shortly.");
      } finally {
        setBusy(false);
      }
    }}>
      {complete ? <p role="status" className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm leading-6 text-muted-foreground">Your password was updated. Sign in with your new password.</p> : <>
        {error && <p role="alert" aria-live="polite" className="text-sm text-destructive">{error}{cooldownSeconds > 0 && <> Try again in {formatCooldown(cooldownSeconds)}.</>}</p>}
        <Field label="New password" htmlFor="new-password"><Input id="new-password" type="password" autoComplete="new-password" required minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} /></Field>
        <Field label="Confirm new password" htmlFor="confirm-password"><Input id="confirm-password" type="password" autoComplete="new-password" required minLength={10} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></Field>
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={busy || !token || cooldownSeconds > 0}>{busy ? "Updating…" : cooldownSeconds > 0 ? `Try again in ${formatCooldown(cooldownSeconds)}` : "Update password"}</Button>
      </>}
    </form>
  );
}
