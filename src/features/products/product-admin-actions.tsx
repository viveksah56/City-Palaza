"use client";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteProductAction } from "@/server/actions";

export function ProductAdminActions({ id, canDelete, compact = false }: { id: string; canDelete: boolean; compact?: boolean }) {
  if (!canDelete) return null;
  return (
        <ConfirmDialog
          trigger={<Button variant="outline" size={compact ? "icon" : "default"} className="text-destructive" aria-label={compact ? "Delete product" : undefined} title={compact ? "Delete product" : undefined}><Trash2 />{!compact && " Delete"}</Button>}
          title="Delete this product?"
          description="This removes the product from the active catalogue. If it has stock or billing history, the record is retained for accurate inventory and receipt history."
          confirmLabel="Delete product"
          triggerLabel="Delete product"
          triggerAsChild
          destructive
          successMessage={(result) => {
            if (typeof result === "object" && result !== null && "archived" in result && result.archived === true) return "Product removed from the active catalogue; sales and stock history retained.";
            return "Product deleted.";
          }}
          redirectTo="/products"
          onConfirm={() => deleteProductAction(id)}
        />
  );
}
