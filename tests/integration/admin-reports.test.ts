import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TEST_DB, prisma, resetDb, fixtures } from "./helpers";
import { createHash } from "node:crypto";
import { verifyPassword } from "@/lib/auth/password";
import { consumePasswordReset } from "@/lib/auth/password-reset";

describe.skipIf(!TEST_DB)("admin rules, settings and reports (PostgreSQL)", () => {
  let inv: typeof import("@/server/inventory.service");
  let sales: typeof import("@/server/sales.service");
  let employees: typeof import("@/server/employees.service");
  let reports: typeof import("@/server/reports.service");
  let settings: typeof import("@/server/settings.service");

  beforeEach(async () => {
    inv = await import("@/server/inventory.service");
    sales = await import("@/server/sales.service");
    employees = await import("@/server/employees.service");
    reports = await import("@/server/reports.service");
    settings = await import("@/server/settings.service");
    await resetDb();
  });

  afterAll(() => prisma.$disconnect());

  it("reports completed unpaid sales as sales revenue and excludes voided sales", async () => {
    const f = await fixtures();
    const p = await f.mk("REPORT");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 5, reason: "test" });
    await prisma.setting.create({ data: { key: "taxRate", value: 13 } });
    const paid = await sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 1 }], paymentMethod: "CASH" });
    const pending = await sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 1 }], paymentMethod: "CASH", paymentStatus: "PENDING" });
    const voided = await sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 1 }], paymentMethod: "CASH" });
    await sales.voidSale(f.admin, { saleId: voided.id, reason: "incorrect sale" });
    const range = { from: new Date(Date.now() - 60_000), to: new Date(Date.now() + 60_000) };
    const summary = await reports.getSalesSummary(range);
    expect(summary).toMatchObject({ count: 2, grossSales: "2000.00", discounts: "0.00", netSales: "2000.00", taxes: "260.00", total: "2260.00", averageSale: "1130.00" });
    expect(await reports.getProfitSummary(range)).toMatchObject({ revenue: "2000.00", cost: "1600.00", profit: "400.00", marginPercent: "20.0" });
    expect(await reports.getSalesByCategory(range)).toEqual([{ name: "Phones", revenue: "2000.00", units: 2 }]);
    expect(await reports.getPaymentDistribution(range)).toEqual([{ method: "CASH", count: 2, total: "2260.00" }]);
    expect(await reports.getEmployeePerformance(range)).toEqual([expect.objectContaining({ id: f.emp.id, sales: 2, units: 2, revenue: "2000.00", profit: "400.00", average: "1130.00" })]);
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: paid.id } })).amountPaid.toString()).toBe("1130");
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: pending.id } })).amountPaid.toString()).toBe("0");
  });

  it("reports only active inventory and records setting changes in audit", async () => {
    const f = await fixtures();
    const active = await f.mk("ACTIVE", { purchasePrice: "100.00", sellingPrice: "150.00" });
    const inactive = await f.mk("INACTIVE", { purchasePrice: "100.00", sellingPrice: "150.00", status: "INACTIVE" });
    await inv.addStock(f.admin, { productId: active.id, type: "PURCHASE", quantity: 2, reason: "test" });
    await inv.addStock(f.admin, { productId: inactive.id, type: "PURCHASE", quantity: 4, reason: "test" });
    const summary = await reports.getInventorySummary();
    expect(summary).toMatchObject({ products: 1, units: 2, costValue: "200.00", sellingValue: "300.00", potentialProfit: "100.00" });
    await settings.updateSettings(f.admin, { ...settings.DEFAULT_SETTINGS, taxRate: 13 });
    expect(await prisma.setting.findUniqueOrThrow({ where: { key: "taxRate" } })).toMatchObject({ value: 13 });
    expect(await prisma.auditLog.count({ where: { action: "SETTINGS_UPDATE" } })).toBe(1);
    const sale = await sales.createSale(f.emp, { items: [{ productId: active.id, quantity: 1 }], paymentMethod: "CASH" });
    expect((await prisma.sale.findUniqueOrThrow({ where: { id: sale.id } })).tax.toString()).toBe("19.5");
  });

  it("recomputes a customer's last purchase timestamp when the newest sale is voided", async () => {
    const f = await fixtures();
    const p = await f.mk("CUSTOMER-LAST");
    await inv.addStock(f.admin, { productId: p.id, type: "PURCHASE", quantity: 3, reason: "test" });
    const customer = await prisma.customer.create({ data: { slug: "report-customer", name: "Report Customer" } });
    const first = await sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 1 }], customerId: customer.id, paymentMethod: "CASH" });
    const firstAt = new Date("2026-01-01T12:00:00.000Z");
    await prisma.sale.update({ where: { id: first.id }, data: { createdAt: firstAt } });
    await prisma.customer.update({ where: { id: customer.id }, data: { lastPurchaseAt: firstAt } });
    const newest = await sales.createSale(f.emp, { items: [{ productId: p.id, quantity: 1 }], customerId: customer.id, paymentMethod: "CASH" });
    await sales.voidSale(f.admin, { saleId: newest.id, reason: "wrong customer" });
    expect((await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } })).lastPurchaseAt?.toISOString()).toBe(firstAt.toISOString());
  });

  it("preserves employee audit history while anonymizing and disabling deleted accounts", async () => {
    const f = await fixtures();
    const event = await prisma.auditLog.create({ data: { actorId: f.emp.id, action: "TEST_EVENT", entityType: "User", entityId: f.emp.id, description: "Eve accessed records" } });
    await prisma.session.create({ data: { userId: f.emp.id, expiresAt: new Date(Date.now() + 60_000) } });
    await employees.deleteEmployee(f.admin, f.emp.id);
    const account = await prisma.user.findUniqueOrThrow({ where: { id: f.emp.id } });
    expect(account).toMatchObject({ firstName: "Deleted", lastName: "Account", status: "SUSPENDED" });
    expect(account.email).toContain("@deleted.citypalaza.invalid");
    expect(await prisma.session.count({ where: { userId: f.emp.id } })).toBe(0);
    expect(await prisma.auditLog.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ actorId: f.emp.id, description: "Account management event for an anonymized account." });
  });

  it("rejects invalid, expired and used password reset links with a clear error", async () => {
    const f = await fixtures();
    const digest = (value: string) => createHash("sha256").update(value).digest("hex");
    const expired = "expired-reset-token";
    const used = "used-reset-token";
    await prisma.passwordResetToken.create({ data: { userId: f.emp.id, tokenHash: digest(expired), expiresAt: new Date(Date.now() - 1000) } });
    await prisma.passwordResetToken.create({ data: { userId: f.emp.id, tokenHash: digest(used), expiresAt: new Date(Date.now() + 60_000), usedAt: new Date() } });
    for (const token of ["unknown-reset-token", expired, used]) {
      await expect(consumePasswordReset(token, "SecurePassword123!")).rejects.toThrow(/invalid or has expired/i);
    }
  });

  it("consumes a password reset once and removes existing sessions", async () => {
    const f = await fixtures();
    const token = "valid-reset-token";
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await prisma.passwordResetToken.create({ data: { userId: f.emp.id, tokenHash, expiresAt: new Date(Date.now() + 60_000) } });
    await prisma.session.create({ data: { userId: f.emp.id, expiresAt: new Date(Date.now() + 60_000) } });
    await consumePasswordReset(token, "UpdatedPassword123!");
    expect(await verifyPassword("UpdatedPassword123!", (await prisma.user.findUniqueOrThrow({ where: { id: f.emp.id } })).passwordHash)).toBe(true);
    expect(await prisma.session.count({ where: { userId: f.emp.id } })).toBe(0);
    await expect(consumePasswordReset(token, "UpdatedPassword123!")).rejects.toThrow(/invalid or has expired/i);
  });

  it("prevents suspending the last active admin", async () => {
    const f = await fixtures();
    await expect(employees.setEmployeeStatus(f.admin, f.admin.id, "SUSPENDED")).rejects.toThrow(/own account/i);
  });

  it("keeps at least one active administrator when two admin status changes race", async () => {
    const f = await fixtures();
    const second = await prisma.user.create({ data: { slug: "second-admin", firstName: "Second", lastName: "Admin", email: "second-admin@t.local", passwordHash: "x", role: "ADMIN" } });
    const results = await Promise.allSettled([
      employees.setEmployeeStatus(f.admin, second.id, "SUSPENDED"),
      employees.setEmployeeStatus({ id: second.id, role: "ADMIN" }, f.admin.id, "SUSPENDED"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE", deletedAt: null } })).toBe(1);
  });
});
