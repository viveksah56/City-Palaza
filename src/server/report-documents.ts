import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import type { ReportExportData } from "@/server/report-export.service";
import { APP_NAME } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

function safeCell(value: string | number): string | number {
  if (typeof value !== "string") return value;
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

export async function createReportWorkbook(data: ReportExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = data.business.name || APP_NAME;
  workbook.subject = data.period;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.company = data.business.name || APP_NAME;
  workbook.properties.date1904 = false;
  const summary = workbook.addWorksheet("Overview");
  summary.mergeCells("A1:B1");
  summary.addRow([data.title]);
  summary.addRow(["Reporting period", data.period]);
  summary.addRow(["Generated", formatDateTime(new Date())]);
  summary.addRow(["Business", data.business.name || APP_NAME]);
  summary.addRow(["Address", [data.business.address, data.business.city].filter(Boolean).join(", ")]);
  summary.addRow(["Phone", data.business.phone]);
  summary.addRow(["Email", data.business.email]);
  summary.addRow(["PAN", data.business.panNumber]);
  summary.addRow([]);
  summary.addRow(["Metric", "Value"]);
  data.summary.forEach((row) => summary.addRow(row.map(safeCell)));
  summary.columns = [{ width: 30 }, { width: 32 }];
  summary.getRow(1).height = 34;
  summary.getRow(1).font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  summary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14263D" } };
  summary.getRow(2).font = { color: { argb: "FF475569" } };
  summary.getRow(3).font = { color: { argb: "FF475569" } };
  summary.getRow(10).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summary.getRow(10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1683D8" } };
  summary.views = [{ state: "frozen", ySplit: 10 }];
  summary.autoFilter = { from: { row: 10, column: 1 }, to: { row: 10, column: 2 } };
  for (let index = 11; index <= summary.rowCount; index += 1) {
    const row = summary.getRow(index);
    if (index % 2 === 0) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    row.border = { bottom: { style: "hair", color: { argb: "FFCBD5E1" } } };
  }

  for (const section of data.sections) {
    const sheet = workbook.addWorksheet(section.title.slice(0, 31));
    sheet.addRow([section.title]);
    sheet.addRow(section.columns.map(safeCell));
    section.rows.forEach((row) => sheet.addRow(row.map(safeCell)));
    sheet.mergeCells(1, 1, 1, section.columns.length);
    sheet.getRow(1).height = 26;
    sheet.getRow(1).font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14263D" } };
    sheet.getRow(2).height = 22;
    sheet.getRow(2).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1683D8" } };
    sheet.views = [{ state: "frozen", ySplit: 2, xSplit: section.columns.length > 5 ? 1 : 0 }];
    if (section.columns.length > 0) sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: section.columns.length } };
    sheet.columns = section.columns.map((column, index) => ({
      width: Math.min(42, Math.max(15, column.length + (index === 0 ? 8 : 4))),
    }));
    for (let rowIndex = 3; rowIndex <= sheet.rowCount; rowIndex += 1) {
      const row = sheet.getRow(rowIndex);
      if (row.getCell(1).value === "TOTAL") {
        row.font = { bold: true, color: { argb: "FF14263D" } };
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCEBFA" } };
      } else if (rowIndex % 2 === 1) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      row.border = { bottom: { style: "hair", color: { argb: "FFCBD5E1" } } };
      row.alignment = { vertical: "top", wrapText: true };
      for (let columnIndex = 1; columnIndex <= section.columns.length; columnIndex += 1) {
        const header = section.columns[columnIndex - 1]?.toLowerCase() ?? "";
        if (/\b(price|subtotal|discount|vat|tax|total|paid|balance|amount|revenue|profit|cost|sales \(|collected|gross amount)\b/.test(header)) {
          row.getCell(columnIndex).numFmt = `"${data.currency}" #,##0.00;[Red]("${data.currency}" #,##0.00)`;
        }
      }
    }
  }
  const result = await workbook.xlsx.writeBuffer();
  return Buffer.from(result);
}

export async function createReportPdf(data: ReportExportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40, bufferPages: true, info: { Title: data.title, Author: data.business.name || APP_NAME, Subject: data.period } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    const writeFooters = () => {
      const pages = doc.bufferedPageRange();
      for (let page = pages.start; page < pages.start + pages.count; page += 1) {
        doc.switchToPage(page);
        doc.save();
        doc.strokeColor("#d8e1ec").moveTo(40, doc.page.height - 66).lineTo(doc.page.width - 40, doc.page.height - 66).stroke();
        doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(`${data.business.name || APP_NAME} · Confidential business report`, 40, doc.page.height - 59, { width: 400, lineBreak: false });
        doc.text(`Page ${page + 1} of ${pages.count}`, doc.page.width - 180, doc.page.height - 59, { width: 140, align: "right", lineBreak: false });
        doc.restore();
      }
    };

    const margin = 40;
    const pageBottom = () => doc.page.height - 42;
    const addPage = () => {
      doc.addPage();
      doc.y = margin;
    };
    const ensureSpace = (height: number) => {
      if (doc.y + height > pageBottom()) addPage();
    };
    const sectionRows = data.sections.flatMap((section) => {
      if (section.title === "Sale transactions") {
        const indexes = [0, 1, 3, 5, 6, 11];
        return [{
          ...section,
          title: "Sale transactions · overview",
          columns: indexes.map((index) => section.columns[index] ?? ""),
          rows: section.rows.map((row) => indexes.map((index) => row[index] ?? "")),
        }];
      }
      if (section.title === "Sold products") {
        const indexes = [0, 1, 6, 7, 9, 11, 14, 15, 17, 18];
        return [{
          ...section,
          title: "Sold products · detailed",
          columns: ["Sale", "Date", "Product", "SKU", "Qty", "Unit price", "Item disc.", "Sale disc.", "VAT", "Line total"],
          rows: section.rows.map((row) => indexes.map((index) => row[index] ?? "")),
        }];
      }
      if (section.title === "Payment transactions") return [];
      return [section];
    });

    const drawTableHeader = (columns: string[], widths: number[], top: number) => {
      const height = 28;
      let x = margin;
      columns.forEach((column, index) => {
        const width = widths[index] ?? 0;
        doc.rect(x, top, width, height).fillAndStroke("#eaf2fb", "#d6e0eb");
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#183450").text(column, x + 5, top + 8, { width: width - 10, height: height - 10, ellipsis: true });
        x += width;
      });
      return top + height;
    };

    doc.rect(0, 0, doc.page.width, 10).fill("#1385d5");
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1683d8").text(`${data.business.name || APP_NAME}  /  BUSINESS REPORT`, margin, 28, { characterSpacing: 1.1 });
    doc.font("Helvetica-Bold").fontSize(23).fillColor("#14263d").text(data.title, margin, 51, { width: doc.page.width - margin * 2 });
    doc.font("Helvetica").fontSize(10).fillColor("#64748b").text(data.period, margin, 83);
    const businessDetails = [data.business.address, data.business.city, data.business.phone, data.business.email, data.business.panNumber ? `PAN ${data.business.panNumber}` : ""].filter(Boolean).join("  ·  ");
    if (businessDetails) doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(businessDetails, margin, 99, { width: doc.page.width - margin * 2, ellipsis: true });
    doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(`Generated ${formatDateTime(new Date())} · Currency: ${data.currency}`, margin, businessDetails ? 111 : 99);
    doc.y = businessDetails ? 132 : 123;
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#14263d").text("Executive summary", margin, doc.y);
    doc.y += 13;
    const cardGap = 10;
    const cardWidth = (doc.page.width - margin * 2 - cardGap * 3) / 4;
    const cardHeight = 48;
    const summaryTop = doc.y;
    for (let index = 0; index < data.summary.length; index += 1) {
      const [label, value] = data.summary[index] ?? ["", ""];
      const column = index % 4;
      const row = Math.floor(index / 4);
      const x = margin + column * (cardWidth + cardGap);
      const y = summaryTop + row * (cardHeight + cardGap);
      doc.roundedRect(x, y, cardWidth, cardHeight, 6).fillAndStroke("#f6f9fc", "#dce5ef");
      doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(label, x + 10, y + 8, { width: cardWidth - 20, ellipsis: true });
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#14263d").text(String(value), x + 10, y + 23, { width: cardWidth - 20, ellipsis: true });
    }

    doc.y = summaryTop + Math.ceil(data.summary.length / 4) * (cardHeight + cardGap) + 3;
    for (const section of sectionRows) {
      ensureSpace(58);
      doc.font("Helvetica-Bold").fontSize(13).fillColor("#14263d").text(section.title, margin, doc.y);
      doc.y += 21;
      const tableWidth = doc.page.width - margin * 2;
      const weights = section.title.startsWith("Sold products") ? [0.09, 0.12, 0.19, 0.1, 0.05, 0.09, 0.09, 0.09, 0.09, 0.09] : section.columns.map(() => 1);
      const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
      const widths = weights.map((weight) => tableWidth * weight / weightTotal);
      let y = drawTableHeader(section.columns, widths, doc.y);
      for (const [rowIndex, row] of section.rows.entries()) {
        const fontSize = section.columns.length > 8 ? 7 : 8;
        const cellLines = row.map((value, index) => {
          const width = Math.max(24, (widths[index] ?? tableWidth) - 10);
          doc.font("Helvetica").fontSize(fontSize);
          return doc.heightOfString(String(value), { width, lineGap: 1 });
        });
        const rowHeight = Math.max(22, Math.min(54, Math.max(...cellLines, 10) + 10));
        if (y + rowHeight > pageBottom()) {
          addPage();
          doc.font("Helvetica-Bold").fontSize(10).fillColor("#14263d").text(`${section.title} · continued`, margin, doc.y);
          y = drawTableHeader(section.columns, widths, doc.y + 17);
        }
        const isTotal = String(row[0] ?? "") === "TOTAL";
        const background = isTotal ? "#eaf2fb" : rowIndex % 2 === 0 ? "#ffffff" : "#f7f9fc";
        let x = margin;
        row.forEach((value, index) => {
          const width = widths[index] ?? 0;
          doc.rect(x, y, width, rowHeight).fillAndStroke(background, "#e2e8f0");
          doc.font(isTotal ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize).fillColor(isTotal ? "#14263d" : "#334155").text(String(value), x + 5, y + 5, { width: width - 10, height: rowHeight - 8, align: typeof value === "number" ? "right" : "left", ellipsis: true, lineGap: 1 });
          x += width;
        });
        y += rowHeight;
      }
      doc.y = y + 18;
    }

    doc.font("Helvetica-Oblique").fontSize(8).fillColor("#64748b").text("This report includes sale totals and sold product line details. Detailed serial and payment transaction records are available in the Excel workbook.", margin, Math.min(doc.y + 4, pageBottom() - 12), { width: doc.page.width - margin * 2 });
    writeFooters();
    doc.end();
  });
}

