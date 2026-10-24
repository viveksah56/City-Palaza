import { productSchema } from "@/validations/product";

// Keep the client form and the server mutation on the same validation contract.
export const productFormSchema = productSchema;
export type ProductFormSchema = typeof productFormSchema;
export type ProductFormValues = import("@/validations/product").ProductFormValues;
export type ProductFormInput = import("@/validations/product").ProductFormInput;

export type ProductFormProduct = Partial<ProductFormValues> & {
  id?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};
