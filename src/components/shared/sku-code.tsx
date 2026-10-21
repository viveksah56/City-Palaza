import { Barcode } from "lucide-react";
import { cn } from "@/lib/utils";

export function SkuCode({ value, className }: { value: string; className?: string }) {
  return (
    <span aria-label={`SKU ${value}`} className={cn("inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-secondary/60 px-2 py-1 text-xs text-foreground", className)}>
      <Barcode className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <code className="truncate font-mono font-medium tracking-[0.02em]">{value}</code>
    </span>
  );
}
