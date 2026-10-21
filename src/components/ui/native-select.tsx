import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** shadcn-styled native <select>: fully keyboard/mobile accessible and works with react-hook-form `register`. */
function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          "h-10 w-full appearance-none rounded-lg border border-input bg-card pr-9 pl-3 text-sm shadow-sm transition-[box-shadow,border-color] duration-150 outline-none disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 aria-invalid:border-destructive",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { NativeSelect };
