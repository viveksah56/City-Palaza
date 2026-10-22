"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowDownUp, ArrowUp, ChevronLeft, ChevronRight, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { ActionResult } from "@/lib/errors";

function SelectionCheckbox({ checked, indeterminate, label, onChange, disabled }: { checked: boolean; indeterminate?: boolean; label: string; onChange: (checked: boolean) => void; disabled?: boolean }) {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate]);

  return <input ref={ref} type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={(event) => onChange(event.currentTarget.checked)} className="size-4 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50" />;
}

export function DataTable<T>({ data, columns, getRowId, getRowLabel = getRowId, searchPlaceholder, enableRowSelection = false, onBulkDelete, bulkDeleteLabel = "Delete selected", bulkDeleteSuccessMessage = "Selected records deleted.", bulkDeleteDescription }: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  getRowId: (row: T) => string;
  searchPlaceholder: string;
  enableRowSelection?: boolean;
  onBulkDelete?: (ids: string[]) => Promise<ActionResult<unknown>>;
  bulkDeleteLabel?: string;
  bulkDeleteSuccessMessage?: string;
  bulkDeleteDescription?: string;
  getRowLabel?: (row: T) => string;
}) {
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { globalFilter, sorting, rowSelection },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const selectedIds = table.getSelectedRowModel().rows.map((row) => row.id);
  const currentPageRows = table.getRowModel().rows;

  const deleteSelected = () => {
    if (!onBulkDelete || selectedIds.length === 0) return;
    startTransition(async () => {
      const result = await onBulkDelete(selectedIds);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(bulkDeleteSuccessMessage);
      setRowSelection({});
      setConfirmOpen(false);
    });
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative w-full sm:max-w-sm">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={globalFilter} onChange={(event) => { setGlobalFilter(event.target.value); table.setPageIndex(0); }} placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="pl-9" />
        </label>
        <p className="text-sm text-muted-foreground" aria-live="polite">{table.getFilteredRowModel().rows.length} {table.getFilteredRowModel().rows.length === 1 ? "record" : "records"}</p>
      </div>

      {selectedIds.length > 0 && onBulkDelete && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/35 px-4 py-2.5">
          <p className="text-sm font-medium" aria-live="polite">{selectedIds.length} selected</p>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setRowSelection({})}>Clear selection</Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => setConfirmOpen(true)}><Trash2 data-icon="inline-start" />{bulkDeleteLabel} ({selectedIds.length})</Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {enableRowSelection && <TableHead className="w-10"><SelectionCheckbox label="Select all rows on this page" checked={table.getIsAllPageRowsSelected()} indeterminate={table.getIsSomePageRowsSelected()} onChange={(checked) => table.toggleAllPageRowsSelected(checked)} /></TableHead>}
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className={header.column.id === "actions" ? "text-right" : undefined}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button type="button" onClick={header.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 rounded-sm text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" ? <ArrowUp aria-hidden="true" /> : header.column.getIsSorted() === "desc" ? <ArrowDown aria-hidden="true" /> : <ArrowDownUp aria-hidden="true" />}
                      </button>
                    ) : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {currentPageRows.length ? currentPageRows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                {enableRowSelection && <TableCell className="w-10"><SelectionCheckbox label={`Select ${getRowLabel(row.original)}`} checked={row.getIsSelected()} onChange={(checked) => row.toggleSelected(checked)} /></TableCell>}
                {row.getVisibleCells().map((cell) => <TableCell key={cell.id} className={cell.column.id === "actions" ? "text-right" : undefined}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={columns.length + Number(enableRowSelection)} className="h-28 text-center text-sm text-muted-foreground">No matching records.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">{table.getFilteredRowModel().rows.length === 0 ? "0 records" : `${table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–${Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} of ${table.getFilteredRowModel().rows.length}`}</p>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <label className="flex items-center gap-2 text-muted-foreground">Rows <select className="h-8 rounded-md border border-input bg-background px-2 text-foreground" value={table.getState().pagination.pageSize} onChange={(event) => table.setPageSize(Number(event.target.value))} aria-label="Rows per page"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select></label>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" aria-label="Previous page" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}><ChevronLeft /></Button>
            <span className="min-w-14 text-center tabular-nums">{table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)}</span>
            <Button type="button" variant="ghost" size="icon" aria-label="Next page" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}><ChevronRight /></Button>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bulkDeleteLabel}?</AlertDialogTitle>
            <AlertDialogDescription>{bulkDeleteDescription ?? `This will permanently delete ${selectedIds.length} selected records. Records used by products cannot be deleted.`}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={pending} onClick={deleteSelected}>{pending ? "Deleting…" : `${bulkDeleteLabel} (${selectedIds.length})`}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
