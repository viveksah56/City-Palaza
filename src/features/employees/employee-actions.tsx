"use client";
import * as React from "react";
import { toast } from "sonner";
import { KeyRound, Trash2, UserCheck, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteEmployeeAction, resetEmployeePasswordAction, setEmployeeStatusAction } from "@/server/actions";

export function EmployeeStatusButton({ id, status, isSelf }: { id: string; status: "ACTIVE" | "INACTIVE" | "SUSPENDED"; isSelf: boolean }) {
  if (isSelf) return null;
  return status === "ACTIVE" ? (
    <ConfirmDialog
      trigger={<Button variant="outline" className="text-destructive"><UserRoundX /> Suspend account</Button>}
      title="Suspend this account?" description="They’ll be signed out immediately and won’t be able to sign in until access is restored. Their sales history stays on record."
      confirmLabel="Suspend" destructive successMessage="Account suspended" onConfirm={() => setEmployeeStatusAction(id, "SUSPENDED")}
    />
  ) : (
    <ConfirmDialog
      trigger={<Button variant="outline"><UserCheck /> Reactivate</Button>}
      title="Reactivate this account?" description="They can sign in again with their current password."
      confirmLabel="Reactivate" successMessage="Account reactivated" onConfirm={() => setEmployeeStatusAction(id, "ACTIVE")}
    />
  );
}

export function DeleteEmployeeButton({ id, isSelf }: { id: string; isSelf: boolean }) {
  if (isSelf) return null;
  return (
    <ConfirmDialog
      trigger={<Button variant="destructive"><Trash2 /> Delete account</Button>}
      title="Delete this account?"
      description="This removes sign-in access and anonymizes the profile. Historical sales and audit records are retained for accurate store records. This action can’t be undone."
      confirmLabel="Delete account"
      destructive
      successMessage="Account deleted and anonymized"
      redirectTo="/employees"
      onConfirm={() => deleteEmployeeAction(id)}
    />
  );
}

export function ResetPasswordDialog({ id }: { id: string }) {
  const [open, setOpen] = React.useState(false);
  const [pw, setPw] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [pending, start] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><KeyRound /> Reset password</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Reset password</DialogTitle><DialogDescription>Set a new temporary password. They’re signed out of all devices.</DialogDescription></DialogHeader>
        <Field label="New password" htmlFor="new-pw" error={error} hint="At least 10 characters with upper case, lower case and a number."><Input id="new-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={pending} onClick={() => start(async () => {
            const res = await resetEmployeePasswordAction({ id, password: pw });
            if (!res.ok) return setError(res.fieldErrors?.password?.[0] ?? res.error);
            toast.success("Password reset"); setOpen(false); setPw(""); setError(undefined);
          })}>{pending ? "Saving…" : "Reset password"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
