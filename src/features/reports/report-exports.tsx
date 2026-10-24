"use client";

import { Download, FileSpreadsheet, FileText, Printer, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { DateRange } from "@/lib/dates";
import { formatDateInput } from "@/lib/format";

export function ReportExports({ range, scope, reportTab }: { range?: DateRange; scope: "sales" | "report"; reportTab?: string }) {
  const params = new URLSearchParams();
  params.set("scope", scope);
  if (reportTab) params.set("report", reportTab);
  if (range) {
    params.set("range", range.preset);
    if (range.preset === "custom") {
      params.set("from", formatDateInput(range.from));
      params.set("to", formatDateInput(new Date(range.to.getTime() - 86_400_000)));
    }
  }
  const href = (format: "pdf" | "xlsx" | "csv") => {
    const query = new URLSearchParams(params);
    query.set("format", format);
    return `/api/reports/export?${query.toString()}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" aria-label="Export or print this report"><Download aria-hidden="true" /> Export</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem asChild><a href={href("pdf")}><FileText aria-hidden="true" /> Download PDF</a></DropdownMenuItem>
        <DropdownMenuItem asChild><a href={href("xlsx")}><FileSpreadsheet aria-hidden="true" /> Download Excel</a></DropdownMenuItem>
        <DropdownMenuItem asChild><a href={href("csv")}><Table2 aria-hidden="true" /> Download CSV</a></DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.print()}><Printer aria-hidden="true" /> Print report</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
