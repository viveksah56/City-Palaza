"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ProductForm } from "./product-form";
import type { ProductFormValues } from "@/validations/product";

type Option = { id: string; name: string };

export function ProductModal({
  categories,
  brands,
  product,
  trigger,
  autoOpen = false,
}: {
  categories: Option[];
  brands: Option[];
  product?: { id: string; defaults: Partial<ProductFormValues> };
  trigger?: React.ReactNode;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(autoOpen);
  const mode = product ? "edit" : "create";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button><Plus aria-hidden /> Add product</Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader className="pr-8">
          <DialogTitle>{mode === "create" ? "Add product" : "Edit product"}</DialogTitle>
          <DialogDescription>
            {mode === "create" ? "Create a product variant and optionally record opening stock." : "Update product details, pricing and stock rules."}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ProductForm
            mode={mode}
            productId={product?.id}
            categories={categories}
            brands={brands}
            defaults={product?.defaults}
            onCancel={() => setOpen(false)}
            onSaved={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
