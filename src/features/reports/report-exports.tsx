import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DateRange } from "@/lib/dates";
import { APP_TIMEZONE } from "@/lib/constants";

export function ReportExports({ range, scope, reportTab }: { range?: DateRange; scope: "sales" | "report"; reportTab?: string }) {
  const params = new URLSearchParams();
  params.set("scope", scope);
  if (reportTab) params.set("tab", reportTab);
  if (range) {
    params.set("range", range.preset);
    if (range.preset === "custom") {
      params.set("from", range.from.toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE }));
      params.set("to", new Date(range.to.getTime() - 86_400_000).toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE }));
    }
  }
  params.set("format", "pdf");
  const query = params.size ? `?${params}` : "";
  const pdfQuery = query;
  params.set("format", "xlsx");
  const excelQuery = `?${params}`;
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Export report">
      <Button asChild variant="outline">
        <a href={`/api/reports/export${pdfQuery}`} aria-label="Export PDF"><FileText aria-hidden="true" /> <span className="sr-only sm:not-sr-only">PDF</span></a>
      </Button>
      <Button asChild variant="outline">
        <a href={`/api/reports/export${excelQuery}`} aria-label="Export Excel"><FileSpreadsheet aria-hidden="true" /> <span className="sr-only sm:not-sr-only">Excel</span></a>
      </Button>
    </div>
  );
}
