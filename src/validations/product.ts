import { z } from "zod";
import { intField, moneyField, optionalText } from "./common";
import { PRODUCT_CATEGORY_SELECTION } from "@/lib/constants/categories";

export const productSchema = z
  .object({
    sku: z.string().trim().max(40).regex(/^[A-Za-z0-9._-]*$/, "Use letters, numbers, dot, dash or underscore").optional().default(""),
    barcode: z.string().trim().max(64).optional(),
    name: z.string().trim().min(2, "Name is required").max(160),
    variantLabel: z.string().trim().max(100).optional(),
    description: optionalText(1000),
    categoryId: z.string().min(1, "Choose a category"),
    customCategory: z.string().trim().max(60, "Category name must be 60 characters or less").optional().default(""),
    brandId: z.string().optional(),
    purchasePrice: moneyField("Purchase price"),
    sellingPrice: moneyField("Selling price"),
    discountPercent: z.number({ invalid_type_error: "Enter 0 if none" }).min(0).max(100),
    minStock: intField("Minimum stock"),
    maxStock: z.number().int().min(0).optional().or(z.nan()),
    trackingType: z.enum(["QUANTITY", "SERIALIZED", "IMEI"]),
    status: z.enum(["ACTIVE", "INACTIVE", "DISCONTINUED"]),
    // only used on create
    initialQuantity: z.number().int().min(0).optional().or(z.nan()),
    initialSerials: z.string().optional(),
  })
  .refine((v) => v.sellingPrice >= 0 && v.purchasePrice >= 0, { message: "Prices must be positive", path: ["sellingPrice"] })
  .refine((v) => v.categoryId !== PRODUCT_CATEGORY_SELECTION.CUSTOM || v.customCategory.trim().length >= 2, {
    message: "Enter a category name with at least 2 characters",
    path: ["customCategory"],
  });

export type ProductFormValues = z.infer<typeof productSchema>;
export type ProductFormInput = z.input<typeof productSchema>;

export const categoryBrandSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Name is required").max(60),
  description: optionalText(300),
  isActive: z.boolean(),
});
export type CategoryBrandValues = z.infer<typeof categoryBrandSchema>;
