import { prisma } from "@/lib/db";
import { D } from "@/lib/money";
import type { DateRange } from "@/lib/dates";
import type { SessionUser } from "@/lib/auth/session";
import * as reports from "@/server/reports.service";
import { PERMISSION, assertRolePermission, hasPermission } from "@/lib/rbac/permission";
import { APP_NAME } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";

export type ExportSection = {
  title: string;
  columns: string[];
  rows: (string | number)[][];
};

export type ReportExportData = {
  title: string;
  period: string;
  currency: string;
  business: { name: string; address: string; city: string; phone: string; email: string; panNumber: string };
  summary: [string, string | number][];
  sections: ExportSection[];
};

const money = (value: string, currency: string) => `${currency} ${D(value).toFixed(2)}`;

export type ReportTab = "sales" | "profit" | "inventory" | "employees";

export async function getSalesExportData(user: SessionUser, range: DateRange, currency: string, business: ReportExportData["business"]): Promise<ReportExportData> {
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
      select: {
        saleNumber: true,
        createdAt: true,
        employee: { select: { firstName: true, lastName: true } },
        customer: { select: { name: true, phone: true } },
        paymentStatus: true,
        paymentMethod: true,
        subtotal: true,
        discount: true,
        taxRate: true,
        tax: true,
        total: true,
        amountPaid: true,
        notes: true,
        items: { select: { productName: true, categoryName: true, sku: true, quantity: true, serialSnapshot: true, unitPrice: true, subtotal: true, discount: true, promoDiscount: true, itemDiscount: true, saleDiscount: true, tax: true, total: true } },
        payments: { select: { amount: true, method: true, receivedAt: true, note: true, receivedBy: { select: { firstName: true, lastName: true } } }, orderBy: { receivedAt: "asc" } },
      },
    }),
  ]);
  const scope = employeeId ? "My sales" : "Store sales";
  const soldProductRows: (string | number)[][] = rows.flatMap((sale) => sale.items.map((item) => [
    sale.saleNumber,
    formatDateTime(sale.createdAt),
    `${sale.employee.firstName} ${sale.employee.lastName}`.trim(),
    sale.customer?.name ?? "Walk-in",
    sale.customer?.phone ?? "",
    sale.paymentMethod,
    item.productName,
    item.sku,
    item.categoryName,
    item.quantity,
    item.serialSnapshot.join(", "),
    Number(item.unitPrice.toString()),
    Number(item.subtotal.toString()),
    Number(item.promoDiscount?.toString() ?? "0"),
    item.itemDiscount === null ? "Not split (legacy sale)" : Number(item.itemDiscount.toString()),
    item.itemDiscount === null ? "Not split (legacy sale)" : Number(item.saleDiscount?.toString() ?? "0"),
    Number(item.discount.toString()),
    Number(item.tax.toString()),
    Number(item.total.toString()),
    sale.notes ?? "",
  ]));
  const soldTotals = soldProductRows.reduce((total, row) => ({
    quantity: total.quantity + Number(row[9] ?? 0),
    gross: total.gross.plus(D(Number(row[12] ?? 0))),
    promotion: total.promotion.plus(D(Number(row[13] ?? 0))),
    itemDiscount: total.itemDiscount.plus(typeof row[14] === "number" ? D(row[14]) : D(0)),
    saleDiscount: total.saleDiscount.plus(typeof row[15] === "number" ? D(row[15]) : D(0)),
    discount: total.discount.plus(D(Number(row[16] ?? 0))),
    tax: total.tax.plus(D(Number(row[17] ?? 0))),
    lineTotal: total.lineTotal.plus(D(Number(row[18] ?? 0))),
    legacyUnsplit: total.legacyUnsplit || typeof row[14] !== "number",
  }), { quantity: 0, gross: D(0), promotion: D(0), itemDiscount: D(0), saleDiscount: D(0), discount: D(0), tax: D(0), lineTotal: D(0), legacyUnsplit: false });
  if (soldProductRows.length) soldProductRows.push([
    "TOTAL", "", "", "", "", "", "", "", "", soldTotals.quantity, "", "",
    Number(soldTotals.gross.toFixed(2)), Number(soldTotals.promotion.toFixed(2)),
    soldTotals.legacyUnsplit ? "See legacy rows" : Number(soldTotals.itemDiscount.toFixed(2)),
    soldTotals.legacyUnsplit ? "See legacy rows" : Number(soldTotals.saleDiscount.toFixed(2)),
    Number(soldTotals.discount.toFixed(2)), Number(soldTotals.tax.toFixed(2)), Number(soldTotals.lineTotal.toFixed(2)), "",
  ]);
  return {
    title: `${business.name || APP_NAME} ${scope.toLowerCase()} report`,
    period: `${range.label} · ${formatDate(range.from)} – ${formatDate(new Date(range.to.getTime() - 1))}`,
    currency,
    business,
    summary: [
      ["Completed sales", sales.count],
      ["Gross sales", money(sales.grossSales, currency)],
      ["Discounts", money(sales.discounts, currency)],
      ["Net sales", money(sales.netSales, currency)],
      ["Taxes", money(sales.taxes, currency)],
      ["Sales total", money(sales.total, currency)],
      ["Collected", money(sales.collected, currency)],
      ["Outstanding", money(sales.outstanding, currency)],
      ["Average sale", money(sales.averageSale, currency)],
    ],
    sections: [
      { title: "Sales trend", columns: ["Date", `Sales (${currency})`], rows: trend.map((row) => [row.label, row.value]) },
      { title: "Sales by category", columns: ["Category", "Units", `Net sales (${currency})`], rows: categories.map((row) => [row.name, row.units, Number(row.revenue)]) },
      { title: "Top products", columns: ["Product", "SKU", "Units", `Net sales (${currency})`], rows: products.map((row) => [row.name, row.sku, row.units, Number(row.revenue)]) },
      { title: "Payment methods", columns: ["Method", "Payments", `Collected (${currency})`], rows: payments.map((row) => [row.method, row.count, Number(row.total)]) },
      {
        title: "Sale transactions",
        columns: ["Sale", "Date and time", "Employee", "Customer", "Phone", "Payment status", "Payment method", `Subtotal (${currency})`, `Discount (${currency})`, "VAT rate", `VAT (${currency})`, `Total (${currency})`, `Paid (${currency})`, `Balance (${currency})`, "Notes"],
        rows: rows.map((row) => [
          row.saleNumber,
          formatDateTime(row.createdAt),
          `${row.employee.firstName} ${row.employee.lastName}`.trim(),
          row.customer?.name ?? "Walk-in",
          row.customer?.phone ?? "",
          row.paymentStatus,
          row.paymentMethod,
          Number(row.subtotal.toString()),
          Number(row.discount.toString()),
          Number(row.taxRate.toString()),
          Number(row.tax.toString()),
          Number(row.total.toString()),
          Number(row.amountPaid.toString()),
          Number(D(row.total).minus(row.amountPaid).toFixed(2)),
          row.notes ?? "",
        ]),
      },
      {
        title: "Sold products",
        columns: ["Sale", "Sold at", "Employee", "Customer", "Phone", "Payment method", "Product", "SKU", "Category at sale", "Quantity", "IMEI / serial numbers", `Unit price (${currency})`, `Gross amount (${currency})`, `Promotion discount (${currency})`, `Product discount (${currency})`, `Sale-wide discount allocation (${currency})`, `Total line discount (${currency})`, `VAT (${currency})`, `Line total (${currency})`, "Notes"],
        rows: soldProductRows,
      },
      {
        title: "Payment transactions",
        columns: ["Sale", "Received at", "Received by", "Method", `Amount (${currency})`, "Note"],
        rows: rows.flatMap((sale) => sale.payments.map((payment) => [
          sale.saleNumber,
          formatDateTime(payment.receivedAt),
          `${payment.receivedBy.firstName} ${payment.receivedBy.lastName}`.trim(),
          payment.method,
          Number(payment.amount.toString()),
          payment.note ?? "",
        ])),
      },
    ],
  };
}

export async function getReportExportData(user: SessionUser, range: DateRange, currency: string, tab: ReportTab, business: ReportExportData["business"]): Promise<ReportExportData> {
  assertRolePermission(user.role, PERMISSION.REPORT_VIEW);
  const requiredPermission = {
    sales: PERMISSION.REPORT_SALES,
    profit: PERMISSION.REPORT_PROFIT,
    inventory: PERMISSION.REPORT_INVENTORY,
    employees: PERMISSION.REPORT_SALES,
  }[tab];
  assertRolePermission(user.role, requiredPermission);

  if (tab === "sales") return getSalesExportData(user, range, currency, business);
  if (tab === "profit") {
    const [summary, trend, products] = await Promise.all([reports.getProfitSummary(range), reports.getProfitOverTime(range), reports.getProfitByProduct(range)]);
    return {
      title: `${business.name || APP_NAME} profit report`,
      period: `${range.label} · ${formatDate(range.from)} – ${formatDate(new Date(range.to.getTime() - 1))}`,
      currency,
      business,
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
      title: `${business.name || APP_NAME} inventory report`,
      period: `Current inventory · generated ${formatDate(new Date())}`,
      currency,
      business,
      summary: [["Active products", summary.products], ["Units in stock", summary.units], ["Inventory cost value", money(summary.costValue, currency)], ["Inventory selling value", money(summary.sellingValue, currency)], ["Potential gross profit", money(summary.potentialProfit, currency)], ["Low stock", summary.lowStock], ["Out of stock", summary.outOfStock]],
      sections: [
        { title: "Low stock", columns: ["Product", "SKU", "On hand"], rows: low.map((row) => [row.name, row.sku, row.quantity]) },
        { title: "Out of stock", columns: ["Product", "SKU", "Category"], rows: out.map((row) => [row.name, row.sku, row.category.name]) },
      ],
    };
  }
  const employees = await reports.getEmployeePerformance(range);
  return {
    title: `${business.name || APP_NAME} employee performance report`,
    period: `${range.label} · ${formatDate(range.from)} – ${formatDate(new Date(range.to.getTime() - 1))}`,
    currency,
    business,
    summary: [["Employees with sales", employees.length], ["Sales", employees.reduce((total, row) => total + row.sales, 0)], ["Revenue", money(employees.reduce((total, row) => total.plus(row.revenue), D(0)).toFixed(2), currency)]],
    sections: [{ title: "Employee performance", columns: ["Employee", "Sales", "Units", `Revenue (${currency})`, `Manual discounts (${currency})`, `Gross profit (${currency})`, `Average sale (${currency})`], rows: employees.map((row) => [row.name, row.sales, row.units, Number(row.revenue), row.discounts === null ? "Unknown for legacy sales" : Number(row.discounts), Number(row.profit), Number(row.average)]) }],
  };
}
