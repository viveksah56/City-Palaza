import type { Metadata } from "next";
import {PERMISSION} from "@/lib/rbac/permission";
import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/shared/page-header";
import { ProductForm } from "@/features/products/product-form";
import { getBrands, getCategories } from "@/server/products.service";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage() {
  await requirePermission(PERMISSION.PRODUCT_CREATE);
  const [categories, brands] = await Promise.all([getCategories(), getBrands()]);
  return (
    <>
      <PageHeader title="Add product" description="Create the product, then receive its opening stock in one step." />
      <ProductForm mode="create" categories={categories.filter((c) => c.isActive)} brands={brands.filter((b) => b.isActive)} />
    </>
  );
}
