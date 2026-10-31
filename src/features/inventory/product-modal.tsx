"use client";

import { ProductFormDialog } from "./product-form-dialog";
import type { ProductFormProduct } from "./product-form-schema";

type Option = { id: string; name: string };

export function ProductModal({ categories, brands, product, triggerLabel, triggerIconOnly = false, autoOpen = false, canSeeCost = true }: {
  categories: Option[];
  brands: Option[];
  product?: { id: string; defaults: ProductFormProduct };
  triggerLabel?: string;
  triggerIconOnly?: boolean;
  autoOpen?: boolean;
  canSeeCost?: boolean;
}) {
  return <ProductFormDialog
    mode={product ? "edit" : "add"}
    productId={product?.id}
    defaultValues={product?.defaults}
    categories={categories}
    brands={brands}
    triggerLabel={triggerLabel ?? (product ? `Edit ${product.defaults.name ?? "product"}` : "Add product")}
    triggerIconOnly={triggerIconOnly}
    autoOpen={autoOpen}
    canSeeCost={canSeeCost}
  />;
}
