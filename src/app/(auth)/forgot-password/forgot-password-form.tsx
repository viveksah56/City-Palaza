"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { forgotPasswordSchema } from "@/validations/employee";
import { requestPasswordResetAction } from "@/server/actions";

export function ForgotPasswordForm() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <form noValidate className="grid gap-4" onSubmit={async (event) => {
      event.preventDefault();
      setError(null);
      const parsed = forgotPasswordSchema.safeParse({ email });
      if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      setBusy(true);
      try {
        await requestPasswordResetAction(parsed.data);
        setSent(true);
      } finally {
        setBusy(false);
      }
    }}>
      {sent ? <p role="status" className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm leading-6 text-muted-foreground">If an active account matches that email, a password reset link will arrive shortly.</p> : <>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Field label="Work email" htmlFor="reset-email"><Input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        <Button type="submit" size="lg" className="mt-2 w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
      </>}
    </form>
  );
}
