import { z } from "zod";
import { phoneField } from "./common";
import { ROLE } from "@/lib/constants/roles";

const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(72, "Passwords are limited to 72 characters")
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/\d/, "Add a number");

export const employeeCreateSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: phoneField,
  role: z.enum([ROLE.ADMIN, ROLE.EMPLOYEE]),
  password,
});
export type EmployeeCreateValues = z.infer<typeof employeeCreateSchema>;

export const employeeUpdateSchema = employeeCreateSchema.omit({ password: true }).extend({ id: z.string().min(1) });
export type EmployeeUpdateValues = z.infer<typeof employeeUpdateSchema>;

export const passwordResetSchema = z.object({ id: z.string().min(1), password });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter your email address"),
  password: z.string().min(1, "Enter your password").max(200),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address") });
export const resetPasswordSchema = z.object({ token: z.string().min(32), password, confirmPassword: z.string() }).refine((values) => values.password === values.confirmPassword, {
  path: ["confirmPassword"],
  message: "Passwords do not match",
});
