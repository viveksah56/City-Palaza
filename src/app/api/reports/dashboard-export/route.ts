import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/auth/guards";
import { PERMISSION } from "@/lib/rbac/permission";
import { first } from "@/lib/url";
import { resolveRange } from "@/lib/dates";
import { getSettings } from "@/server/settings.service";
import { getDashboardExportData, type DashboardExportData } from "@/server/dashboard-export.service";
import { DomainError } from "@/lib/errors";

function safeCell(value: string | number): string | number {
  if (typeof value !== "string") return value;
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

async function createWorkbook(data: DashboardExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CityPalaza";
  workbook.created = new Date();
  const summary = workbook.addWorksheet("Overview");
  summary.addRow([data.title]);
  summary.addRow(["Period", data.period]);
  summary.addRow([]);
  summary.addRow(["Metric", "Value"]);
  data.summary.forEach((row) => summary.addRow(row.map(safeCell)));
  summary.columns = [{ width: 30 }, { width: 32 }];
  summary.getRow(1).font = { bold: true, size: 16 };
  summary.getRow(4).font = { bold: true };

  for (const section of data.sections) {
    const sheet = workbook.addWorksheet(section.title.slice(0, 31));
    sheet.addRow([section.title]);
    sheet.addRow(section.columns.map(safeCell));
    section.rows.forEach((row) => sheet.addRow(row.map(safeCell)));
    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.getRow(2).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 2 }];
    sheet.columns = section.columns.map((column, index) => ({
      width: Math.min(38, Math.max(16, column.length + (index === 0 ? 8 : 4))),
    }));
  }
  const result = await workbook.xlsx.writeBuffer();
  return Buffer.from(result);
}

async function createPdf(data: DashboardExportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true, info: { Title: data.title, Author: "CityPalaza" } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    const ensureSpace = (height: number) => {
      if (doc.y + height > doc.page.height - 48) doc.addPage();
    };
    doc.font("Helvetica-Bold").fontSize(19).fillColor("#18181b").text(data.title);
    doc.moveDown(0.4).font("Helvetica").fontSize(10).fillColor("#52525b").text(data.period);
    doc.moveDown(1.2).font("Helvetica-Bold").fontSize(13).fillColor("#18181b").text("Overview");
    doc.moveDown(0.35);
    for (const [label, value] of data.summary) {
      ensureSpace(19);
      doc.font("Helvetica").fontSize(10).fillColor("#3f3f46").text(label, { continued: true, width: 300 });
      doc.font("Helvetica-Bold").fillColor("#18181b").text(String(value), { align: "right" });
      doc.moveDown(0.15);
    }
    for (const section of data.sections) {
      ensureSpace(50);
      doc.moveDown(0.8).font("Helvetica-Bold").fontSize(13).fillColor("#18181b").text(section.title);
      doc.moveDown(0.35);
      const rows = [section.columns, ...section.rows];
      for (const [index, row] of rows.entries()) {
        const text = row.map((cell) => String(cell)).join("    ·    ");
        doc.font(index === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(9);
        const height = doc.heightOfString(text, { width: doc.page.width - 96 });
        ensureSpace(height + 9);
        doc.fillColor("#3f3f46").text(text, { width: doc.page.width - 96 });
        doc.moveDown(0.2);
      }
    }
    doc.end();
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format");
    if (format !== "pdf" && format !== "xlsx") return NextResponse.json({ error: "Choose PDF or Excel format." }, { status: 400 });
    const range = resolveRange(first(url.searchParams.get("range") ?? undefined), first(url.searchParams.get("from") ?? undefined), first(url.searchParams.get("to") ?? undefined), { fallback: "last7" });
    if (range.to.getTime() - range.from.getTime() > 366 * 86_400_000) return NextResponse.json({ error: "Choose a period of one year or less." }, { status: 400 });
    const [user, settings] = await Promise.all([
      assertPermission(PERMISSION.DASHBOARD_VIEW),
      getSettings(),
    ]);
    const data = await getDashboardExportData(user, range, settings.currency);
    const file = format === "pdf" ? await createPdf(data) : await createWorkbook(data);
    const extension = format === "pdf" ? "pdf" : "xlsx";
    const contentType = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const filename = `citypalaza-dashboard-${new Date().toISOString().slice(0, 10)}.${extension}`;
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
    console.error("[dashboard export error]", error);
    return NextResponse.json({ error: "Unable to generate this report right now." }, { status: 500 });
  }
}
