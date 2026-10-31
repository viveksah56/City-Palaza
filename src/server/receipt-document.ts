import PDFDocument from "pdfkit";
import { join } from "node:path";
import { formatCurrency, formatDate, formatDateTime, fullName } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { D } from "@/lib/money";
import { deviceLines, legacyAdjustment, warrantyLines, type ReceiptFormat } from "@/lib/receipt-helpers";
import type { getSaleForUserBySlug } from "@/server/sales.service";
import type { readSettings } from "@/server/settings.service";

type FullSale = NonNullable<Awaited<ReturnType<typeof getSaleForUserBySlug>>>;
export type ReceiptDocumentSale = Pick<FullSale,
  "saleNumber" | "createdAt" | "status" | "voidReason" | "subtotal" | "discount" | "total" | "paymentMethod" | "paymentStatus" | "amountPaid"
> & {
  amountTendered?: FullSale["amountTendered"];
  changeGiven?: FullSale["changeGiven"];
  employee: Pick<FullSale["employee"], "firstName" | "lastName">;
  customer: Pick<NonNullable<FullSale["customer"]>, "name" | "phone" | "email" | "address"> | null;
  items: Array<Pick<FullSale["items"][number], "id" | "productName" | "sku" | "serialSnapshot" | "quantity" | "unitPrice" | "subtotal" | "discount" | "promoDiscount" | "itemDiscount" | "saleDiscount" | "total"> & {
    imei2Snapshot?: string[];
    warranties?: Array<Pick<FullSale["items"][number]["warranties"][number], "tag" | "endsAt" | "status">>;
  }>;
  payments: Array<Pick<FullSale["payments"][number], "id" | "receivedAt" | "method" | "amount">>;
};

type ReceiptDocumentSettings = Awaited<ReturnType<typeof readSettings>>;

const MM = 72 / 25.4;
const THERMAL_WIDTH = Math.round(80 * MM); // 80 mm roll

export function createReceiptPdf(sale: ReceiptDocumentSale, settings: ReceiptDocumentSettings, format: ReceiptFormat = "a4"): Promise<Buffer> {
  return format === "thermal" ? createThermalPdf(sale, settings) : createA4Pdf(sale, settings);
}

function collect(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

// ---------------------------------------------------------------------------------------------
// 80 mm thermal receipt. Drawn twice: once on a tall scratch page to measure, once at exact height.
// ---------------------------------------------------------------------------------------------
function drawThermal(doc: PDFKit.PDFDocument, sale: ReceiptDocumentSale, settings: ReceiptDocumentSettings): number {
  const m = 8;
  const w = THERMAL_WIDTH - m * 2;
  const money = (v: { toString(): string }) => formatCurrency(v, settings.currency);
  let y = m;
  const text = (value: string, opts: { size?: number; bold?: boolean; align?: "left" | "center" | "right"; color?: string } = {}) => {
    doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(opts.size ?? 8).fillColor(opts.color ?? "#000000");
    doc.text(value, m, y, { width: w, align: opts.align ?? "left" });
    y += doc.heightOfString(value, { width: w, align: opts.align ?? "left" }) + 1.5;
  };
  const row = (left: string, right: string, opts: { bold?: boolean; size?: number } = {}) => {
    const size = opts.size ?? 8;
    doc.font(opts.bold ? "Helvetica-Bold" : "Helvetica").fontSize(size).fillColor("#000000");
    doc.text(left, m, y, { width: w * 0.62, lineBreak: true });
    const leftH = doc.heightOfString(left, { width: w * 0.62 });
    doc.text(right, m + w * 0.62, y, { width: w * 0.38, align: "right" });
    y += Math.max(leftH, size + 2) + 1.5;
  };
  const rule = () => {
    doc.save().dash(1.5, { space: 1.5 }).strokeColor("#000000").lineWidth(0.5).moveTo(m, y + 2).lineTo(m + w, y + 2).stroke().undash().restore();
    y += 6;
  };

  text(settings.shopName, { size: 12, bold: true, align: "center" });
  const addressLine = [settings.address, settings.city].filter(Boolean).join(", ");
  if (addressLine) text(addressLine, { size: 7.5, align: "center" });
  if (settings.phone) text(`Tel: ${settings.phone}`, { size: 7.5, align: "center" });
  rule();
  text("INVOICE", { size: 9, bold: true, align: "center" });
  if (sale.status === "VOIDED") text("*** VOIDED ***", { size: 10, bold: true, align: "center" });
  row("No.", sale.saleNumber, { bold: true });
  row("Date", formatDateTime(sale.createdAt));
  row("Cashier", fullName(sale.employee));
  row("Customer", sale.customer?.name ?? "Walk-in");
  if (sale.customer?.phone) row("Phone", sale.customer.phone);
  rule();

  for (const item of sale.items) {
    text(item.productName, { bold: true });
    row(`${item.quantity} × ${money(item.unitPrice)}`, money(item.subtotal));
    if (Number(item.discount) > 0) row("  Discount", `-${money(item.discount)}`, { size: 7.5 });
    for (const line of deviceLines(item)) text(line, { size: 6.5, color: "#333333" });
    for (const line of warrantyLines(item.warranties)) text(line, { size: 6.5, color: "#333333" });
    y += 2;
  }
  rule();

  row("Subtotal", money(sale.subtotal));
  if (Number(sale.discount) > 0) row("Discount", `-${money(sale.discount)}`);
  const adjustment = legacyAdjustment(sale);
  if (!adjustment.isZero()) row("Adjustment (legacy)", money(adjustment));
  row("TOTAL", money(sale.total), { bold: true, size: 11 });
  row(PAYMENT_METHOD_LABELS[sale.paymentMethod], money(sale.amountPaid));
  if (sale.amountTendered) row("Cash received", money(sale.amountTendered));
  if (sale.changeGiven && Number(sale.changeGiven) > 0) row("Change", money(sale.changeGiven));
  if (sale.amountPaid.lt(sale.total)) row("Balance due", money(sale.total.minus(sale.amountPaid)), { bold: true });
  rule();

  const hasWarranty = sale.items.some((item) => warrantyLines(item.warranties).length > 0);
  if (hasWarranty && settings.warrantyTerms) {
    text("WARRANTY TERMS", { size: 7, bold: true });
    text(settings.warrantyTerms, { size: 6.5, color: "#333333" });
    rule();
  }
  if (settings.receiptFooter) text(settings.receiptFooter, { size: 8, align: "center" });
  return y + m;
}

async function createThermalPdf(sale: ReceiptDocumentSale, settings: ReceiptDocumentSettings): Promise<Buffer> {
  const scratch = new PDFDocument({ size: [THERMAL_WIDTH, 6000], margin: 0 });
  const scratchDone = collect(scratch);
  const height = Math.ceil(drawThermal(scratch, sale, settings));
  scratch.end();
  await scratchDone;

  const doc = new PDFDocument({ size: [THERMAL_WIDTH, Math.max(height, 120)], margin: 0, info: { Title: `Receipt ${sale.saleNumber}`, Author: settings.shopName } });
  const done = collect(doc);
  drawThermal(doc, sale, settings);
  doc.end();
  return done;
}

// ---------------------------------------------------------------------------------------------
// A4 invoice
// ---------------------------------------------------------------------------------------------
function createA4Pdf(sale: ReceiptDocumentSale, settings: ReceiptDocumentSettings): Promise<Buffer> {
  const margin = 42;
  const doc = new PDFDocument({ size: "A4", margin, bufferPages: true, info: { Title: `Invoice ${sale.saleNumber}`, Author: settings.shopName, Subject: `Invoice ${sale.saleNumber}` } });
  const done = collect(doc);

  const pageRight = () => doc.page.width - margin;
  const pageBottom = () => doc.page.height - margin - 28;
  const money = (value: { toString(): string }) => formatCurrency(value, settings.currency);
  const negativeMoney = (value: { toString(): string }) => formatCurrency(D(value).negated(), settings.currency);

  const drawBusinessHeading = (continued = false) => {
    doc.rect(0, 0, doc.page.width, 9).fill("#1683d8");
    const logoPath = join(process.cwd(), "public", "citypalaza-icon.png");
    try {
      doc.image(logoPath, margin, 27, { fit: [48, 48] });
    } catch {
      doc.roundedRect(margin, 27, 48, 48, 8).fill("#10243a");
      doc.font("Helvetica-Bold").fontSize(15).fillColor("#ffffff").text(settings.shopName.slice(0, 2).toUpperCase(), margin, 43, { width: 48, align: "center" });
    }
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#14263d").text(settings.shopName, margin + 60, 28, { width: 300 });
    const businessLines = [[settings.address, settings.city].filter(Boolean).join(", "), settings.phone ? `Phone: ${settings.phone}` : "", settings.email ? `Email: ${settings.email}` : ""].filter(Boolean);
    doc.font("Helvetica").fontSize(8).fillColor("#526174").text(businessLines.join("\n"), margin + 60, 51, { width: 300, lineGap: 1 });
    doc.font("Helvetica-Bold").fontSize(20).fillColor("#14263d").text("INVOICE", pageRight() - 155, 29, { width: 155, align: "right" });
    doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(continued ? "CONTINUED" : "CUSTOMER COPY", pageRight() - 155, 54, { width: 155, align: "right", characterSpacing: 0.7 });
    if (sale.status === "VOIDED") doc.font("Helvetica-Bold").fontSize(11).fillColor("#b42318").text("VOIDED", pageRight() - 155, 68, { width: 155, align: "right" });
  };
  const drawInvoiceDetails = (continued = false) => {
    const top = continued ? 91 : 105;
    doc.save().roundedRect(margin, top, pageRight() - margin, continued ? 43 : 58, 5).fill("#f3f7fb").restore();
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text("INVOICE NO.", margin + 11, top + 9);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#14263d").text(sale.saleNumber, margin + 11, top + 22);
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text("DATE AND TIME", margin + 175, top + 9);
    doc.font("Helvetica").fontSize(9).fillColor("#14263d").text(formatDateTime(sale.createdAt), margin + 175, top + 23, { width: 150 });
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text("SERVED BY", margin + 350, top + 9);
    doc.font("Helvetica").fontSize(9).fillColor("#14263d").text(fullName(sale.employee), margin + 350, top + 23, { width: pageRight() - margin - 361, ellipsis: true });
    if (!continued) {
      const customerLine = sale.customer ? [sale.customer.name, sale.customer.phone, sale.customer.address].filter(Boolean).join(" | ") : "Walk-in customer";
      doc.font("Helvetica").fontSize(8).fillColor("#526174").text(`BILL TO: ${customerLine}`, margin + 11, top + 41, { width: pageRight() - margin * 2 - 22, ellipsis: true });
    }
    return continued ? top + 43 : top + 70;
  };

  const columns = ["ITEM DESCRIPTION", "QTY", "UNIT PRICE", "DISCOUNT", "AMOUNT"];
  const widths = [220, 40, 80, 70, 101];
  const descWidth = (widths[0] ?? 220) - 10;
  const tableWidth = widths.reduce((total, width) => total + width, 0);
  const drawTableHeader = (top: number) => {
    let x = margin;
    columns.forEach((label, index) => {
      const width = widths[index] ?? 0;
      doc.rect(x, top, width, 25).fillAndStroke("#eaf2fb", "#d6e0eb");
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#183450").text(label, x + 4, top + 8, { width: width - 8, align: index === 0 ? "left" : "right", ellipsis: true });
      x += width;
    });
    return top + 25;
  };
  const detailText = (item: ReceiptDocumentSale["items"][number]) =>
    [item.sku ? `SKU ${item.sku}` : "", ...deviceLines(item), ...warrantyLines(item.warranties)].filter(Boolean).join("\n");
  const measureRow = (item: ReceiptDocumentSale["items"][number]) => {
    doc.font("Helvetica-Bold").fontSize(8);
    const nameHeight = doc.heightOfString(item.productName, { width: descWidth });
    doc.font("Helvetica").fontSize(7);
    const details = detailText(item);
    return { nameHeight, detailHeight: details ? doc.heightOfString(details, { width: descWidth }) : 0, details };
  };
  const drawTableRow = (item: ReceiptDocumentSale["items"][number], top: number, alternate: boolean) => {
    const { nameHeight, detailHeight, details } = measureRow(item);
    const height = Math.max(30, nameHeight + detailHeight + 13);
    doc.rect(margin, top, tableWidth, height).fillAndStroke(alternate ? "#f8fafc" : "#ffffff", "#e2e8f0");
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#1f2937").text(item.productName, margin + 5, top + 6, { width: descWidth });
    if (details) doc.font("Helvetica").fontSize(7).fillColor("#64748b").text(details, margin + 5, top + 6 + nameHeight, { width: descWidth });
    let x = margin + (widths[0] ?? 220);
    const values = [String(item.quantity), money(item.unitPrice), money(item.discount), money(item.total)];
    values.forEach((value, index) => {
      const width = widths[index + 1] ?? 0;
      doc.font(index === values.length - 1 ? "Helvetica-Bold" : "Helvetica").fontSize(7.5).fillColor("#1f2937").text(value, x + 3, top + 9, { width: width - 7, align: "right", ellipsis: true });
      x += width;
    });
    return top + height;
  };
  const beginPage = (continued: boolean) => {
    if (continued) doc.addPage();
    drawBusinessHeading(continued);
    const detailsBottom = drawInvoiceDetails(continued);
    return drawTableHeader(detailsBottom + (continued ? 4 : 0));
  };

  let y = beginPage(false);
  for (const [index, item] of sale.items.entries()) {
    const { nameHeight, detailHeight } = measureRow(item);
    if (y + Math.max(30, nameHeight + detailHeight + 13) > pageBottom() - 160) y = beginPage(true);
    y = drawTableRow(item, y, index % 2 === 1);
  }

  if (y + 200 > pageBottom()) y = beginPage(true);
  y += 20;
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#14263d").text("INVOICE TOTALS", margin, y);
  y += 19;
  const adjustment = legacyAdjustment(sale);
  const totals: [string, string, boolean][] = [
    ["Subtotal", money(sale.subtotal), false],
    ["Discount", negativeMoney(sale.discount), false],
    ...(adjustment.isZero() ? [] : [["Adjustment (legacy)", money(adjustment), false] as [string, string, boolean]]),
    ["TOTAL", money(sale.total), true],
    ["Paid via", PAYMENT_METHOD_LABELS[sale.paymentMethod], false],
    ["Amount paid", money(sale.amountPaid), false],
    ...(sale.amountTendered ? [["Cash received", money(sale.amountTendered), false] as [string, string, boolean]] : []),
    ...(sale.changeGiven && Number(sale.changeGiven) > 0 ? [["Change returned", money(sale.changeGiven), false] as [string, string, boolean]] : []),
    ...(sale.amountPaid.lt(sale.total) ? [["Balance due", money(sale.total.minus(sale.amountPaid)), true] as [string, string, boolean]] : []),
  ];
  const summaryX = pageRight() - 228;
  for (const [label, value, strong] of totals) {
    const rowHeight = strong ? 25 : 17;
    if (strong) doc.roundedRect(summaryX - 7, y - 3, 235, rowHeight, 3).fill("#edf3f9");
    doc.font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(strong ? 10 : 8.5).fillColor(strong ? "#14263d" : "#526174").text(label, summaryX, y, { width: 125 });
    doc.text(value, summaryX + 125, y, { width: 95, align: "right" });
    y += rowHeight;
  }
  if (sale.payments.length > 0) {
    y += 12;
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#14263d").text("Payment history", margin, y);
    y += 14;
    for (const payment of sale.payments) {
      doc.font("Helvetica").fontSize(7.5).fillColor("#526174").text(`${formatDateTime(payment.receivedAt)} | ${PAYMENT_METHOD_LABELS[payment.method]}`, margin, y, { width: 300 });
      doc.text(money(payment.amount), pageRight() - 130, y, { width: 130, align: "right" });
      y += 13;
    }
  }

  const warrantyEnds = sale.items.flatMap((item) => (item.warranties ?? []).filter((w) => w.status === "ACTIVE").map((w) => w.endsAt));
  if (warrantyEnds.length > 0 && settings.warrantyTerms) {
    y += 14;
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#14263d").text(`WARRANTY TERMS (coverage ends ${formatDate(warrantyEnds.reduce((a, b) => (a > b ? a : b)))} at the latest)`, margin, y);
    y += 12;
    doc.font("Helvetica").fontSize(7.5).fillColor("#526174").text(settings.warrantyTerms, margin, y, { width: pageRight() - margin });
  }

  const pages = doc.bufferedPageRange();
  for (let page = pages.start; page < pages.start + pages.count; page += 1) {
    doc.switchToPage(page);
    const footerY = doc.page.height - 90;
    doc.strokeColor("#d8e1ec").moveTo(margin, footerY - 5).lineTo(pageRight(), footerY - 5).stroke();
    doc.font("Helvetica").fontSize(7).fillColor("#64748b").text(`${settings.shopName}${settings.receiptFooter ? ` | ${settings.receiptFooter}` : ""}`, margin, footerY, { width: 400, ellipsis: true, lineBreak: false });
    doc.text(`Page ${page + 1} of ${pages.count}`, pageRight() - 90, footerY, { width: 90, align: "right", lineBreak: false });
  }
  doc.end();
  return done;
}
