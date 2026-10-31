import { z } from "zod";
import { moneyField } from "./common";

export const openShiftSchema = z.object({
  openingBalance: moneyField("Opening balance"),
  notes: z.string().trim().max(300).optional(),
});
export type OpenShiftValues = z.infer<typeof openShiftSchema>;
export type OpenShiftInput = z.input<typeof openShiftSchema>;

export const closeShiftSchema = z.object({
  shiftId: z.string().min(1),
  countedCash: moneyField("Counted cash"),
  notes: z.string().trim().max(300).optional(),
});
export type CloseShiftValues = z.infer<typeof closeShiftSchema>;
export type CloseShiftInput = z.input<typeof closeShiftSchema>;
