"use client";
import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

const discountFormSchema = z
  .object({ type: z.enum(["PERCENT", "FIXED"]), value: z.number({ invalid_type_error: "Enter a number" }).min(0, "Cannot be negative") })
  .refine((v) => v.type !== "PERCENT" || v.value <= 100, { message: "Cannot exceed 100%", path: ["value"] });
type DiscountForm = z.infer<typeof discountFormSchema>;
export type SaleDiscount = { type: "PERCENT" | "FIXED"; value: number } | null;

/** Sale-wide discount. Emits `null` until a valid positive value is typed. Limit warnings come from the terminal. */
export function DiscountManager({ currency, isAdmin, limitPercent, warnings, onChange }: { currency: string; isAdmin: boolean; limitPercent: number; warnings: string[]; onChange: (discount: SaleDiscount) => void }) {
  const { register, control, formState: { errors } } = useForm<DiscountForm>({ resolver: zodResolver(discountFormSchema), mode: "onChange", defaultValues: { type: "PERCENT", value: 0 } });
  const [type, value] = useWatch({ control, name: ["type", "value"] });
  React.useEffect(() => {
    const parsed = discountFormSchema.safeParse({ type, value });
    onChange(parsed.success && parsed.data.value > 0 ? parsed.data : null);
  }, [type, value, onChange]);

  return (
    <div className="grid gap-1.5">
      <label htmlFor="sale-discount" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Discount {!isAdmin && <span className="font-normal normal-case">(up to {limitPercent}%)</span>}
      </label>
      <div className="flex gap-2">
        <Input id="sale-discount" type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" aria-invalid={!!errors.value || warnings.length > 0} className="h-9" {...register("value", { setValueAs: (v: string) => (v === "" || v === undefined ? 0 : Number(v)) })} />
        <div className="w-24 shrink-0"><NativeSelect aria-label="Discount type" {...register("type")}><option value="PERCENT">%</option><option value="FIXED">{currency}</option></NativeSelect></div>
      </div>
      {errors.value?.message && <p role="alert" className="text-xs font-medium text-destructive">{errors.value.message}</p>}
      {warnings.map((w) => <p key={w} role="alert" className="text-xs font-medium text-destructive">{w}</p>)}
    </div>
  );
}
