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
  total: D("2772.00"),
  paymentMethod: "ESEWA",
  paymentStatus: "PAID",
  amountPaid: D("2772.00"),
  amountTendered: null,
  changeGiven: null,
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
    total: D("2772.00"),
    imei2Snapshot: [],
    warranties: [],
  }],
  payments: [{ id: "payment-1", receivedAt: new Date("2026-10-23T15:25:00.000Z"), method: "ESEWA", amount: D("2772.00") }],
};

const settings = {
  shopName: "CityPlaza",
  address: "Mirchiaya",
  city: "Sirahah",
  phone: "+977-9800000000",
  email: "cityplaza@example.com",
  currency: "NPR",
  receiptFooter: "Thank you!",
  warrantyTerms: "Covers manufacturing defects only.",
  invoicePrefix: "CP",
  employeeDiscountLimit: 5,
  employeeMaxTotalDiscountPercent: null,
};

describe("receipt PDF", () => {
  it("includes the invoice and separated product/sale discount data in a valid PDF", async () => {
    const pdf = await createReceiptPdf(sale, settings);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(2_000);
    expect(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
    if (process.env.RECEIPT_PREVIEW_PATH) await writeFile(process.env.RECEIPT_PREVIEW_PATH, pdf);
  });

  it("renders an 80mm roll-width PDF with IMEI 1/2 and warranty lines", async () => {
    const phone: ReceiptDocumentSale = {
      ...sale,
      subtotal: D("45000.00"), discount: D("0.00"), total: D("45000.00"), amountPaid: D("45000.00"),
      paymentMethod: "CASH", amountTendered: D("50000.00"), changeGiven: D("5000.00"),
      items: [{
        id: "item-2", productName: "Galaxy S24 · 8 GB · 256 GB · Black", sku: "SG-S24", quantity: 1,
        serialSnapshot: ["356938035643809"], imei2Snapshot: ["356938035643817"],
        unitPrice: D("45000.00"), subtotal: D("45000.00"), discount: D("0.00"), promoDiscount: D("0.00"), itemDiscount: D("0.00"), saleDiscount: D("0.00"), total: D("45000.00"),
        warranties: [{ tag: "CP-000078-W1", endsAt: new Date("2027-10-23T00:00:00.000Z"), status: "ACTIVE" }],
      }],
    };
    const pdf = await createReceiptPdf(phone, settings, "thermal");
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
    // MediaBox: 80 mm ≈ 227 pt wide, and a short single roll "page" rather than A4 (842 pt)
    const box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(pdf.toString("latin1"));
    expect(Number(box?.[1])).toBeCloseTo(227, 0);
    expect(Number(box?.[2])).toBeLessThan(600);
  });

  it("contains no PAN/VAT wording", async () => {
    const pdf = await createReceiptPdf(sale, settings);
    expect(pdf.toString("latin1")).not.toMatch(/\bVAT\b|\bPAN\b/i);
  });
});
