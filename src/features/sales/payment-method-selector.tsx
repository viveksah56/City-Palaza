"use client";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export function PaymentMethodSelector({ value, onChange }: { value: PaymentMethodValue; onChange: (v: PaymentMethodValue) => void }) {
  return (
    <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-3 gap-2">
      {PAYMENT_METHODS.map((m) => (
        <button
          key={m} type="button" role="radio" aria-checked={value === m} onClick={() => onChange(m)}
          className={cn("h-11 rounded-xl text-[13px] font-medium transition-all duration-200 active:scale-95 focus-visible:outline-none", value === m ? "bg-primary text-primary-foreground shadow-sm" : "bg-secondary/80 text-foreground hover:bg-secondary")}
        >
          {PAYMENT_METHOD_LABELS[m]}
        </button>
      ))}
    </div>
  );
}
