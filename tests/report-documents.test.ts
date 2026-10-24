import ExcelJS from "exceljs";
import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createReportPdf, createReportWorkbook } from "@/server/report-documents";
import type { ReportExportData } from "@/server/report-export.service";

const data: ReportExportData = {
  title: "CityPlaza sales report",
  period: "Last 7 days · 17/10/2026 – 23/10/2026",
  currency: "NPR",
  business: { name: "CityPlaza", address: "Main Road", city: "Kathmandu", phone: "9800000000", email: "shop@example.com", panNumber: "612865374" },
  summary: [["Sales total", "NPR 3,132.36"], ["Collected", "NPR 3,132.36"]],
  sections: [
    {
      title: "Sold products",
      columns: ["Sale", "Sold at", "Employee", "Customer", "Phone", "Payment method", "Product", "SKU", "Category at sale", "Quantity", "IMEI / serial numbers", "Unit price (NPR)", "Gross amount (NPR)", "Promotion discount (NPR)", "Product discount (NPR)", "Sale-wide discount allocation (NPR)", "Total line discount (NPR)", "VAT (NPR)", "Line total (NPR)", "Notes"],
      rows: [
        ["CP-2026-001", "23/10/2026, 10:00:00", "Store Employee", "Walk-in", "", "CASH", "USB-C Cable", "AN-CBL-C2C", "Cables", 3, "", 1200, 3600, 0, 100, 728, 828, 360.36, 3132.36, "Counter sale"],
        ["TOTAL", "", "", "", "", "", "", "", "", 3, "", "", 3600, 0, 100, 728, 828, 360.36, 3132.36, ""],
      ],
    },
  ],
};

describe("report documents", () => {
  it("exports every sold product detail and totals to Excel", async () => {
    const bytes = await createReportWorkbook(data);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes.buffer as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.getWorksheet("Sold products");
    expect(sheet).toBeDefined();
    expect(sheet?.getRow(3).values).toContain("USB-C Cable");
    expect(sheet?.getRow(3).values).toContain("CP-2026-001");
    expect(sheet?.getRow(3).values).toContain(3132.36);
    expect(sheet?.getRow(4).getCell(10).value).toBe(3);
    expect(sheet?.getRow(4).getCell(19).value).toBe(3132.36);
  });

  it("generates a readable PDF document", async () => {
    const bytes = await createReportPdf(data);
    expect(bytes.subarray(0, 8).toString("ascii")).toContain("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1_000);
    if (process.env.REPORT_PREVIEW_PATH) await writeFile(process.env.REPORT_PREVIEW_PATH, bytes);
    expect(bytes.toString("latin1").match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
  });

  it("paginates a long sold-product report without appending blank footer pages", async () => {
    const section = data.sections[0]!;
    const detail = section.rows[0]!;
    const total = section.rows[1]!;
    const rows = Array.from({ length: 40 }, (_, index) => [detail[0], `23/10/2026, 10:${String(index % 60).padStart(2, "0")}`, ...detail.slice(2)]);
    const bytes = await createReportPdf({ ...data, sections: [{ ...section, rows: [...rows, total] }] });
    const pageCount = bytes.toString("latin1").match(/\/Type\s*\/Page\b/g)?.length ?? 0;
    expect(pageCount).toBeGreaterThan(1);
    if (process.env.REPORT_MULTI_PAGE_PREVIEW_PATH) await writeFile(process.env.REPORT_MULTI_PAGE_PREVIEW_PATH, bytes);
  });
});
