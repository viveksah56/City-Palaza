"use client";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Banknote, CreditCard, Landmark, Smartphone, Wallet, Ellipsis } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

const PAYMENT_METHOD_ICONS = {
  CASH: Banknote,
  CARD: CreditCard,
  BANK_TRANSFER: Landmark,
  ESEWA: Smartphone,
  KHALTI: Wallet,
  OTHER: Ellipsis,
} satisfies Record<PaymentMethodValue, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>>;

export function PaymentMethodSelector({ value, onChange }: { value: PaymentMethodValue; onChange: (v: PaymentMethodValue) => void }) {
  return (
    <div role="group" aria-label="Payment method" className="flex flex-wrap gap-2">
      {PAYMENT_METHODS.map((method) => {
        const Icon = PAYMENT_METHOD_ICONS[method];
        const selected = value === method;
        return (
          <Tooltip key={method}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={PAYMENT_METHOD_LABELS[method]}
                aria-pressed={selected}
                title={PAYMENT_METHOD_LABELS[method]}
                onClick={() => onChange(method)}
                className={cn("inline-flex size-10 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground")}
              >
                <Icon className="size-4" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent>{PAYMENT_METHOD_LABELS[method]}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
