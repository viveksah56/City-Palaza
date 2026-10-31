import { z } from "zod";
import { moneyField } from "./common";

export const addStockSchema = z.object({
  productId: z.string().min(1),
  type: z.literal("PURCHASE"),
  quantity: z.number().int().min(1, "Enter a quantity of at least 1").optional().or(z.nan()),
  serialsText: z.string().optional(),
  reference: z.string().trim().max(80).optional(),
  reason: z.string().trim().max(300).optional(),
  unitCost: moneyField("Unit cost").optional(),
});
export type AddStockValues = z.infer<typeof addStockSchema>;
export type AddStockInput = z.input<typeof addStockSchema>;

export const adjustStockSchema = z.object({
  productId: z.string().min(1),
  type: z.enum(["ADJUSTMENT", "DAMAGE", "LOST"]),
  quantity: z.number().int().min(1, "Enter a quantity of at least 1").optional().or(z.nan()),
  serialsText: z.string().optional(),
  reason: z.string().trim().min(3, "Tell us why (at least 3 characters)").max(300),
});
export type AdjustStockValues = z.infer<typeof adjustStockSchema>;

/**
 * Split pasted/scanned text into device entries. One device per line; a line holding "IMEI1/IMEI2"
 * (or "IMEI1 | IMEI2") is kept together as a dual-SIM pair. Lines without a separator may still list
 * several single-IMEI devices separated by commas, semicolons or spaces.
 */
export function splitSerials(text: string | undefined): string[] {
  const out: string[] = [];
  for (const line of (text ?? "").split(/\r?\n/)) {
    if (/[/|]/.test(line)) {
      const pair = line.replace(/\s+/g, "").trim();
      if (pair) out.push(pair);
      continue;
    }
    out.push(...line.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean));
  }
  return out;
}
