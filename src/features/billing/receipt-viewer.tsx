"use client";
import * as React from "react";
import { Download, FileText, Printer, Receipt as ReceiptIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReceiptFormat } from "@/lib/receipt-helpers";

const PAGE_CSS: Record<ReceiptFormat, string> = {
  a4: "@media print { @page { size: A4 portrait; margin: 12mm; } }",
  thermal: "@media print { @page { size: 80mm auto; margin: 0; } html, body { width: 80mm; } }",
};

/** Format switch + Print + PDF download. Only the selected layout is rendered, so Print outputs exactly what you see. */
export function ReceiptViewer({ slug, a4, thermal, initialFormat = "a4" }: { slug: string; a4: React.ReactNode; thermal: React.ReactNode; initialFormat?: ReceiptFormat }) {
  const [format, setFormat] = React.useState<ReceiptFormat>(initialFormat);
  const tabs: { id: ReceiptFormat; label: string; icon: React.ReactNode }[] = [
    { id: "a4", label: "A4 invoice", icon: <FileText className="size-4" aria-hidden /> },
    { id: "thermal", label: "80mm receipt", icon: <ReceiptIcon className="size-4" aria-hidden /> },
  ];
  return (
    <>
      <style>{PAGE_CSS[format]}</style>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div role="tablist" aria-label="Receipt format" className="inline-flex rounded-lg border border-border bg-card p-1">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={format === tab.id} onClick={() => setFormat(tab.id)}
              className={cn("inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", format === tab.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.print()}><Printer /> Print</Button>
          <Button asChild variant="outline"><a href={`/api/sales/${slug}/receipt?format=${format}`} download><Download /> PDF</a></Button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border/70 bg-muted/40 p-2 shadow-sm sm:p-5 lg:p-7 print:overflow-visible print:border-0 print:bg-transparent print:p-0 print:shadow-none">
        {format === "a4" ? a4 : thermal}
      </div>
    </>
  );
}
