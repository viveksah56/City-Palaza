"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { categoryBrandSchema, type CategoryBrandValues } from "@/validations/product";
import { deleteTaxonomiesAction, saveTaxonomyAction } from "@/server/actions";
import { TAXONOMY_KIND, type TaxonomyKind } from "@/lib/constants/categories";
import { DataTable } from "@/components/data-table";
import type { TaxonomyItem } from "./taxonomy-types";
import { createCategoryColumns } from "./category-columns";
import { createBrandColumns } from "./brand-columns";

export function TaxonomyManager({ kind, items, canCreate, canUpdate, canDelete }: { kind: TaxonomyKind; items: TaxonomyItem[]; canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const [editing, setEditing] = React.useState<TaxonomyItem | "new" | null>(null);
  const router = useRouter();
  const title = kind === TAXONOMY_KIND.CATEGORY ? "Categories" : "Brands";
  const columns = React.useMemo(() => {
    const options = { onEdit: (item: TaxonomyItem) => setEditing(item), canUpdate, canDelete };
    return kind === TAXONOMY_KIND.CATEGORY ? createCategoryColumns(options) : createBrandColumns(options);
  }, [kind, canDelete, canUpdate]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-base font-semibold">{title}</h2>
        {canCreate && <Button size="sm" onClick={() => setEditing("new")}><Plus data-icon="inline-start" /> Add {kind}</Button>}
      </div>
        <DataTable
          data={items}
          columns={columns}
          getRowId={(item) => item.id}
          getRowLabel={(item) => item.name}
          searchPlaceholder={`Search ${title.toLowerCase()}`}
          enableRowSelection={canDelete}
          onBulkDelete={canDelete ? async (ids) => {
            const result = await deleteTaxonomiesAction(kind, ids);
            if (result.ok) router.refresh();
            return result;
          } : undefined}
          bulkDeleteLabel="Delete selected"
          bulkDeleteSuccessMessage={`${title} deleted.`}
          bulkDeleteDescription={`Delete the selected ${title.toLowerCase()}? Any item used by a product will prevent the entire operation.`}
        />
      {editing && <TaxonomyDialog kind={kind} item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function TaxonomyDialog({ kind, item, onClose }: { kind: TaxonomyKind; item: TaxonomyItem | null; onClose: () => void }) {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CategoryBrandValues>({
    resolver: zodResolver(categoryBrandSchema),
    defaultValues: { id: item?.id, name: item?.name ?? "", description: item?.description ?? "", isActive: item?.isActive ?? true },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? `Edit ${kind}` : `Add ${kind}`}</DialogTitle><DialogDescription>Shown in product forms, filters and reports.</DialogDescription></DialogHeader>
        <form
          noValidate className="grid gap-4"
          onSubmit={handleSubmit(async (v) => {
            const res = await saveTaxonomyAction(kind, v);
            if (!res.ok) return void toast.error(res.error);
            toast.success("Saved");
            onClose();
            router.refresh();
          })}
        >
          <Field label="Name" htmlFor="tx-name" required error={errors.name?.message}><Input id="tx-name" autoFocus {...register("name")} /></Field>
          <Field label="Description" htmlFor="tx-desc" error={errors.description?.message}><Input id="tx-desc" {...register("description")} /></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--primary)]" {...register("isActive")} /> Active (shown in product forms)</label>
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
