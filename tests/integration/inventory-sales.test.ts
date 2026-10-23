import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TEST_DB, prisma, resetDb, fixtures } from "./helpers";

// Needs a real PostgreSQL: set TEST_DATABASE_URL (schema pushed + `npm run db:constraints`).
describe.skipIf(!TEST_DB)("inventory & sales (PostgreSQL)", () => {
  let inv: typeof import("@/server/inventory.service");
  let sales: typeof import("@/server/sales.service");
  let products: typeof import("@/server/products.service");
  let employees: typeof import("@/server/employees.service");

  beforeEach(async () => {
    inv = await import("@/server/inventory.service");
    sales = await import("@/server/sales.service");
    products = await import("@/server/products.service");
    employees = await import("@/server/employees.service");
    await resetDb();
  });
  afterAll(() => prisma.$disconnect());

  it("creates a sale: totals, historical prices, deduction and inventory transaction", async () => {
    const f = await fixtures();
    const p = await f.mk("A1");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 10, reason: "test" });

    const sale = await sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 3 }], paymentMethod: "CASH" });

    const row = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id }, include: { items: true } });
    expect(row.total.toString()).toBe("3000");
    expect(row.items[0]!.unitCost.toString()).toBe("800");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).quantity).toBe(7);
    const tx = await prisma.inventoryTransaction.findFirstOrThrow({ where: { productId: p.id, type: "SALE" } });
    expect([tx.quantity, tx.previousQuantity, tx.newQuantity, tx.referenceId]).toEqual([-3, 10, 7, sale.id]);
    expect(await prisma.auditLog.count({ where: { action: "SALE_CREATE" } })).toBe(1);

    // later price change must not alter history
    await prisma.product.update({ where: { id: p.id }, data: { sellingPrice: "5000", purchasePrice: "4000" } });
    const again = await prisma.saleItem.findFirstOrThrow({ where: { saleId: sale.id } });
    expect(again.unitPrice.toString()).toBe("1000");
  });

  it("never oversells: two simultaneous sales of the last unit → exactly one succeeds", async () => {
    const f = await fixtures();
    const p = await f.mk("RACE");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 1, reason: "last one" });

    const results = await Promise.allSettled([
      sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 1 }], paymentMethod: "CASH" }),
      sales.createSale(f.admin, { items: [{ productId: p.id, quantity: 1 }], paymentMethod: "CASH" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).quantity).toBe(0);
    expect(await prisma.sale.count()).toBe(1); // the loser rolled back completely
    expect(await prisma.saleItem.count()).toBe(1);
  });

  it("never oversells: ten simultaneous sales of the last unit → exactly one succeeds", async () => {
    const f = await fixtures();
    const p = await f.mk("RACE10");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 1, reason: "last one" });
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, index) =>
      sales.createSale(index % 2 ? f.admin : f.emp, { items: [{ productId: p.id, quantity: 1 }], paymentMethod: "CASH" }),
    ));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).quantity).toBe(0);
    expect(await prisma.sale.count()).toBe(1);
    expect(await prisma.inventoryTransaction.count({ where: { type: "SALE" } })).toBe(1);
  });

  it("rolls everything back when one line lacks stock", async () => {
    const f = await fixtures();
    const a = await f.mk("OK"); const b = await f.mk("SHORT");
    await inv.addStock(f.admin, { productId: a.id, type: "PURCHASE", quantity: 5, reason: "t" });
    await inv.addStock(f.admin, { productId: b.id, type: "PURCHASE", quantity: 1, reason: "t" });
    await expect(sales.createSale(f.emp, { items: [{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 2 }], paymentMethod: "CASH" })).rejects.toThrow(/stock/i);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: a.id } })).quantity).toBe(5);
    expect(await prisma.sale.count()).toBe(0);
    expect(await prisma.saleItem.count()).toBe(0);
    expect(await prisma.inventoryTransaction.count({ where: { type: "SALE" } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "SALE_CREATE" } })).toBe(0);
  });

  it("stock can't go negative via adjustments either", async () => {
    const f = await fixtures();
    const p = await f.mk("NEG");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 2, reason: "t" });
    await expect(inv.adjustStock(f.admin, { productId: p.id, type: "DAMAGE", quantity: 3, reason: "dropped" })).rejects.toThrow(/stock/i);
    await expect(prisma.$executeRawUnsafe(`UPDATE "citypalaza_database"."Product" SET quantity = -1 WHERE id = '${p.id}'`)).rejects.toThrow();
  });

  it("requires a reason for adjustments and records it", async () => {
    const f = await fixtures();
    const p = await f.mk("ADJ");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 5, reason: "t" });
    await expect(inv.adjustStock(f.admin, { productId: p.id, type: "LOST", quantity: 1, reason: " " })).rejects.toThrow(/reason/i);
    await inv.adjustStock(f.admin, { productId: p.id, type: "LOST", quantity: 1, reason: "stolen from display" });
    expect((await prisma.inventoryTransaction.findFirstOrThrow({ where: { type: "LOST" } })).reason).toBe("stolen from display");
  });

  it("records an inventory ledger row for each stock increase and adjustment", async () => {
    const f = await fixtures();
    const p = await f.mk("LEDGER");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 5, reason: "received" });
    await inv.adjustStock(f.admin, { productId: p.id, type: "ADJUSTMENT", direction: "INCREASE", quantity: 2, reason: "count correction" });
    await inv.adjustStock(f.admin, { productId: p.id, type: "ADJUSTMENT", direction: "DECREASE", quantity: 1, reason: "count correction" });
    const rows = await prisma.inventoryTransaction.findMany({ where: { productId: p.id }, orderBy: { createdAt: "asc" } });
    expect(rows.map((row) => [row.quantity, row.previousQuantity, row.newQuantity])).toEqual([[5, 0, 5], [2, 5, 7], [-1, 7, 6]]);
  });

  it("rejects count adjustments for serialized products and requires a valid IMEI", async () => {
    const f = await fixtures();
    const phone = await f.mk("SERADJ", { trackingType: "IMEI" });
    await expect(inv.adjustStock(f.admin, { productId: phone.id, type: "ADJUSTMENT", direction: "INCREASE", quantity: 1, reason: "count" })).rejects.toThrow(/serialized products can't be adjusted by count/i);
    await expect(inv.addStock(f.admin, { productId: phone.id, type: "PURCHASE", serials: ["12345678901234"] })).rejects.toThrow(/IMEI/i);
  });

  it("enforces unique SKU and barcode", async () => {
    const f = await fixtures();
    const base = { name: "Test item", categoryId: f.category.id, purchasePrice: 1, sellingPrice: 2, discountPercent: 0, minStock: 1, trackingType: "QUANTITY", status: "ACTIVE" };
    await products.createProduct(f.admin, { ...base, sku: "DUP", barcode: "123" });
    expect((await prisma.product.findUniqueOrThrow({ where: { sku: "DUP" } })).sku).toBe("DUP");
    await expect(products.createProduct(f.admin, { ...base, sku: "dup" })).rejects.toMatchObject({ code: "P2002" }); // SKU is upper-cased
    await expect(products.createProduct(f.admin, { ...base, sku: "OTHER", barcode: "123" })).rejects.toMatchObject({ code: "P2002" });
  });

  it("keeps purchase cost private for employee product lists and detail", async () => {
    const f = await fixtures();
    const p = await f.mk("PRIVATE");
    const query = { page: 1, pageSize: 20, skip: 0, take: 20, sort: "name", order: "asc" as const };
    const employeeList = await products.listProducts(query, false);
    const adminList = await products.listProducts(query, true);
    const employeeRow = employeeList.rows.find((row) => row.id === p.id)!;
    const adminRow = adminList.rows.find((row) => row.id === p.id)!;
    expect(employeeRow).not.toHaveProperty("purchasePrice");
    expect(adminRow.purchasePrice).toBe("800");
    expect(await products.getProductBySlug(p.slug, false)).not.toHaveProperty("purchasePrice");
  });

  it("does not allow tracking mode changes after stock exists and blocks deleting history", async () => {
    const f = await fixtures();
    const p = await f.mk("LOCKTRACK");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 1, reason: "test" });
    const { categoryId, name, purchasePrice, sellingPrice } = p;
    await expect(products.updateProduct(f.admin, p.id, {
      sku: p.sku, name, categoryId, purchasePrice: Number(purchasePrice), sellingPrice: Number(sellingPrice), discountPercent: 0,
      minStock: p.minStock, trackingType: "IMEI", status: "ACTIVE",
    })).rejects.toThrow(/tracking type can't be changed/i);
    await expect(products.deleteProduct(f.admin, p.id)).rejects.toThrow(/history/i);
  });

  it("IMEIs are unique and a sold IMEI can never be sold again", async () => {
    const f = await fixtures();
    const { imeiFromBody } = await import("@/lib/imei");
    const imei = imeiFromBody("35000000000010");
    const p = await f.mk("PH1", { trackingType: "IMEI" });
    const q = await f.mk("PH2", { trackingType: "IMEI" });
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", serials: [imei] });
    await expect(inv.addStock(f.admin, { productId: q.id, type: "PURCHASE", serials: [imei] })).rejects.toThrow(/Already registered/);

    await sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 1, serials: [imei] }], paymentMethod: "CASH" });
    expect((await prisma.productSerial.findUniqueOrThrow({ where: { serial: imei } })).status).toBe("SOLD");
    await expect(sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 1, serials: [imei] }], paymentMethod: "CASH" })).rejects.toThrow(/stock|available/i);
  });

  it("atomically allows only one parallel sale of the same IMEI", async () => {
    const f = await fixtures();
    const { imeiFromBody } = await import("@/lib/imei");
    const imei = imeiFromBody("35000000000030");
    const phone = await f.mk("PHRACE", { trackingType: "IMEI" });
    await inv.addStock(f.admin, { productId: phone.id, type: "PURCHASE", serials: [imei] });
    const results = await Promise.allSettled([
      sales.createSale(f.emp, { items: [{ productId: phone.id, quantity: 1, serials: [imei] }], paymentMethod: "CASH" }),
      sales.createSale(f.admin, { items: [{ productId: phone.id, quantity: 1, serials: [imei] }], paymentMethod: "CASH" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.sale.count()).toBe(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: phone.id } })).quantity).toBe(0);
    expect((await prisma.productSerial.findUniqueOrThrow({ where: { serial: imei } })).status).toBe("SOLD");
  });

  it("voiding restores stock and IMEI status, writes a reversal and audit, and can't be repeated", async () => {
    const f = await fixtures();
    const { imeiFromBody } = await import("@/lib/imei");
    const imei = imeiFromBody("35000000000020");
    const phone = await f.mk("PH3", { trackingType: "IMEI" });
    const cable = await f.mk("CBL");
    await inv.addStock(f.admin, { productId: phone.id, type: "PURCHASE", serials: [imei] });
    await inv.addStock(f.admin, { productId: cable.id, type: "PURCHASE", quantity: 5, reason: "t" });
    const sale = await sales.createSale(f.emp, { items: [{ productId: phone.id, quantity: 1, serials: [imei] }, { productId: cable.id, quantity: 2 }], paymentMethod: "ESEWA" });

    await sales.voidSale(f.admin, { saleId: sale.id, reason: "wrong item" });

    expect((await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } })).status).toBe("VOIDED");
    expect((await prisma.product.findUniqueOrThrow({ where: { id: cable.id } })).quantity).toBe(5);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: phone.id } })).quantity).toBe(1);
    expect((await prisma.productSerial.findUniqueOrThrow({ where: { serial: imei } })).status).toBe("IN_STOCK");
    expect(await prisma.inventoryTransaction.count({ where: { referenceType: "SALE_VOID", referenceId: sale.id } })).toBe(2);
    expect(await prisma.auditLog.count({ where: { action: "SALE_VOID" } })).toBe(1);
    await expect(sales.voidSale(f.admin, { saleId: sale.id, reason: "again please" })).rejects.toThrow(/already/i);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: cable.id } })).quantity).toBe(5); // not restored twice
    await expect(sales.voidSale(f.admin, { saleId: sale.id, reason: "" })).rejects.toThrow(); // reason required
    const resale = await sales.createSale(f.emp, { items: [{ productId: phone.id, quantity: 1, serials: [imei] }], paymentMethod: "CASH" });
    expect(resale.id).not.toBe(sale.id);
    const originalReceiptData = await sales.getSaleForUserBySlug(f.admin, sale.slug);
    expect(originalReceiptData?.items.flatMap((item) => item.serialSnapshot)).toContain(imei);
  });

  it("concurrent voids restore stock once and mark an unpaid sale refunded", async () => {
    const f = await fixtures();
    const p = await f.mk("VOIDRACE");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 2, reason: "test" });
    const sale = await sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 1 }], paymentMethod: "CASH", paymentStatus: "PENDING" });
    const results = await Promise.allSettled([
      sales.voidSale(f.admin, { saleId: sale.id, reason: "duplicate sale" }),
      sales.voidSale(f.admin, { saleId: sale.id, reason: "duplicate sale" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.id } })).quantity).toBe(2);
    const row = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } });
    expect(row.paymentStatus).toBe("REFUNDED");
    expect(row.amountPaid.toString()).toBe("0");
    expect(await prisma.auditLog.count({ where: { action: "SALE_VOID" } })).toBe(1);
  });

  it("validates payment states and allows walk-in credit sales", async () => {
    const f = await fixtures();
    const p = await f.mk("PAYMENTS");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 10, reason: "test" });
    const base = { items: [{ productId: p.id, quantity: 1 }], paymentMethod: "CASH" as const };
    const pending = await sales.createSale(f.emp, { ...base, paymentStatus: "PENDING" });
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: pending.id } })).amountPaid.toString()).toBe("0");
    const partial = await sales.createSale(f.emp, { ...base, paymentStatus: "PARTIAL", amountPaid: 400 });
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: partial.id } })).amountPaid.toString()).toBe("400");
    await expect(sales.createSale(f.emp, { ...base, paymentStatus: "PARTIAL", amountPaid: 0 })).rejects.toThrow(/partial payment/i);
    await expect(sales.createSale(f.emp, { ...base, paymentStatus: "PARTIAL", amountPaid: 1000 })).rejects.toThrow(/partial payment/i);
    await expect(sales.createSale(f.emp, { ...base, paymentStatus: "REFUNDED" })).rejects.toThrow(/refunded/i);
    await expect(sales.createSale(f.emp, { ...base, paymentStatus: "PARTIAL", amountPaid: 1 })).resolves.toBeDefined();
  });

  it("allows zero-total paid and pending sales but rejects a zero-total partial payment", async () => {
    const f = await fixtures();
    const p = await f.mk("FREE", { purchasePrice: "0.00", sellingPrice: "0.00", discountPercent: "100.00" });
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 3, reason: "test" });
    const base = { items: [{ productId: p.id, quantity: 1 }], paymentMethod: "CASH" as const };
    const paid = await sales.createSale(f.emp, { ...base, paymentStatus: "PAID" });
    const pending = await sales.createSale(f.emp, { ...base, paymentStatus: "PENDING" });
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: paid.id } })).amountPaid.toString()).toBe("0");
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: pending.id } })).amountPaid.toString()).toBe("0");
    await expect(sales.createSale(f.emp, { ...base, paymentStatus: "PARTIAL", amountPaid: 0.01 })).rejects.toThrow(/partial payment/i);
  });

  it("keeps sale numbers unique and gap-free when a failed sale rolls back", async () => {
    const f = await fixtures();
    const p = await f.mk("COUNTER");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 3, reason: "test" });
    const first = await sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 1 }], paymentMethod: "CASH" });
    await expect(sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 99 }], paymentMethod: "CASH" })).rejects.toThrow(/stock/i);
    const second = await sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 1 }], paymentMethod: "CASH" });
    expect(first.saleNumber).toMatch(/000001$/);
    expect(second.saleNumber).toMatch(/000002$/);
    expect(await prisma.sale.count({ where: { saleNumber: { in: [first.saleNumber, second.saleNumber] } } })).toBe(2);
  });

  it("enforces the employee discount limit on the server; admin is unrestricted", async () => {
    const f = await fixtures();
    const p = await f.mk("DSC");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 10, reason: "t" });
    await prisma.setting.create({ data: { key: "employeeDiscountLimit", value: 5 } });
    const ok = { items: [{ productId: p.id, quantity: 1 }], paymentMethod: "CASH" as const };
    await sales.createSale(f.emp, { ...ok, discount: { type: "PERCENT", value: 5 } });
    await expect(sales.createSale(f.emp, { ...ok, discount: { type: "PERCENT", value: 10 } })).rejects.toThrow(/discount limit|maximum allowed/i);
    await expect(sales.createSale(f.emp, { ...ok, discount: { type: "FIXED", value: 200 } })).rejects.toThrow(/discount limit|maximum allowed/i);
    await sales.createSale(f.admin, { ...ok, discount: { type: "PERCENT", value: 30 } });
  });

  it("stores the new sale discount split and checks the optional effective discount ceiling", async () => {
    const f = await fixtures();
    const p = await f.mk("SPLIT", { discountPercent: "10.00" });
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 10, reason: "test" });
    await prisma.setting.create({ data: { key: "employeeMaxTotalDiscountPercent", value: 15 } });
    const sale = await sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 1, discount: { type: "FIXED", value: 20 } }], paymentMethod: "CASH" });
    const saved = await prisma.sale.findUniqueOrThrow({ where: { id: sale.id }, include: { items: true } });
    expect(saved.promoDiscount?.toString()).toBe("100");
    expect(saved.manualDiscount?.toString()).toBe("20");
    expect(saved.items[0]!.promoDiscount?.toString()).toBe("100");
    expect(saved.items[0]!.saleDiscount?.toString()).toBe("20");
    await prisma.setting.update({ where: { key: "employeeMaxTotalDiscountPercent" }, data: { value: 12 } });
    await expect(sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 1, discount: { type: "PERCENT", value: 5 } }], paymentMethod: "CASH" })).rejects.toThrow(/total discount/i);
    await prisma.setting.delete({ where: { key: "employeeMaxTotalDiscountPercent" } });
    await expect(sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 1, discount: { type: "PERCENT", value: 5 } }], paymentMethod: "CASH" })).resolves.toBeDefined();
  });

  it("blocks employees from selling below cost while allowing an audited admin sale", async () => {
    const f = await fixtures();
    const p = await f.mk("COST", { purchasePrice: "1200.00" });
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 2, reason: "test" });
    await expect(sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 1 }], paymentMethod: "CASH" })).rejects.toMatchObject({ code: "DISCOUNT_NOT_ALLOWED", message: "This discount needs admin approval." });
    const sale = await sales.createSale(f.admin, { items: [{ productId: p.id, quantity: 1 }], paymentMethod: "CASH" });
    expect(await prisma.auditLog.findFirstOrThrow({ where: { entityId: sale.id } })).toMatchObject({ description: expect.stringContaining("sold below cost") });
  });

  it("keeps legacy manual discount reports unknown when split fields are null", async () => {
    const f = await fixtures();
    const p = await f.mk("LEGACY");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 1, reason: "test" });
    const sale = await sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 1 }], paymentMethod: "CASH" });
    await prisma.sale.update({ where: { id: sale.id }, data: { promoDiscount: null, manualDiscount: null } });
    await prisma.saleItem.updateMany({ where: { saleId: sale.id }, data: { promoDiscount: null, saleDiscount: null } });
    const { getEmployeePerformance } = await import("@/server/reports.service");
    const rows = await getEmployeePerformance({ from: new Date(0), to: new Date(Date.now() + 60_000) });
    expect(rows.find((row) => row.id === f.emp.id)?.discounts).toBeNull();
  });

  it("ignores any client-side price: totals come from the database", async () => {
    const f = await fixtures();
    const p = await f.mk("TRUST");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 2, reason: "t" });
    const s = await sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 1, price: 1 }], total: 1, paymentMethod: "CASH" });
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: s.id } })).total.toString()).toBe("1000");
  });

  it("employees only see their own sales", async () => {
    const f = await fixtures();
    const p = await f.mk("OWN");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 5, reason: "t" });
    const mine = await sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 1 }], paymentMethod: "CASH" });
    const theirs = await sales.createSale(f.admin, { items: [{ productId: p.id, quantity: 1 }], paymentMethod: "CASH" });
    const list = await sales.listSales(f.emp, sales.parseSalesQuery({ range: "thisYear" }));
    expect(list.rows.map((r) => r.id)).toEqual([mine.id]);
    expect(await sales.getSaleForUser(f.emp, theirs.id)).toBeNull();
    expect(await sales.getSaleForUser(f.admin, mine.id)).not.toBeNull();
  });

  it("disabled employees keep their history and lose their sessions", async () => {
    const f = await fixtures();
    await prisma.session.create({ data: { userId: f.emp.id, expiresAt: new Date(Date.now() + 1e6) } });
    await employees.setEmployeeStatus(f.admin, f.emp.id, "INACTIVE");
    expect(await prisma.session.count({ where: { userId: f.emp.id } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: f.emp.id } })).status).toBe("INACTIVE");
    await expect(employees.setEmployeeStatus(f.admin, f.admin.id, "INACTIVE")).rejects.toThrow(/own account/);
  });

  it("revokes sessions after an employee role change", async () => {
    const f = await fixtures();
    await prisma.session.create({ data: { userId: f.emp.id, expiresAt: new Date(Date.now() + 1e6) } });
    await employees.updateEmployee(f.admin, { id: f.emp.id, firstName: "Eve", lastName: "Emp", email: "emp@t.local", role: "ADMIN" });
    expect(await prisma.session.count({ where: { userId: f.emp.id } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: f.emp.id } })).role).toBe("ADMIN");
    expect(await prisma.auditLog.count({ where: { entityId: f.emp.id, action: "EMPLOYEE_UPDATE" } })).toBe(1);
  });
});
