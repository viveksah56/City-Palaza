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

  it("rolls everything back when one line lacks stock", async () => {
    const f = await fixtures();
    const a = await f.mk("OK"); const b = await f.mk("SHORT");
    await inv.addStock(f.admin, { productId: a.id, type: "PURCHASE", quantity: 5, reason: "t" });
    await inv.addStock(f.admin, { productId: b.id, type: "PURCHASE", quantity: 1, reason: "t" });
    await expect(sales.createSale(f.emp, { items: [{ productId: a.id, quantity: 2 }, { productId: b.id, quantity: 2 }], paymentMethod: "CASH" })).rejects.toThrow(/stock/i);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: a.id } })).quantity).toBe(5);
    expect(await prisma.sale.count()).toBe(0);
  });

  it("stock can't go negative via adjustments either", async () => {
    const f = await fixtures();
    const p = await f.mk("NEG");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 2, reason: "t" });
    await expect(inv.adjustStock(f.admin, { productId: p.id, type: "DAMAGE", quantity: 3, reason: "dropped" })).rejects.toThrow(/stock/i);
    await expect(prisma.$executeRawUnsafe(`UPDATE "Product" SET quantity = -1 WHERE id = '${p.id}'`)).rejects.toThrow(); // CHECK constraint
  });

  it("requires a reason for adjustments and records it", async () => {
    const f = await fixtures();
    const p = await f.mk("ADJ");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 5, reason: "t" });
    await expect(inv.adjustStock(f.admin, { productId: p.id, type: "LOST", quantity: 1, reason: " " })).rejects.toThrow(/reason/i);
    await inv.adjustStock(f.admin, { productId: p.id, type: "LOST", quantity: 1, reason: "stolen from display" });
    expect((await prisma.inventoryTransaction.findFirstOrThrow({ where: { type: "LOST" } })).reason).toBe("stolen from display");
  });

  it("enforces unique SKU and barcode", async () => {
    const f = await fixtures();
    const base = { name: "X", categoryId: f.category.id, purchasePrice: 1, sellingPrice: 2, discountPercent: 0, minStock: 1, trackingType: "QUANTITY", status: "ACTIVE" };
    await products.createProduct(f.admin, { ...base, sku: "DUP", barcode: "123" });
    await expect(products.createProduct(f.admin, { ...base, sku: "dup" })).rejects.toMatchObject({ code: "P2002" }); // SKU is upper-cased
    await expect(products.createProduct(f.admin, { ...base, sku: "OTHER", barcode: "123" })).rejects.toMatchObject({ code: "P2002" });
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
  });

  it("enforces the employee discount limit on the server; admin is unrestricted", async () => {
    const f = await fixtures();
    const p = await f.mk("DSC");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 10, reason: "t" });
    await prisma.setting.create({ data: { key: "employeeDiscountLimit", value: 5 } });
    const ok = { items: [{ productId: p.id, quantity: 1 }], paymentMethod: "CASH" as const };
    await sales.createSale(f.emp, { ...ok, discount: { type: "PERCENT", value: 5 } });
    await expect(sales.createSale(f.emp, { ...ok, discount: { type: "PERCENT", value: 10 } })).rejects.toThrow(/admin/);
    await expect(sales.createSale(f.emp, { ...ok, discount: { type: "FIXED", value: 200 } })).rejects.toThrow(/admin/);
    await sales.createSale(f.admin, { ...ok, discount: { type: "PERCENT", value: 30 } });
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
});
