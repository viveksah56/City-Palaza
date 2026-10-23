"use client";
import * as React from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ActionResult } from "@/lib/errors";
import { useRouter } from "next/navigation";

/** Confirm-then-run wrapper for destructive or irreversible actions. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  successMessage,
  redirectTo,
  triggerLabel,
  triggerAsChild = true,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<ActionResult<unknown>>;
  successMessage: string | ((data: unknown) => string);
  redirectTo?: string;
  triggerLabel?: string;
  triggerAsChild?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const router = useRouter();
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {triggerLabel ? (
        <Tooltip>
          <TooltipTrigger asChild><AlertDialogTrigger asChild={triggerAsChild}>{trigger}</AlertDialogTrigger></TooltipTrigger>
          <TooltipContent>{triggerLabel}</TooltipContent>
        </Tooltip>
      ) : <AlertDialogTrigger asChild={triggerAsChild}>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  const res = await onConfirm();
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(typeof successMessage === "function" ? successMessage(res.data) : successMessage);
                  setOpen(false);
                  if (redirectTo) router.push(redirectTo);
                  router.refresh();
                } catch {
                  toast.error("The action could not be completed. Check your connection and try again.");
                }
              })
            }
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
