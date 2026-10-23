import { z } from "zod";

export const settingsSchema = z.object({
  shopName: z.string().trim().min(2, "Shop name is required").max(80),
  address: z.string().trim().max(200),
  city: z.string().trim().max(80),
  phone: z.string().trim().max(30),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")),
  currency: z.string().trim().min(3).max(3, "Use a 3-letter code such as NPR").toUpperCase(),
  taxRate: z.number({ invalid_type_error: "Enter 0 for no tax" }).min(0).max(100),
  invoicePrefix: z.string().trim().min(1, "Invoice prefix is required").max(8).regex(/^[A-Za-z0-9]+$/, "Letters and numbers only"),
  employeeDiscountLimit: z.number({ invalid_type_error: "Enter 0 for none" }).min(0).max(100),
  employeeMaxTotalDiscountPercent: z.number().min(0).max(100).nullable(),
});
export type SettingsValues = z.infer<typeof settingsSchema>;
