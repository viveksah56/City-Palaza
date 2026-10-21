import { z } from "zod";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/constants";

export const createSaleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(10_000),
        serials: z.array(z.string().max(60)).max(500).optional(),
      }),
    )
    .min(1, "Add at least one product")
    .max(100),
  customerId: z.string().nullish(),
  newCustomer: z
    .object({
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().max(20).nullish(),
      email: z.string().trim().email().max(120).nullish().or(z.literal("")),
      address: z.string().trim().max(250).nullish(),
    })
    .nullish(),
  discount: z.object({ type: z.enum(["PERCENT", "FIXED"]), value: z.number().min(0).max(99_999_999) }).nullish(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentStatus: z.enum(PAYMENT_STATUSES).default("PAID"),
  amountPaid: z.number().min(0).nullish(),
  notes: z.string().trim().max(500).nullish(),
});
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const voidSaleSchema = z.object({
  saleId: z.string().min(1),
  reason: z.string().trim().min(5, "Please give a reason (at least 5 characters)").max(300),
});
export type VoidSaleValues = z.infer<typeof voidSaleSchema>;
