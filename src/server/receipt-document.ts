import PDFDocument from "pdfkit";
import { join } from "node:path";
import { formatCurrency, formatDateTime, fullName } from "@/lib/format";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { D } from "@/lib/money";
import type { getSaleForUserBySlug } from "@/server/sales.service";
import type { readSettings } from "@/server/settings.service";

type FullSale = NonNullable<Awaited<ReturnType<typeof getSaleForUserBySlug>>>;
export type ReceiptDocumentSale = Pick<FullSale,
  "saleNumber" | "createdAt" | "status" | "voidReason" | "subtotal" | "discount" | "taxRate" | "tax" | "total" | "paymentMethod" | "paymentStatus" | "amountPaid"
> & {
  employee: Pick<FullSale["employee"], "firstName" | "lastName">;
  customer: Pick<NonNullable<FullSale["customer"]>, "name" | "phone" | "email" | "address"> | null;
  items: Array<Pick<FullSale["items"][number], "id" | "productName" | "sku" | "serialSnapshot" | "quantity" | "unitPrice" | "subtotal" | "discount" | "promoDiscount" | "itemDiscount" | "saleDiscount" | "tax" | "total">>;
  payments: Array<Pick<FullSale["payments"][number], "id" | "receivedAt" | "method" | "amount">>;
};

type ReceiptDocumentSettings = Awaited<ReturnType<typeof readSettings>>;

export function createReceiptPdf(sale: ReceiptDocumentSale, settings: ReceiptDocumentSettings): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const margin = 42;
    const doc = new PDFDocument({ size: "A4", margin, bufferPages: true, info: { Title: `Tax invoice ${sale.saleNumber}`, Author: settings.shopName, Subject: `VAT tax invoice ${sale.saleNumber}` } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

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
        doc.font("Helvetica-Bold").fontSize(15).fillColor("#ffffff").text("CP", margin, 43, { width: 48, align: "center" });
      }
      doc.font("Helvetica-Bold").fontSize(18).fillColor("#14263d").text(settings.shopName, margin + 60, 28, { width: 300 });
      const businessLines = [[settings.address, settings.city].filter(Boolean).join(", "), settings.phone ? `Phone: ${settings.phone}` : "", settings.email ? `Email: ${settings.email}` : "", `PAN No.: ${settings.panNumber}`].filter(Boolean);
      doc.font("Helvetica").fontSize(8).fillColor("#526174").text(businessLines.join("\n"), margin + 60, 51, { width: 300, lineGap: 1 });
      doc.font("Helvetica-Bold").fontSize(20).fillColor("#14263d").text(continued ? "TAX INVOICE" : "TAX INVOICE", pageRight() - 155, 29, { width: 155, align: "right" });
      doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(continued ? "CONTINUED" : "CUSTOMER COPY", pageRight() - 155, 54, { width: 155, align: "right", characterSpacing: 0.7 });
      if (sale.status === "VOIDED") {
        doc.font("Helvetica-Bold").fontSize(11).fillColor("#b42318").text("VOIDED", pageRight() - 155, 68, { width: 155, align: "right" });
      }
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
      if (continued) return top + 43;
      return top + 70;
    };
    const columns = ["ITEM DESCRIPTION", "QTY", "UNIT PRICE (EX VAT)", "DISCOUNT", "TAXABLE", `VAT ${sale.taxRate.toString()}%`, "AMOUNT"];
    const widths = [136, 38, 64, 60, 70, 58, 85];
    const tableWidth = widths.reduce((sum, width) => sum + width, 0);
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
    const drawTableRow = (item: ReceiptDocumentSale["items"][number], top: number, alternate: boolean) => {
      const details = [item.sku ? `SKU ${item.sku}` : "", ...item.serialSnapshot.map((serial) => `IMEI/Serial ${serial}`)].filter(Boolean);
      const detailText = details.join(" | ");
      doc.font("Helvetica-Bold").fontSize(8);
      const nameHeight = doc.heightOfString(item.productName, { width: (widths[0] ?? 136) - 10 });
      doc.font("Helvetica").fontSize(7);
      const detailHeight = detailText ? doc.heightOfString(detailText, { width: (widths[0] ?? 136) - 10 }) : 0;
      const splitText = item.itemDiscount !== null && item.saleDiscount !== null
        ? [`Item discount ${money(item.itemDiscount)}`, Number(item.promoDiscount ?? 0) > 0 ? `Promo ${money(item.promoDiscount ?? 0)}` : "", `Sale discount ${money(item.saleDiscount)}`].filter(Boolean).join(" | ")
        : Number(item.discount) > 0 ? `Combined discount ${money(item.discount)} (legacy)` : "";
      const splitHeight = splitText ? doc.heightOfString(splitText, { width: (widths[0] ?? 136) - 10 }) : 0;
      const height = Math.max(30, nameHeight + detailHeight + splitHeight + 13);
      doc.rect(margin, top, tableWidth, height).fillAndStroke(alternate ? "#f8fafc" : "#ffffff", "#e2e8f0");
      let x = margin;
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#1f2937").text(item.productName, x + 5, top + 6, { width: (widths[0] ?? 136) - 10 });
      let detailY = top + 6 + nameHeight;
      if (detailText) {
        doc.font("Helvetica").fontSize(7).fillColor("#64748b").text(detailText, x + 5, detailY, { width: (widths[0] ?? 136) - 10 });
        detailY += detailHeight;
      }
      if (splitText) doc.font("Helvetica").fontSize(6.5).fillColor("#526174").text(splitText, x + 5, detailY, { width: (widths[0] ?? 136) - 10 });
      x += widths[0] ?? 136;
      const values = [String(item.quantity), money(item.unitPrice), money(item.discount), money(item.subtotal.minus(item.discount)), money(item.tax), money(item.total)];
      values.forEach((value, index) => {
        const columnIndex = index + 1;
        const width = widths[columnIndex] ?? 0;
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
      doc.font("Helvetica-Bold").fontSize(8);
      const details = [item.sku ? `SKU ${item.sku}` : "", ...item.serialSnapshot.map((serial) => `IMEI/Serial ${serial}`)].filter(Boolean).join(" | ");
      const estimated = Math.max(30, doc.heightOfString(item.productName, { width: (widths[0] ?? 136) - 10 }) + (details ? doc.heightOfString(details, { width: (widths[0] ?? 136) - 10 }) : 0) + 30);
      if (y + estimated > pageBottom() - 145) y = beginPage(true);
      y = drawTableRow(item, y, index % 2 === 1);
    }

    if (y + 208 > pageBottom()) y = beginPage(true);
    y += 20;
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#14263d").text("INVOICE TOTALS", margin, y);
    y += 19;
    const totals = [
      ["Subtotal", money(sale.subtotal), false],
      ["Discount", negativeMoney(sale.discount), false],
      ["Taxable amount", money(sale.subtotal.minus(sale.discount)), false],
      [`VAT (${sale.taxRate.toString()}%)`, money(sale.tax), false],
      ["TOTAL DUE", money(sale.total), true],
      ["Paid via", PAYMENT_METHOD_LABELS[sale.paymentMethod], false],
      ["Amount paid", money(sale.amountPaid), false],
      ...(sale.amountPaid.lt(sale.total) ? [["Balance due", money(sale.total.minus(sale.amountPaid)), true] as [string, string, boolean]] : []),
    ] as [string, string, boolean][];
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
    y = Math.max(y + 22, pageBottom() - 70);
    doc.strokeColor("#aeb9c6").moveTo(margin, y).lineTo(pageRight(), y).stroke();
    doc.font("Helvetica").fontSize(8).fillColor("#64748b").text(`Thank you for shopping at ${settings.shopName}.`, margin, y + 9, { width: 260 });
    const signatureLeft = pageRight() - 185;
    doc.font("Times-Italic").fontSize(20).fillColor("#14263d").text(fullName(sale.employee), signatureLeft, y - 19, { width: 185, align: "center" });
    doc.strokeColor("#526174").moveTo(signatureLeft + 12, y + 10).lineTo(pageRight() - 12, y + 10).stroke();
    doc.font("Helvetica").fontSize(7).fillColor("#64748b").text(`System-generated sign-off | ${fullName(sale.employee)}`, signatureLeft, y + 15, { width: 185, align: "center" });

    const pages = doc.bufferedPageRange();
    for (let page = pages.start; page < pages.start + pages.count; page += 1) {
      doc.switchToPage(page);
      const footerY = doc.page.height - 90;
      doc.strokeColor("#d8e1ec").moveTo(margin, footerY - 5).lineTo(pageRight(), footerY - 5).stroke();
      doc.font("Helvetica").fontSize(7).fillColor("#64748b").text(`${settings.shopName} | PAN No. ${settings.panNumber}`, margin, footerY, { width: 370, ellipsis: true, lineBreak: false });
      doc.text(`Page ${page + 1} of ${pages.count}`, pageRight() - 90, footerY, { width: 90, align: "right", lineBreak: false });
    }
    doc.end();
  });
}
