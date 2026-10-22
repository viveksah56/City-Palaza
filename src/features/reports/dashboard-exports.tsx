import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DateRange } from "@/lib/dates";
import { APP_TIMEZONE } from "@/lib/constants";

export function DashboardExports({ range }: { range?: DateRange }) {
  const params = new URLSearchParams();
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
    <div className="flex items-center gap-1.5">
      <Button asChild variant="outline" size="sm">
        <a href={`/api/reports/dashboard-export${pdfQuery}`}><FileText aria-hidden /> <span className="sr-only sm:not-sr-only">PDF</span></a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={`/api/reports/dashboard-export${excelQuery}`}><FileSpreadsheet aria-hidden /> <span className="sr-only sm:not-sr-only">Excel</span></a>
      </Button>
    </div>
  );
}
