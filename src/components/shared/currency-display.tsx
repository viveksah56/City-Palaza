import { formatCurrency } from "@/lib/format";
import type { MoneyInput } from "@/lib/money";
import { cn } from "@/lib/utils";

export function CurrencyDisplay({ value, currency = "NPR", className }: { value: MoneyInput | null | undefined; currency?: string; className?: string }) {
  return <span className={cn("num whitespace-nowrap", className)}>{formatCurrency(value, currency)}</span>;
}
