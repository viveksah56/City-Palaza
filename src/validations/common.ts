import { z } from "zod";

/** Money entered as a number with at most 2 decimals. Server converts via decimal.js. */
export const moneyField = (label = "Amount") =>
  z
    .number({ invalid_type_error: `${label} is required`, required_error: `${label} is required` })
    .min(0, `${label} cannot be negative`)
    .max(99_999_999, `${label} is too large`)
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, `${label} can have at most 2 decimals`);

export const intField = (label: string, min = 0, max = 1_000_000) =>
  z
    .number({ invalid_type_error: `${label} is required`, required_error: `${label} is required` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} is too large`);

export const optionalText = (max = 500) => z.string().trim().max(max).optional();

export const phoneField = z
  .string()
  .trim()
  .max(20)
  .regex(/^[+\d][\d\s-]{5,19}$/, "Enter a valid phone number")
  .optional()
  .or(z.literal(""));

export const emptyToNull = (v: string | undefined | null): string | null => {
  const t = v?.trim();
  return t ? t : null;
};
