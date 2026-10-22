import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { IconButton } from "@/components/shared/icon-button";
import { StatusBadge } from "@/components/shared/badges";
import { Button } from "@/components/ui/button";
import { deleteTaxonomyAction } from "@/server/actions";
import { TAXONOMY_KIND } from "@/lib/constants/categories";
import type { TaxonomyItem } from "./taxonomy-types";

export function createCategoryColumns({ onEdit, canUpdate, canDelete }: { onEdit: (item: TaxonomyItem) => void; canUpdate: boolean; canDelete: boolean }): ColumnDef<TaxonomyItem>[] {
  return [
    { accessorKey: "name", header: "Category", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
    { accessorKey: "description", header: "Description", cell: ({ row }) => row.original.description || <span className="text-muted-foreground">—</span> },
    { accessorKey: "isActive", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.isActive ? "ACTIVE" : "INACTIVE"} /> },
    {
      id: "actions",
      enableGlobalFilter: false,
      enableSorting: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {canUpdate && <IconButton label={`Edit ${row.original.name}`} variant="ghost" onClick={() => onEdit(row.original)}><Pencil /></IconButton>}
          {canDelete && <ConfirmDialog trigger={<Button size="icon" variant="ghost" aria-label={`Delete ${row.original.name}`}><Trash2 className="text-destructive" /></Button>} triggerLabel="Delete" title={`Delete “${row.original.name}”?`} description="This category can only be deleted when no products use it." confirmLabel="Delete" destructive successMessage="Category deleted" onConfirm={() => deleteTaxonomyAction(TAXONOMY_KIND.CATEGORY, row.original.id)} />}
        </div>
      ),
    },
  ];
}
