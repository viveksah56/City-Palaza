import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

/** Label + control + hint/error, wired for accessibility. */
export function Field({
  label, htmlFor, error, hint, required, className, children,
}: {
  label: string; htmlFor: string; error?: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span aria-hidden className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && !error && <p id={`${htmlFor}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
