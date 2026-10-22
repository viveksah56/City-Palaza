import { prisma } from "@/lib/db";
import { D } from "@/lib/money";
import type { DateRange } from "@/lib/dates";
import type { SessionUser } from "@/lib/auth/session";
import * as reports from "@/server/reports.service";
import { PERMISSION, assertRolePermission, hasPermission } from "@/lib/rbac/permission";

export type ExportSection = {
  title: string;
  columns: string[];
  rows: (string | number)[][];
};

export type ReportExportData = {
  title: string;
  period: string;
  currency: string;
  summary: [string, string | number][];
  sections: ExportSection[];
};

const money = (value: string, currency: string) => `${currency} ${D(value).toFixed(2)}`;

export type ReportTab = "sales" | "profit" | "inventory" | "employees";

export async function getSalesExportData(user: SessionUser, range: DateRange, currency: string): Promise<ReportExportData> {
  assertRolePermission(user.role, PERMISSION.SALE_VIEW);
  const employeeId = hasPermission(user.role, PERMISSION.SALE_VIEW_ALL) ? undefined : user.id;
  const [sales, trend, categories, products, payments, rows] = await Promise.all([
    reports.getSalesSummary(range, employeeId),
    reports.getSalesOverTime(range, employeeId),
    reports.getSalesByCategory(range, employeeId),
    reports.getTopProducts(range, 20, employeeId),
    reports.getPaymentDistribution(range, employeeId),
    prisma.sale.findMany({
      where: { status: "COMPLETED", createdAt: { gte: range.from, lt: range.to }, ...(employeeId ? { employeeId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: { saleNumber: true, createdAt: true, customer: { select: { name: true } }, paymentStatus: true, paymentMethod: true, total: true },
    }),
  ]);
  const scope = employeeId ? "My sales" : "Store sales";
  return {
    title: `CityPalaza ${scope.toLowerCase()} report`,
    period: `${range.label} · ${range.from.toLocaleDateString("en-GB")} – ${new Date(range.to.getTime() - 1).toLocaleDateString("en-GB")}`,
    currency,
    summary: [
      ["Completed sales", sales.count],
      ["Gross sales", money(sales.grossSales, currency)],
      ["Discounts", money(sales.discounts, currency)],
      ["Net sales", money(sales.netSales, currency)],
      ["Taxes", money(sales.taxes, currency)],
      ["Sales total", money(sales.total, currency)],
      ["Average sale", money(sales.averageSale, currency)],
    ],
    sections: [
      { title: "Sales trend", columns: ["Date", `Sales (${currency})`], rows: trend.map((row) => [row.label, row.value]) },
      { title: "Sales by category", columns: ["Category", "Units", `Net sales (${currency})`], rows: categories.map((row) => [row.name, row.units, Number(row.revenue)]) },
      { title: "Top products", columns: ["Product", "SKU", "Units", `Net sales (${currency})`], rows: products.map((row) => [row.name, row.sku, row.units, Number(row.revenue)]) },
      { title: "Payment methods", columns: ["Method", "Sales", `Collected (${currency})`], rows: payments.map((row) => [row.method, row.count, Number(row.total)]) },
      {
        title: "Sale transactions (up to 1,000)",
        columns: ["Sale", "Date", "Customer", "Payment status", "Payment method", `Total (${currency})`],
        rows: rows.map((row) => [row.saleNumber, row.createdAt.toLocaleString("en-GB"), row.customer?.name ?? "Walk-in", row.paymentStatus, row.paymentMethod, Number(row.total.toString())]),
      },
    ],
  };
}

export async function getReportExportData(user: SessionUser, range: DateRange, currency: string, tab: ReportTab): Promise<ReportExportData> {
  assertRolePermission(user.role, PERMISSION.REPORT_VIEW);
  const requiredPermission = {
    sales: PERMISSION.REPORT_SALES,
    profit: PERMISSION.REPORT_PROFIT,
    inventory: PERMISSION.REPORT_INVENTORY,
    employees: PERMISSION.REPORT_SALES,
  }[tab];
  assertRolePermission(user.role, requiredPermission);

  if (tab === "sales") return getSalesExportData(user, range, currency);
  if (tab === "profit") {
    const [summary, trend, products] = await Promise.all([reports.getProfitSummary(range), reports.getProfitOverTime(range), reports.getProfitByProduct(range)]);
    return {
      title: "CityPalaza profit report",
      period: `${range.label} · ${range.from.toLocaleDateString("en-GB")} – ${new Date(range.to.getTime() - 1).toLocaleDateString("en-GB")}`,
      currency,
      summary: [["Revenue", money(summary.revenue, currency)], ["Cost of goods sold", money(summary.cost, currency)], ["Gross profit", money(summary.profit, currency)], ["Margin", `${summary.marginPercent}%`]],
      sections: [
        { title: "Profit over time", columns: ["Date", `Gross profit (${currency})`], rows: trend.map((row) => [row.label, row.value]) },
        { title: "Profit by product", columns: ["Product", "SKU", "Units", `Revenue (${currency})`, `Profit (${currency})`], rows: products.map((row) => [row.name, row.sku, row.units, Number(row.revenue), Number(row.profit)]) },
      ],
    };
  }
  if (tab === "inventory") {
    const [summary, low, out] = await Promise.all([reports.getInventorySummary(), reports.getLowStockProducts(), reports.getOutOfStockProducts()]);
    return {
      title: "CityPalaza inventory report",
      period: `Current inventory · generated ${new Date().toLocaleDateString("en-GB")}`,
      currency,
      summary: [["Active products", summary.products], ["Units in stock", summary.units], ["Inventory cost value", money(summary.costValue, currency)], ["Inventory selling value", money(summary.sellingValue, currency)], ["Potential gross profit", money(summary.potentialProfit, currency)], ["Low stock", summary.lowStock], ["Out of stock", summary.outOfStock]],
      sections: [
        { title: "Low stock", columns: ["Product", "SKU", "On hand", "Minimum"], rows: low.map((row) => [row.name, row.sku, row.quantity, row.minStock]) },
        { title: "Out of stock", columns: ["Product", "SKU", "Category"], rows: out.map((row) => [row.name, row.sku, row.category.name]) },
      ],
    };
  }
  const employees = await reports.getEmployeePerformance(range);
  return {
    title: "CityPalaza employee performance report",
    period: `${range.label} · ${range.from.toLocaleDateString("en-GB")} – ${new Date(range.to.getTime() - 1).toLocaleDateString("en-GB")}`,
    currency,
    summary: [["Employees with sales", employees.length], ["Sales", employees.reduce((total, row) => total + row.sales, 0)], ["Revenue", money(employees.reduce((total, row) => total.plus(row.revenue), D(0)).toFixed(2), currency)]],
    sections: [{ title: "Employee performance", columns: ["Employee", "Sales", "Units", `Revenue (${currency})`, `Discounts (${currency})`, `Gross profit (${currency})`, `Average sale (${currency})`], rows: employees.map((row) => [row.name, row.sales, row.units, Number(row.revenue), Number(row.discounts), Number(row.profit), Number(row.average)]) }],
  };
}
