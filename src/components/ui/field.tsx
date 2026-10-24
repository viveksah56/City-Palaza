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
        const child = children as React.ReactElement<{ "aria-invalid"?: boolean; "aria-required"?: boolean; "aria-describedby"?: string }>;
        const childDescription = child.props["aria-describedby"];
        const controlDescription = [childDescription, describedBy].filter(Boolean).join(" ") || undefined;
        return React.cloneElement(child, {
          "aria-invalid": error ? true : child.props["aria-invalid"],
          "aria-required": required || undefined,
          "aria-describedby": controlDescription,
        });
      })()
    : children;

  return (
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
      <div className="flex min-h-5 items-center">
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span aria-hidden="true" className="text-destructive"> *</span>}
        </Label>
      </div>
      {control}
      {(error || hint) && <div className="min-h-5">{error ? <p id={errorId} role="alert" className="text-xs leading-5 font-medium text-destructive">{error}</p> : <p id={hintId} className="text-xs leading-5 text-muted-foreground">{hint}</p>}</div>}
    </div>
  );
}
