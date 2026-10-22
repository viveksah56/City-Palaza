import { prisma } from "@/lib/db";
import { D } from "@/lib/money";
import type { DateRange } from "@/lib/dates";
import type { SessionUser } from "@/lib/auth/session";
import { ROLE } from "@/lib/constants/roles";
import * as reports from "@/server/reports.service";
import { timeServerOperation } from "./timing";

export type ExportSection = {
  title: string;
  columns: string[];
  rows: (string | number)[][];
};

export type DashboardExportData = {
  title: string;
  period: string;
  currency: string;
  summary: [string, string | number][];
  sections: ExportSection[];
};

const money = (value: string, currency: string) => `${currency} ${D(value).toFixed(2)}`;

export async function getDashboardExportData(user: SessionUser, range: DateRange, currency: string): Promise<DashboardExportData> {
  return timeServerOperation(user.role === ROLE.ADMIN ? "report.export.admin.fetch" : "report.export.employee.fetch", async () => {
    if (user.role === ROLE.ADMIN) {
      const [sales, profit, inventory, trend, categories, products, payments, employees] = await Promise.all([
        reports.getSalesSummary(range),
        reports.getProfitSummary(range),
        reports.getInventorySummary(),
        reports.getSalesOverTime(range),
        reports.getSalesByCategory(range),
        reports.getTopProducts(range, 20),
        reports.getPaymentDistribution(range),
        reports.getSalesByEmployee(range),
      ]);
      return {
        title: "CityPalaza store dashboard",
        period: `${range.label} · ${range.from.toLocaleDateString("en-GB")} – ${new Date(range.to.getTime() - 1).toLocaleDateString("en-GB")}`,
        currency,
        summary: [
          ["Sales", money(sales.total, currency)],
          ["Orders", sales.count],
          ["Average order", money(sales.averageSale, currency)],
          ["Gross profit", money(profit.profit, currency)],
          ["Inventory value at cost", money(inventory.costValue, currency)],
          ["Active products", inventory.products],
          ["Low-stock products", inventory.lowStock],
          ["Out-of-stock products", inventory.outOfStock],
        ],
        sections: [
          { title: "Sales trend", columns: ["Date", `Sales (${currency})`], rows: trend.map((row) => [row.label, row.value]) },
          { title: "Sales by category", columns: ["Category", "Units", `Net sales (${currency})`], rows: categories.map((row) => [row.name, row.units, Number(row.revenue)]) },
          { title: "Top products", columns: ["Product", "SKU", "Units", `Net sales (${currency})`], rows: products.map((row) => [row.name, row.sku, row.units, Number(row.revenue)]) },
          { title: "Payment methods", columns: ["Method", "Orders", `Collected (${currency})`], rows: payments.map((row) => [row.method, row.count, Number(row.total)]) },
          { title: "Team sales", columns: ["Employee", "Orders", `Sales (${currency})`], rows: employees.map((row) => [row.name, row.count, Number(row.total)]) },
        ],
      };
    }

    const [sales, trend, personalSales] = await Promise.all([
      reports.getSalesSummary(range, user.id),
      reports.getSalesOverTime(range, user.id),
      prisma.sale.findMany({
        where: { employeeId: user.id, status: "COMPLETED", createdAt: { gte: range.from, lt: range.to } },
        orderBy: { createdAt: "desc" },
        take: 500,
        select: { saleNumber: true, createdAt: true, total: true, paymentStatus: true, paymentMethod: true },
      }),
    ]);
    return {
      title: "CityPalaza personal sales report",
      period: `${range.label} · ${range.from.toLocaleDateString("en-GB")} – ${new Date(range.to.getTime() - 1).toLocaleDateString("en-GB")}`,
      currency,
      summary: [
        ["My sales", money(sales.total, currency)],
        ["Orders", sales.count],
        ["Average order", money(sales.averageSale, currency)],
      ],
      sections: [
        { title: "My sales trend", columns: ["Date", `Sales (${currency})`], rows: trend.map((row) => [row.label, row.value]) },
        {
          title: "My recent sales (up to 500)",
          columns: ["Sale", "Date", "Payment status", "Payment method", `Total (${currency})`],
          rows: personalSales.map((row) => [row.saleNumber, row.createdAt.toLocaleString("en-GB"), row.paymentStatus, row.paymentMethod, Number(row.total.toString())]),
        },
      ],
    };
  });
}
