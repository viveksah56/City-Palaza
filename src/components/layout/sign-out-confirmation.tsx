"use client";

import * as React from "react";
import { LoaderCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function SignOutConfirmation({ action }: { action: () => Promise<void | { ok: false }> }) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function confirmSignOut() {
    setError(false);
    startTransition(async () => {
      try {
        const result = await action();
        if (result && "ok" in result && result.ok === false) {
          setError(true);
          return;
        }
        setOpen(false);
      } catch {
        setError(true);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => {
      if (!pending) {
        setOpen(nextOpen);
        if (nextOpen) setError(false);
      }
    }}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2 px-2.5 sm:px-3"
        aria-label="Sign out"
        onClick={() => setOpen(true)}
      >
        <LogOut aria-hidden />
        <span className="hidden sm:inline">Sign out</span>
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out of CityPlaza?</AlertDialogTitle>
          <AlertDialogDescription>
            This will end your current session on this device. You’ll need to sign in again to continue.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">We couldn’t end your session. Please try again.</p>}
        <AlertDialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={confirmSignOut}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
            {pending ? "Signing out…" : "Sign out"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
