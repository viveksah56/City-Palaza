"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Header = { id: string; content: React.ReactNode; alignRight?: boolean; className?: string };
type Detail = { id: string; label: string; value: React.ReactNode };
type Row = { id: string; title: React.ReactNode; cells: React.ReactNode[]; details: Detail[]; actions: React.ReactNode[] };

function SelectBox({ label, checked, indeterminate, onChange }: { label: string; checked: boolean; indeterminate?: boolean; onChange: (checked: boolean) => void }) {
  const input = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (input.current) input.current.indeterminate = !!indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={input}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(event) => onChange(event.currentTarget.checked)}
      className="size-4 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    />
  );
}

export function SelectableTable({ headers, rows }: { headers: Header[]; rows: Row[] }) {
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));
  const someSelected = !allSelected && rows.some((row) => selected.has(row.id));

  const selectAll = (checked: boolean) => setSelected((current) => {
    const next = new Set(current);
    for (const row of rows) checked ? next.add(row.id) : next.delete(row.id);
    return next;
  });

  const selectRow = (id: string, checked: boolean) => setSelected((current) => {
    const next = new Set(current);
    checked ? next.add(id) : next.delete(id);
    return next;
  });

  return (
    <>
      {selected.size > 0 && (
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2.5 text-sm">
          <span aria-live="polite">{selected.size} selected</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear selection</Button>
        </div>
      )}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <SelectBox label="Select all rows on this page" checked={allSelected} indeterminate={someSelected} onChange={selectAll} />
              </TableHead>
              {headers.map((header) => <TableHead key={header.id} className={cn(header.alignRight && "text-right", header.className)}>{header.content}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} data-state={selected.has(row.id) ? "selected" : undefined} className="data-[state=selected]:bg-muted/55">
                <TableCell className="w-10">
                  <SelectBox label={`Select row ${row.id}`} checked={selected.has(row.id)} onChange={(checked) => selectRow(row.id, checked)} />
                </TableCell>
                {row.cells.map((cell, index) => <TableCell key={headers[index]?.id ?? index} className={cn(headers[index]?.alignRight && "text-right", headers[index]?.className)}>{cell}</TableCell>)}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="divide-y divide-border/60 md:hidden">
        {rows.map((row) => (
          <li key={row.id} data-state={selected.has(row.id) ? "selected" : undefined} className="grid gap-2.5 px-4 py-4 data-[state=selected]:bg-muted/55">
            <div className="flex min-w-0 items-start gap-3">
              <SelectBox label={`Select row ${row.id}`} checked={selected.has(row.id)} onChange={(checked) => selectRow(row.id, checked)} />
              <div className="min-w-0 text-[15px] font-medium">{row.title}</div>
            </div>
            {row.details.length > 0 && (
              <dl className="grid gap-1.5 pl-7 text-sm">
                {row.details.map((detail) => <div key={detail.id} className="flex items-center justify-between gap-4"><dt className="text-muted-foreground">{detail.label}</dt><dd className="min-w-0 text-right">{detail.value}</dd></div>)}
              </dl>
            )}
            {row.actions.length > 0 && <div className="flex justify-end gap-2 pt-1">{row.actions.map((action, index) => <React.Fragment key={index}>{action}</React.Fragment>)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}
