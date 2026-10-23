"use client";
import type { ProductStatus } from "@/generated/prisma/client";
import { Ban, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteProductAction, setProductStatusAction } from "@/server/actions";

export function ProductAdminActions({ id, status, canUpdate = true, canDelete, compact = false }: { id: string; status: ProductStatus; canUpdate?: boolean; canDelete: boolean; compact?: boolean }) {
  return (
    <>
      {canUpdate && status === "ACTIVE" ? (
        <ConfirmDialog
          trigger={<Button variant="outline" size={compact ? "icon" : "default"} aria-label={compact ? "Deactivate product" : undefined} title={compact ? "Deactivate product" : undefined}><Ban />{!compact && " Deactivate"}</Button>}
          title="Deactivate this product?"
          description="It disappears from the sales terminal but keeps its history, stock and reports. You can reactivate it any time."
          confirmLabel="Deactivate"
          triggerLabel="Deactivate product"
          triggerAsChild
          successMessage="Product deactivated"
          onConfirm={() => setProductStatusAction(id, "INACTIVE")}
        />
      ) : canUpdate ? (
        <ConfirmDialog
          trigger={<Button variant="outline" size={compact ? "icon" : "default"} aria-label={compact ? "Reactivate product" : undefined} title={compact ? "Reactivate product" : undefined}><RotateCcw />{!compact && " Reactivate"}</Button>}
          title="Reactivate this product?"
          description="It becomes available at the sales terminal again."
          confirmLabel="Reactivate"
          triggerLabel="Reactivate product"
          triggerAsChild
          successMessage="Product reactivated"
          onConfirm={() => setProductStatusAction(id, "ACTIVE")}
        />
      ) : null}
      {canDelete && (
        <ConfirmDialog
          trigger={<Button variant="outline" size={compact ? "icon" : "default"} className="text-destructive" aria-label={compact ? "Delete product" : undefined} title={compact ? "Delete product" : undefined}><Trash2 />{!compact && " Delete"}</Button>}
          title="Delete this product?"
          description="Only products with no stock or sales history can be deleted. Otherwise deactivate it."
          confirmLabel="Delete product"
          triggerLabel="Delete product"
          triggerAsChild
          destructive
          successMessage="Product deleted"
          redirectTo="/products"
          onConfirm={() => deleteProductAction(id)}
        />
      )}
    </>
  );
}
