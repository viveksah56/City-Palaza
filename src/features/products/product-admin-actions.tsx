"use client";
import type { ProductStatus } from "@prisma/client";
import { Ban, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteProductAction, setProductStatusAction } from "@/server/actions";

export function ProductAdminActions({ id, status, canDelete }: { id: string; status: ProductStatus; canDelete: boolean }) {
  return (
    <>
      {status === "ACTIVE" ? (
        <ConfirmDialog
          trigger={<Button variant="outline"><Ban /> Deactivate</Button>}
          title="Deactivate this product?"
          description="It disappears from the sales terminal but keeps its history, stock and reports. You can reactivate it any time."
          confirmLabel="Deactivate"
          successMessage="Product deactivated"
          onConfirm={() => setProductStatusAction(id, "INACTIVE")}
        />
      ) : (
        <ConfirmDialog
          trigger={<Button variant="outline"><RotateCcw /> Reactivate</Button>}
          title="Reactivate this product?"
          description="It becomes available at the sales terminal again."
          confirmLabel="Reactivate"
          successMessage="Product reactivated"
          onConfirm={() => setProductStatusAction(id, "ACTIVE")}
        />
      )}
      {canDelete && (
        <ConfirmDialog
          trigger={<Button variant="outline" className="text-destructive"><Trash2 /> Delete</Button>}
          title="Delete this product?"
          description="Only products with no stock or sales history can be deleted. Otherwise deactivate it."
          confirmLabel="Delete product"
          destructive
          successMessage="Product deleted"
          redirectTo="/products"
          onConfirm={() => deleteProductAction(id)}
        />
      )}
    </>
  );
}
