"use client";
import * as React from "react";
import { toast } from "sonner";
import { KeyRound, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { resetEmployeePasswordAction, setEmployeeStatusAction } from "@/server/actions";

export function EmployeeStatusButton({ id, active, isSelf }: { id: string; active: boolean; isSelf: boolean }) {
  if (isSelf) return null;
  return active ? (
    <ConfirmDialog
      trigger={<Button variant="outline" className="text-destructive"><UserX /> Disable account</Button>}
      title="Disable this account?" description="They’re signed out immediately and can’t sign in. Their past sales stay on record; accounts are never deleted."
      confirmLabel="Disable" destructive successMessage="Account disabled" onConfirm={() => setEmployeeStatusAction(id, "INACTIVE")}
    />
  ) : (
    <ConfirmDialog
      trigger={<Button variant="outline"><UserCheck /> Reactivate</Button>}
      title="Reactivate this account?" description="They can sign in again with their current password."
      confirmLabel="Reactivate" successMessage="Account reactivated" onConfirm={() => setEmployeeStatusAction(id, "ACTIVE")}
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
