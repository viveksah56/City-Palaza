import { z } from "zod";
import { PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/constants";
import { moneyField } from "./common";

const discountSchema = z.object({ type: z.enum(["PERCENT", "FIXED"]), value: moneyField("Discount") });

export const createSaleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(10_000),
        serials: z.array(z.string().max(60)).max(500).optional(),
        discount: discountSchema.nullish(),
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
  discount: discountSchema.nullish(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  paymentStatus: z.enum(PAYMENT_STATUSES).default("PAID"),
  amountPaid: z.number().min(0).nullish(),
  notes: z.string().trim().max(500).nullish(),
  idempotencyKey: z.string().uuid().optional(),
});
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const voidSaleSchema = z.object({
  saleId: z.string().min(1),
  reason: z.string().trim().min(5, "Please give a reason (at least 5 characters)").max(300),
});
export type VoidSaleValues = z.infer<typeof voidSaleSchema>;

export const settleSalePaymentSchema = z.object({
  saleId: z.string().min(1),
  amount: moneyField("Payment").refine((amount) => Number(amount) > 0, "Payment must be greater than zero"),
  method: z.enum(PAYMENT_METHODS),
  note: z.string().trim().max(300).nullish(),
});
export type SettleSalePaymentInput = z.infer<typeof settleSalePaymentSchema>;
