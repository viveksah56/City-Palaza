"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/ui/field";
import { productSchema, type ProductFormInput, type ProductFormValues } from "@/validations/product";
import { createProductAction, updateProductAction } from "@/server/actions";
import { PRODUCT_CATEGORY_SELECTION } from "@/lib/constants/categories";

type Option = { id: string; name: string };

export function ProductForm({
  mode, productId, categories, brands, defaults, onCancel,
}: {
  mode: "create" | "edit";
  productId?: string;
  categories: Option[];
  brands: Option[];
  defaults?: Partial<ProductFormValues>;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: "", barcode: "", name: "", variantLabel: "", description: "", categoryId: "", customCategory: "", brandId: "",
      purchasePrice: 0, sellingPrice: 0, discountPercent: 0, minStock: 5, maxStock: NaN,
      trackingType: "QUANTITY", status: "ACTIVE", initialQuantity: 0, initialSerials: "",
      ...defaults,
    },
  });
  const tracking = watch("trackingType");
  const categoryId = watch("categoryId");
  const num = { valueAsNumber: true } as const;

  return (
    <form
      noValidate
      className="grid gap-6"
      onSubmit={handleSubmit(async (values) => {
        const res = mode === "create" ? await createProductAction(values) : await updateProductAction(productId!, values);
        if (!res.ok) return void toast.error(res.error);
        toast.success(mode === "create" ? "Product added" : "Changes saved");
        router.push(mode === "create" ? `/products/${(res.data as { slug: string }).slug}` : "/products");
        router.refresh();
      })}
    >
      <Card>
        <CardHeader><CardTitle>Details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name" htmlFor="name" required error={errors.name?.message} className="sm:col-span-2">
            <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field label="Variant" htmlFor="variantLabel" hint="Optional, e.g. Black · 256 GB. Give each variant its own SKU and stock.">
            <Input id="variantLabel" placeholder="Black · 256 GB" aria-invalid={!!errors.variantLabel} {...register("variantLabel")} />
          </Field>
          <Field label="SKU" htmlFor="sku" error={errors.sku?.message} hint={mode === "create" ? "Optional. Leave blank to generate one automatically." : "Optional. Leave blank to keep the current SKU."}>
            <Input id="sku" className="font-mono" aria-invalid={!!errors.sku} {...register("sku")} />
          </Field>
          <Field label="Barcode" htmlFor="barcode" error={errors.barcode?.message} hint="Optional, must be unique if set.">
            <Input id="barcode" className="font-mono" {...register("barcode")} />
          </Field>
          <Field label="Category" htmlFor="categoryId" required error={errors.categoryId?.message}>
            <NativeSelect id="categoryId" aria-invalid={!!errors.categoryId} {...register("categoryId")}>
              <option value="">Choose a category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value={PRODUCT_CATEGORY_SELECTION.CUSTOM}>Other…</option>
            </NativeSelect>
          </Field>
          {categoryId === PRODUCT_CATEGORY_SELECTION.CUSTOM && (
            <Field label="New category" htmlFor="customCategory" required error={errors.customCategory?.message} hint="This category will be available for other products too.">
              <Input id="customCategory" aria-invalid={!!errors.customCategory} {...register("customCategory")} />
            </Field>
          )}
          <Field label="Brand" htmlFor="brandId">
            <NativeSelect id="brandId" {...register("brandId")}>
              <option value="">No brand</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="Description" htmlFor="description" className="sm:col-span-2" error={errors.description?.message}>
            <Textarea id="description" rows={3} {...register("description")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pricing</CardTitle><CardDescription>Only admins can see or change purchase prices. Past sales keep the prices they were sold at.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Purchase price" htmlFor="purchasePrice" required error={errors.purchasePrice?.message}>
            <Input id="purchasePrice" type="number" step="0.01" min="0" inputMode="decimal" aria-invalid={!!errors.purchasePrice} {...register("purchasePrice", num)} />
          </Field>
          <Field label="Selling price" htmlFor="sellingPrice" required error={errors.sellingPrice?.message}>
            <Input id="sellingPrice" type="number" step="0.01" min="0" inputMode="decimal" aria-invalid={!!errors.sellingPrice} {...register("sellingPrice", num)} />
          </Field>
          <Field label="Standing discount (%)" htmlFor="discountPercent" error={errors.discountPercent?.message} hint="Applied automatically at the counter.">
            <Input id="discountPercent" type="number" step="0.01" min="0" max="100" inputMode="decimal" {...register("discountPercent", num)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Stock rules</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="How is it tracked?" htmlFor="trackingType" hint="Phones: IMEI. Items with serials: Serial number. Cables, cases: Quantity.">
            <NativeSelect id="trackingType" {...register("trackingType")}>
              <option value="QUANTITY">Quantity only</option>
              <option value="IMEI">IMEI (each phone)</option>
              <option value="SERIALIZED">Serial number</option>
            </NativeSelect>
          </Field>
          <Field label="Minimum stock" htmlFor="minStock" required error={errors.minStock?.message} hint="Low-stock alert at or below this.">
            <Input id="minStock" type="number" min="0" {...register("minStock", num)} />
          </Field>
          <Field label="Maximum stock" htmlFor="maxStock" error={errors.maxStock?.message}>
            <Input id="maxStock" type="number" min="0" {...register("maxStock", num)} />
          </Field>
          <Field label="Status" htmlFor="status">
            <NativeSelect id="status" {...register("status")}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="DISCONTINUED">Discontinued</option>
            </NativeSelect>
          </Field>
        </CardContent>
      </Card>

      {mode === "create" && (
        <Card>
          <CardHeader><CardTitle>Opening stock</CardTitle><CardDescription>Optional. Recorded as an “Initial stock” inventory entry.</CardDescription></CardHeader>
          <CardContent>
            {tracking === "QUANTITY" ? (
              <Field label="Units on hand" htmlFor="initialQuantity" error={errors.initialQuantity?.message} className="max-w-xs">
                <Input id="initialQuantity" type="number" min="0" {...register("initialQuantity", num)} />
              </Field>
            ) : (
              <Field label={tracking === "IMEI" ? "IMEI numbers" : "Serial numbers"} htmlFor="initialSerials" hint="One per line, or separated by commas. Each must be unique." error={errors.initialSerials?.message}>
                <Textarea id="initialSerials" rows={5} className="font-mono" {...register("initialSerials")} />
              </Field>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel ?? (() => router.back())}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : mode === "create" ? "Add product" : "Save changes"}</Button>
      </div>
    </form>
  );
}
