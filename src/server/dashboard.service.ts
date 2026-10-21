import { prisma } from "@/lib/db";
import { unstable_cache } from "next/cache";
import { LOW_STOCK_NOTIFICATIONS_CACHE_TAG } from "@/lib/constants";
import { resolveRange, type DateRange } from "@/lib/dates";
import { D } from "@/lib/money";
import { stockStatus } from "@/lib/stock";
import { ROLE } from "@/lib/constants/roles";
import * as reports from "./reports.service";

export async function getAdminDashboard(range: DateRange) {
  const today = resolveRange("today");
  const [todaySales, todayProfit, inventory, employees, series, byCategory, topProducts, payments, rangeSummary, recentSales, lowStock] = await Promise.all([
    reports.getSalesSummary(today),
    reports.getProfitSummary(today),
    reports.getInventorySummary(),
    prisma.user.count({ where: { role: ROLE.EMPLOYEE, status: "ACTIVE" } }),
    reports.getSalesOverTime(range),
    reports.getSalesByCategory(range),
    reports.getTopProducts(range, 8),
    reports.getPaymentDistribution(range),
    reports.getSalesSummary(range),
    prisma.sale.findMany({
      where: { status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, saleNumber: true, total: true, paymentStatus: true, createdAt: true, customer: { select: { name: true } }, employee: { select: { firstName: true, lastName: true } } },
    }),
    reports.getLowStockProducts(6),
  ]);
  return {
    kpis: {
      todaySales: todaySales.total,
      todayOrders: todaySales.count,
      todayProfit: todayProfit.profit,
      totalProducts: inventory.products,
      lowStock: inventory.lowStock,
      outOfStock: inventory.outOfStock,
      inventoryValue: inventory.costValue,
      employees,
    },
    rangeSummary,
    series,
    byCategory: byCategory.map((c) => ({ label: c.name, value: D(c.revenue).toNumber() })),
    topProducts: topProducts.map((t) => ({ label: t.name, value: t.units })),
    payments: payments.map((p) => ({ label: p.method, value: D(p.total).toNumber() })),
    recentSales,
    lowStock,
  };
}

/** Employee view: only their own numbers; no profit, valuation, audit or other staff. */
export async function getEmployeeDashboard(userId: string) {
  const today = resolveRange("today");
  const week = resolveRange("last7");
  const [summary, available, lowStock, recent, salesTrend] = await Promise.all([
    reports.getSalesSummary(today, userId),
    prisma.product.count({ where: { status: "ACTIVE", quantity: { gt: 0 } } }),
    reports.getLowStockProducts(8),
    prisma.sale.findMany({
      where: { employeeId: userId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, saleNumber: true, total: true, status: true, createdAt: true, customer: { select: { name: true } } },
    }),
    reports.getSalesOverTime(week, userId),
  ]);
  return {
    todaySales: summary.total,
    todayOrders: summary.count,
    availableProducts: available,
    lowStock: lowStock.map((p) => ({ ...p, status: stockStatus(p.quantity, p.minStock) })),
    recent,
    salesTrend,
  };
}

export const getNotifications = unstable_cache(async () => {
  const [items, rows] = await Promise.all([
    reports.getLowStockProducts(5),
    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM "Product" WHERE "status"='ACTIVE' AND "quantity" <= "minStock"`,
  ]);
  return { lowStockCount: rows[0]?.count ?? 0, items };
}, [LOW_STOCK_NOTIFICATIONS_CACHE_TAG], { revalidate: 30, tags: [LOW_STOCK_NOTIFICATIONS_CACHE_TAG] });
