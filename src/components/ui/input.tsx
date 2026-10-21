import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-1 text-sm shadow-sm transition-[box-shadow,border-color] duration-150 outline-none placeholder:text-muted-foreground/80 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 aria-invalid:border-destructive aria-invalid:ring-destructive/15",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
