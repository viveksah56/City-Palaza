import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/auth/guards";
import { PERMISSION } from "@/lib/rbac/permission";
import { first } from "@/lib/url";
import { resolveRange } from "@/lib/dates";
import { getSettings } from "@/server/settings.service";
import { getReportExportData, getSalesExportData, type ReportTab } from "@/server/report-export.service";
import { createReportPdf, createReportWorkbook } from "@/server/report-documents";
import { DomainError } from "@/lib/errors";
import { rateLimitResponse } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const limited = await rateLimitResponse(request, "reports:export", { limit: 12, windowSeconds: 300 });
  if (limited) return limited;
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format");
    if (format !== "pdf" && format !== "xlsx") return NextResponse.json({ error: "Choose PDF or Excel format." }, { status: 400 });
    const scope = url.searchParams.get("scope");
    if (scope !== "sales" && scope !== "report") return NextResponse.json({ error: "Choose a valid report type." }, { status: 400 });
    const tabValue = url.searchParams.get("tab") ?? "sales";
    if (scope === "report" && !["sales", "profit", "inventory", "employees"].includes(tabValue)) return NextResponse.json({ error: "Choose a valid report tab." }, { status: 400 });
    const range = resolveRange(first(url.searchParams.get("range") ?? undefined), first(url.searchParams.get("from") ?? undefined), first(url.searchParams.get("to") ?? undefined), { fallback: "last7" });
    if (range.to.getTime() - range.from.getTime() > 366 * 86_400_000) return NextResponse.json({ error: "Choose a period of one year or less." }, { status: 400 });
    const user = await assertPermission(scope === "sales" ? PERMISSION.SALE_VIEW : PERMISSION.REPORT_VIEW);
    const settings = await getSettings();
    const business = { name: settings.shopName, address: settings.address, city: settings.city, phone: settings.phone, email: settings.email, panNumber: settings.panNumber };
    const data = scope === "sales"
      ? await getSalesExportData(user, range, settings.currency, business)
      : await getReportExportData(user, range, settings.currency, tabValue as ReportTab, business);
    const file = format === "pdf" ? await createReportPdf(data) : await createReportWorkbook(data);
    const extension = format === "pdf" ? "pdf" : "xlsx";
    const contentType = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const reportName = scope === "report" ? `${tabValue}-report` : "sales-report";
    const filename = `cityplaza-${reportName}-${new Date().toISOString().slice(0, 10)}.${extension}`;
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof DomainError && error.code === "UNAUTHENTICATED") return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof DomainError && error.code === "FORBIDDEN") return NextResponse.json({ error: error.message }, { status: 403 });
    console.error("[report export error]", error);
    return NextResponse.json({ error: "Unable to generate this report right now." }, { status: 500 });
  }
}
