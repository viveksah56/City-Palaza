import { z } from "zod";
import { phoneField } from "./common";

export const customerSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Name is required").max(120),
  phone: phoneField,
  email: z.string().trim().email("Enter a valid email").max(120).optional().or(z.literal("")),
  address: z.string().trim().max(250).optional(),
});
export type CustomerValues = z.infer<typeof customerSchema>;
