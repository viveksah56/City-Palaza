import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { D } from "@/lib/money";
import { createReceiptPdf, type ReceiptDocumentSale } from "@/server/receipt-document";

const sale: ReceiptDocumentSale = {
  saleNumber: "CP-000077",
  createdAt: new Date("2026-10-23T15:25:00.000Z"),
  status: "COMPLETED",
  voidReason: null,
  subtotal: D("3600.00"),
  discount: D("828.00"),
  taxRate: D("13.00"),
  tax: D("360.36"),
  total: D("3132.36"),
  paymentMethod: "ESEWA",
  paymentStatus: "PAID",
  amountPaid: D("3132.36"),
  employee: { firstName: "Sita", lastName: "Sharma" },
  customer: { name: "Aarav Rai", phone: "9800000000", email: "aarav@example.com", address: "Mirchiya, Siraha" },
  items: [{
    id: "item-1",
    productName: "Anker USB-C to USB-C Cable 1m",
    sku: "AN-CBL-C2C",
    serialSnapshot: [],
    quantity: 3,
    unitPrice: D("1200.00"),
    subtotal: D("3600.00"),
    discount: D("828.00"),
    promoDiscount: D("0.00"),
    itemDiscount: D("100.00"),
    saleDiscount: D("728.00"),
    tax: D("360.36"),
    total: D("3132.36"),
  }],
  payments: [{ id: "payment-1", receivedAt: new Date("2026-10-23T15:25:00.000Z"), method: "ESEWA", amount: D("3132.36") }],
};

const settings = {
  shopName: "CityPlaza",
  address: "Mirchiaya",
  city: "Sirahah",
  phone: "+977-9800000000",
  email: "cityplaza@example.com",
  panNumber: "612865374",
  currency: "NPR",
  taxRate: 13,
  invoicePrefix: "CP",
  employeeDiscountLimit: 5,
  employeeMaxTotalDiscountPercent: null,
};

describe("VAT receipt PDF", () => {
  it("includes the invoice and separated product/sale discount data in a valid PDF", async () => {
    const pdf = await createReceiptPdf(sale, settings);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(2_000);
    expect(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
    if (process.env.RECEIPT_PREVIEW_PATH) await writeFile(process.env.RECEIPT_PREVIEW_PATH, pdf);
  });
});
