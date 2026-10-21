import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { createTable, flexRender, getCoreRowModel, type ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { buildHref } from "@/lib/url";
import { cn } from "@/lib/utils";
import { EmptyState } from "./states";
import { SelectableTable } from "./selectable-table";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: "right";
  className?: string;
  /** DB field to sort by (renders a sortable header link) */
  sortKey?: string;
};

type UrlState = { basePath: string; params: Record<string, string | undefined> };

/**
 * Server-rendered and responsive:
 *  • md and up → a clean table with sortable header links
 *  • below md  → stacked cards (first column = title, text-header columns = label/value rows,
 *                columns with a non-text header such as “Actions” = footer).
 */
export function DataTable<T>({
  columns, rows, rowKey, url, sort, empty,
}: {
  columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; url?: UrlState; sort?: { key?: string; order?: "asc" | "desc" }; empty?: React.ReactNode;
}) {
  if (rows.length === 0) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  const [titleCol, ...rest] = columns;
  const detail = rest.filter((c) => typeof c.header === "string");
  const actions = rest.filter((c) => typeof c.header !== "string");
  const definitions: ColumnDef<T>[] = columns.map((column) => ({
    id: column.key,
    accessorFn: (row) => row,
    header: column.header as ColumnDef<T>["header"],
    cell: ({ row }) => column.cell(row.original),
  }));
  // Build the TanStack row/header model on the server so rich cell renderers remain RSC-safe.
  const table = createTable<T>({
    data: rows,
    columns: definitions,
    getCoreRowModel: getCoreRowModel(),
    state: {},
    onStateChange: () => undefined,
    renderFallbackValue: null,
  });
  table.setOptions((options) => ({ ...options, state: table.initialState }));
  const headers = table.getHeaderGroups().flatMap((group) => group.headers.map((header) => {
    const c = columns.find((column) => column.key === header.column.id)!;
    const active = sort?.key === c.sortKey;
    const Icon = !active ? ChevronsUpDown : sort?.order === "asc" ? ArrowUp : ArrowDown;
    const content = c.sortKey && url ? (
      <Link
        href={buildHref(url.basePath, url.params, { sort: c.sortKey, order: active && sort?.order === "asc" ? "desc" : "asc", page: undefined })}
        className={cn("-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors hover:text-foreground", active && "text-foreground")}
      >
        {flexRender(header.column.columnDef.header, header.getContext())}
        <Icon className={cn("size-3.5", !active && "opacity-40")} aria-hidden />
      </Link>
    ) : flexRender(header.column.columnDef.header, header.getContext());
    return { id: header.id, content, alignRight: c.align === "right", className: c.className };
  }));
  const displayRows = table.getRowModel().rows.map((row) => {
    const cells = row.getVisibleCells().map((cell) => {
      const content = flexRender(cell.column.columnDef.cell, cell.getContext());
      return React.isValidElement(content) ? React.cloneElement(content, { key: cell.id }) : content;
    });
    return {
      id: rowKey(row.original),
      title: titleCol!.cell(row.original),
      cells,
      details: detail.map((column) => ({ id: column.key, label: column.header as string, value: column.cell(row.original) })),
      actions: actions.map((column) => column.cell(row.original)),
    };
  });

  return <SelectableTable headers={headers} rows={displayRows} />;
}

export function Pagination({ page, totalPages, total, pageSize, url }: { page: number; totalPages: number; total: number; pageSize: number; url: UrlState }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const link = (p: number) => buildHref(url.basePath, url.params, { page: p === 1 ? undefined : String(p) });
  const pageNumbers = (windowSize: number) => {
    const start = Math.max(1, Math.min(page - Math.floor(windowSize / 2), totalPages - windowSize + 1));
    const end = Math.min(totalPages, start + windowSize - 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  };
  const renderPage = (number: number) => (
    <Button key={number} asChild variant={number === page ? "secondary" : "ghost"} size="sm" className={cn("min-w-8 px-2 tabular-nums", number === page && "font-semibold ring-1 ring-border")}>
      <Link href={link(number)} aria-current={number === page ? "page" : undefined} aria-label={`Page ${number}`}>{number}</Link>
    </Button>
  );
  const renderWindow = (size: number) => {
    const pages = pageNumbers(size);
    return (
      <>
        {pages[0]! > 1 && <>{renderPage(1)}{pages[0]! > 2 && <span aria-hidden className="px-1 text-muted-foreground">…</span>}</>}
        {pages.map(renderPage)}
        {pages[pages.length - 1]! < totalPages && <>{pages[pages.length - 1]! < totalPages - 1 && <span aria-hidden className="px-1 text-muted-foreground">…</span>}{renderPage(totalPages)}</>}
      </>
    );
  };
  const renderMobileWindow = () => pageNumbers(3).map(renderPage);
  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 border-t border-border/60 px-5 py-4 text-sm sm:flex-row">
      <p className="num text-muted-foreground">{from}–{to} of {total}</p>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" disabled={page <= 1} aria-disabled={page <= 1} className="px-2">
          {page <= 1 ? <span aria-label="Previous page"><ChevronLeft className="size-4" /><span className="hidden sm:inline">Previous</span></span> : <Link href={link(page - 1)} rel="prev" aria-label="Previous page"><ChevronLeft className="size-4" /><span className="hidden sm:inline">Previous</span></Link>}
        </Button>
        <span className="hidden items-center gap-0.5 sm:flex">{renderWindow(5)}</span>
        <span className="flex items-center gap-0.5 sm:hidden">{renderMobileWindow()}</span>
        <Button asChild variant="ghost" size="sm" disabled={page >= totalPages} aria-disabled={page >= totalPages} className="px-2">
          {page >= totalPages ? <span aria-label="Next page"><span className="hidden sm:inline">Next</span><ChevronRight className="size-4" /></span> : <Link href={link(page + 1)} rel="next" aria-label="Next page"><span className="hidden sm:inline">Next</span><ChevronRight className="size-4" /></Link>}
        </Button>
      </div>
    </nav>
  );
}
