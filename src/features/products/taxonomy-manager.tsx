"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { StatusBadge } from "@/components/shared/badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/states";
import { IconButton } from "@/components/shared/icon-button";
import { categoryBrandSchema, type CategoryBrandValues } from "@/validations/product";
import { deleteTaxonomyAction, saveTaxonomyAction } from "@/server/actions";
import { TAXONOMY_KIND, type TaxonomyKind } from "@/lib/constants/categories";

type Item = { id: string; name: string; description: string | null; isActive: boolean };

export function TaxonomyManager({ kind, items, canCreate, canUpdate, canDelete }: { kind: TaxonomyKind; items: Item[]; canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const [editing, setEditing] = React.useState<Item | "new" | null>(null);
  const title = kind === TAXONOMY_KIND.CATEGORY ? "Categories" : "Brands";
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {canCreate && <Button size="sm" onClick={() => setEditing("new")}><Plus /> Add {kind}</Button>}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? <EmptyState title={`No ${title.toLowerCase()} yet`} description={`Add your first ${kind} to start organising products.`} /> : (
          <ul className="divide-y divide-border/60">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{i.name}</p>{i.description && <p className="truncate text-xs text-muted-foreground">{i.description}</p>}</div>
                <div className="flex items-center gap-1">
                  {!i.isActive && <StatusBadge status="INACTIVE" />}
                  {canUpdate && <IconButton label={`Edit ${i.name}`} variant="ghost" onClick={() => setEditing(i)}><Pencil /></IconButton>}
                  {canDelete && (
                    <ConfirmDialog
                      trigger={<Button size="icon" variant="ghost" aria-label={`Delete ${i.name}`} title={`Delete ${i.name}`}><Trash2 className="text-destructive" /></Button>}
                      triggerLabel="Delete"
                      title={`Delete “${i.name}”?`}
                      description={`This only works if no product uses it. Otherwise deactivate the ${kind} instead.`}
                      confirmLabel="Delete" destructive successMessage={kind === TAXONOMY_KIND.CATEGORY ? "Category deleted" : "Brand deleted"}
                      onConfirm={() => deleteTaxonomyAction(kind, i.id)}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {editing && <TaxonomyDialog kind={kind} item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function TaxonomyDialog({ kind, item, onClose }: { kind: TaxonomyKind; item: Item | null; onClose: () => void }) {
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
