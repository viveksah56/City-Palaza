import type { ProductRow } from "@/server/products.service";
import type { CartProduct } from "@/stores/cart-store";

export function displayName(p: Pick<ProductRow, "name" | "variantLabel">): string {
  return p.variantLabel ? `${p.name} · ${p.variantLabel}` : p.name;
}

export function toCartProduct(p: ProductRow): CartProduct {
  return {
    productId: p.id,
    slug: p.slug,
    name: displayName(p),
    sku: p.sku,
    unitPrice: p.sellingPrice,
    maxDiscountPercent: p.maxDiscountPercent,
    trackingType: p.trackingType,
    available: p.quantity,
  };
}
