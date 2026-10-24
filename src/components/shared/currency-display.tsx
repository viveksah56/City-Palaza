import { formatCurrency, formatNPR, formatNPRCompact } from "@/lib/format";
import type { MoneyInput } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type CurrencyDisplayProps = {
  value: MoneyInput | null | undefined;
  currency?: string;
  className?: string;
  variant?: "full" | "compact" | "auto";
  showSign?: boolean;
};

export function CurrencyDisplay({ value, currency = "NPR", className, variant = "full", showSign = false }: CurrencyDisplayProps) {
  const raw = value === null || value === undefined ? Number.NaN : Number(value.toString());
  const displayVariant = variant === "auto" ? (Number.isFinite(raw) && Math.abs(raw) >= 100_000 ? "compact" : "full") : variant;
  const full = currency === "NPR" ? formatNPR(value) : formatCurrency(value, currency);
  const visible = displayVariant === "compact" && currency === "NPR" ? formatNPRCompact(value, { showSign }) : full;
  const content = <span aria-label={full} title={full} tabIndex={displayVariant === "compact" ? 0 : undefined} className={cn("num inline-block min-w-0 max-w-full truncate whitespace-nowrap align-bottom focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50", className)}>{visible}</span>;

  if (displayVariant !== "compact" || currency !== "NPR") return content;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>{full}</TooltipContent>
    </Tooltip>
  );
}

export const Money = CurrencyDisplay;
