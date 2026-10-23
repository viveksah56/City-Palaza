import PDFDocument from "pdfkit";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { PERMISSION, hasPermission } from "@/lib/rbac/permission";
import { formatCurrency, formatDateTime, fullName } from "@/lib/format";
import { getSaleForUserBySlug } from "@/server/sales.service";
import { readSettings } from "@/server/settings.service";

function createReceipt(sale: NonNullable<Awaited<ReturnType<typeof getSaleForUserBySlug>>>, settings: Awaited<ReturnType<typeof readSettings>>) {
  return new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Receipt ${sale.saleNumber}`, Author: settings.shopName } });
    const chunks: Buffer[] = [];
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));

    const money = (value: unknown) => formatCurrency(String(value), settings.currency);
    const line = (label: string, value: string, bold = false) => {
      document.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor("#20242b");
      document.text(label, 48, document.y, { continued: true, width: 330 });
      document.text(value, { align: "right" });
      document.moveDown(0.35);
    };

    document.font("Helvetica-Bold").fontSize(20).fillColor("#111827").text(settings.shopName, { align: "center" });
    document.moveDown(0.25).font("Helvetica").fontSize(9).fillColor("#596273");
    document.text([settings.address, settings.city].filter(Boolean).join(", "), { align: "center" });
    document.text([settings.phone, settings.email].filter(Boolean).join(" · "), { align: "center" });
    document.moveDown(1).strokeColor("#d9dee7").moveTo(48, document.y).lineTo(547, document.y).stroke();
    document.moveDown(0.8).font("Helvetica-Bold").fontSize(15).fillColor("#111827").text("Sales receipt");
    document.moveDown(0.5);
    line("Sale number", sale.saleNumber, true);
    line("Date", formatDateTime(sale.createdAt));
    line("Served by", fullName(sale.employee));
    line("Customer", sale.customer?.name ?? "Walk-in");
    if (sale.status === "VOIDED") {
      document.moveDown(0.25).font("Helvetica-Bold").fontSize(12).fillColor("#b42318").text("VOIDED", { align: "center" });
      document.moveDown(0.4);
    }
    const columns = { itemX: 48, itemWidth: 252, quantityX: 310, quantityWidth: 42, priceX: 360, priceWidth: 86, totalX: 452, totalWidth: 95 };
    document.moveDown(0.4).font("Helvetica-Bold").fontSize(9).fillColor("#596273");
    const headerY = document.y;
    document.text("ITEM", columns.itemX, headerY, { width: columns.itemWidth });
    document.text("QTY", columns.quantityX, headerY, { width: columns.quantityWidth, align: "right" });
    document.text("PRICE", columns.priceX, headerY, { width: columns.priceWidth, align: "right" });
    document.text("TOTAL", columns.totalX, headerY, { width: columns.totalWidth, align: "right" });
    document.moveDown(0.35).strokeColor("#d9dee7").moveTo(48, document.y).lineTo(547, document.y).stroke().moveDown(0.45);
    for (const item of sale.items) {
      const details = [item.sku ? `SKU ${item.sku}` : "", ...item.serialSnapshot].filter(Boolean).join(" · ");
      document.font("Helvetica-Bold").fontSize(10);
      const nameHeight = document.heightOfString(item.productName, { width: columns.itemWidth });
      document.font("Helvetica").fontSize(8);
      const detailsHeight = details ? document.heightOfString(details, { width: columns.itemWidth }) : 0;
      const rowHeight = Math.max(nameHeight + detailsHeight, document.currentLineHeight()) + 11;
      if (document.y + rowHeight > document.page.height - document.page.margins.bottom - 30) document.addPage();
      const top = document.y;
      document.font("Helvetica-Bold").fontSize(10).fillColor("#20242b").text(item.productName, columns.itemX, top, { width: columns.itemWidth });
      if (details) document.font("Helvetica").fontSize(8).fillColor("#596273").text(details, columns.itemX, top + nameHeight, { width: columns.itemWidth });
      document.font("Helvetica").fontSize(9).fillColor("#20242b").text(String(item.quantity), columns.quantityX, top, { width: columns.quantityWidth, align: "right" });
      document.text(money(item.unitPrice), columns.priceX, top, { width: columns.priceWidth, align: "right" });
      document.text(money(item.total), columns.totalX, top, { width: columns.totalWidth, align: "right" });
      document.y = top + rowHeight;
    }
    document.moveDown(0.5).strokeColor("#d9dee7").moveTo(48, document.y).lineTo(547, document.y).stroke().moveDown(0.7);
    line("Subtotal", money(sale.subtotal));
    line("Discount", `-${money(sale.discount)}`);
    line(`Tax (${sale.taxRate.toString()}%)`, money(sale.tax));
    line("Total", money(sale.total), true);
    line("Payment", sale.paymentMethod.replaceAll("_", " "));
    line("Payment status", sale.paymentStatus);
    line("Collected", money(sale.amountPaid));
    if (sale.amountPaid.lt(sale.total)) line("Balance due", money(sale.total.minus(sale.amountPaid)));
    if (sale.payments.length > 1) {
      document.moveDown(0.4).font("Helvetica-Bold").fontSize(9).fillColor("#20242b").text("Payment history");
      for (const payment of sale.payments) line(`${payment.receivedAt.toLocaleDateString("en-GB")} · ${payment.method.replaceAll("_", " ")}`, money(payment.amount));
    }
    document.moveDown(1).font("Helvetica").fontSize(9).fillColor("#596273").text(`Thank you for shopping at ${settings.shopName}.`, { align: "center" });
    document.end();
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!hasPermission(user.role, PERMISSION.SALE_VIEW)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { slug } = await params;
  const sale = await getSaleForUserBySlug(user, slug);
  if (!sale) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const settings = await readSettings();
  const pdf = await createReceipt(sale, settings);
  const filename = `receipt-${sale.saleNumber.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
