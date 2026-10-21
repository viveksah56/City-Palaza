import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-20 w-full rounded-xl border border-transparent bg-secondary/80 px-3.5 py-2.5 text-base transition-[background-color,box-shadow,border-color] duration-200 outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed disabled:opacity-50 sm:text-[15px]",
        "focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/15 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
