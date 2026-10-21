"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ProductForm } from "./product-form";

type Option = { id: string; name: string };

export function ProductCreateDialog({ categories, brands }: { categories: Option[]; brands: Option[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus aria-hidden /> Add product</Button></DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader className="pr-8">
          <DialogTitle>Add product</DialogTitle>
          <DialogDescription>Create a product variant and optionally record opening stock.</DialogDescription>
        </DialogHeader>
        <ProductForm mode="create" categories={categories} brands={brands} onCancel={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
