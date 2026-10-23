import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

export function Field({
  label, htmlFor, error, hint, required, className, children,
}: {
  label: string; htmlFor: string; error?: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode;
}) {
  const hintId = `${htmlFor}-hint`;
  const errorId = `${htmlFor}-error`;
  const describedBy = [hint && !error ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  const control = React.isValidElement(children)
    ? (() => {
        const child = children as React.ReactElement<{ "aria-invalid"?: boolean; "aria-describedby"?: string }>;
        const childDescription = child.props["aria-describedby"];
        const controlDescription = [childDescription, describedBy].filter(Boolean).join(" ") || undefined;
        return React.cloneElement(child, {
          "aria-invalid": error ? true : child.props["aria-invalid"],
          "aria-describedby": controlDescription,
        });
      })()
    : children;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span aria-hidden="true" className="text-destructive">*</span>}
      </Label>
      {control}
      {hint && !error && <p id={hintId} className="mt-0.5 text-xs leading-5 text-muted-foreground">{hint}</p>}
      {error && <p id={errorId} role="alert" className="mt-0.5 text-xs leading-5 font-medium text-destructive">{error}</p>}
    </div>
  );
}
