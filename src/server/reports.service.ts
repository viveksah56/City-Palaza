import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { APP_TIMEZONE } from "@/lib/constants";
import { D } from "@/lib/money";

/**
 * Reports are derived ONLY from historical records (Sale / SaleItem snapshots and Product stock),
 * so later price changes never rewrite history. VOIDED sales are always excluded.
 * Numerics are returned as text from SQL and wrapped in decimal.js – no float arithmetic.
 */
export type Period = { from: Date; to: Date; granularity?: "day" | "month" };

const tz = APP_TIMEZONE;
const saleWhere = (p: Period, employeeId?: string) => Prisma.sql`
  s."status" = 'COMPLETED' AND s."createdAt" >= ${p.from} AND s."createdAt" < ${p.to}
  ${employeeId ? Prisma.sql`AND s."employeeId" = ${employeeId}` : Prisma.empty}`;

export type SalesSummary = {
  count: number;
  grossSales: string; // before discounts
  discounts: string;
  netSales: string; // gross − discounts (ex tax)
  taxes: string;
  total: string; // booked sale total, including tax
  collected: string;
  outstanding: string;
  averageSale: string;
};

export async function getSalesSummary(p: Period, employeeId?: string): Promise<SalesSummary> {
  const [r] = await prisma.$queryRaw<{ count: number; subtotal: string; discount: string; tax: string; total: string; collected: string; outstanding: string }[]>`
    SELECT COUNT(*)::int AS count,
           COALESCE(SUM(s."subtotal"),0)::text AS subtotal,
           COALESCE(SUM(s."discount"),0)::text AS discount,
           COALESCE(SUM(s."tax"),0)::text AS tax,
           COALESCE(SUM(s."total"),0)::text AS total,
           COALESCE((SELECT SUM(sp."amount") FROM "citypalaza_database"."SalePayment" sp JOIN "citypalaza_database"."Sale" ps ON ps."id" = sp."saleId"
             WHERE ps."status" = 'COMPLETED' AND sp."receivedAt" >= ${p.from} AND sp."receivedAt" < ${p.to} ${employeeId ? Prisma.sql`AND ps."employeeId" = ${employeeId}` : Prisma.empty}),0)::text AS collected,
           COALESCE(SUM(s."total" - s."amountPaid"),0)::text AS outstanding
      FROM "citypalaza_database"."Sale" s WHERE ${saleWhere(p, employeeId)}`;
  const row = r!;
  return {
    count: row.count,
    grossSales: row.subtotal,
    discounts: row.discount,
    netSales: D(row.subtotal).minus(row.discount).toFixed(2),
    taxes: row.tax,
    total: row.total,
    collected: row.collected,
    outstanding: row.outstanding,
    averageSale: row.count ? D(row.subtotal).minus(row.discount).div(row.count).toFixed(2) : "0.00",
  };
}

export type SeriesPoint = { label: string; value: number };
const num = (s: string | number) => D(s).toNumber(); // chart display only

export async function getSalesOverTime(p: Period, employeeId?: string): Promise<SeriesPoint[]> {
  const unit = p.granularity === "month" ? "month" : "day";
  const fmt = unit === "month" ? "Mon YYYY" : "DD Mon";
  const rows = await prisma.$queryRaw<{ bucket: Date; label: string; value: string }[]>`
    SELECT date_trunc(${unit}, (s."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}) AS bucket,
           to_char(date_trunc(${unit}, (s."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}), ${fmt}) AS label,
           SUM(s."total")::text AS value
      FROM "citypalaza_database"."Sale" s WHERE ${saleWhere(p, employeeId)}
     GROUP BY 1, 2 ORDER BY 1`;
  return rows.map((r) => ({ label: r.label, value: num(r.value) }));
}

export async function getSalesByCategory(p: Period, employeeId?: string) {
  const rows = await prisma.$queryRaw<{ name: string; revenue: string; units: number }[]>`
    SELECT si."categoryName" AS name, SUM(si."subtotal" - si."discount")::text AS revenue, SUM(si."quantity")::int AS units
      FROM "citypalaza_database"."SaleItem" si
      JOIN "citypalaza_database"."Sale" s ON s."id" = si."saleId"
     WHERE ${saleWhere(p, employeeId)}
     GROUP BY si."categoryName" ORDER BY SUM(si."subtotal" - si."discount") DESC`;
  return rows.map((r) => ({ name: r.name, revenue: r.revenue, units: r.units }));
}

export async function getTopProducts(p: Period, limit = 10, employeeId?: string) {
  const rows = await prisma.$queryRaw<{ name: string; sku: string; units: number; revenue: string }[]>`
    SELECT si."productName" AS name, si."sku", SUM(si."quantity")::int AS units,
           SUM(si."subtotal" - si."discount")::text AS revenue
      FROM "citypalaza_database"."SaleItem" si JOIN "citypalaza_database"."Sale" s ON s."id" = si."saleId"
     WHERE ${saleWhere(p, employeeId)}
     GROUP BY si."productId", si."productName", si."sku"
     ORDER BY SUM(si."quantity") DESC, SUM(si."subtotal" - si."discount") DESC
     LIMIT ${limit}`;
  return rows;
}

export async function getPaymentDistribution(p: Period, employeeId?: string) {
  const rows = await prisma.$queryRaw<{ method: string; count: number; total: string }[]>`
    SELECT sp."method"::text AS method, COUNT(*)::int AS count, SUM(sp."amount")::text AS total
      FROM "citypalaza_database"."SalePayment" sp
      JOIN "citypalaza_database"."Sale" s ON s."id" = sp."saleId"
     WHERE s."status" = 'COMPLETED' AND sp."receivedAt" >= ${p.from} AND sp."receivedAt" < ${p.to} ${employeeId ? Prisma.sql`AND s."employeeId" = ${employeeId}` : Prisma.empty}
     GROUP BY sp."method" ORDER BY SUM(sp."amount") DESC`;
  return rows;
}

/** profit = Σ [(historical unit price × qty − discount) − historical unit cost × qty] */
export async function getProfitSummary(p: Period, employeeId?: string) {
  const [r] = await prisma.$queryRaw<{ revenue: string; cost: string; profit: string }[]>`
    SELECT COALESCE(SUM(si."subtotal" - si."discount"),0)::text AS revenue,
           COALESCE(SUM(si."unitCost" * si."quantity"),0)::text AS cost,
           COALESCE(SUM(si."subtotal" - si."discount" - si."unitCost" * si."quantity"),0)::text AS profit
      FROM "citypalaza_database"."SaleItem" si JOIN "citypalaza_database"."Sale" s ON s."id" = si."saleId"
     WHERE ${saleWhere(p, employeeId)}`;
  const row = r!;
  const margin = D(row.revenue).isZero() ? "0.0" : D(row.profit).div(row.revenue).times(100).toFixed(1);
  return { revenue: row.revenue, cost: row.cost, profit: row.profit, marginPercent: margin };
}

export async function getProfitOverTime(p: Period): Promise<SeriesPoint[]> {
  const unit = p.granularity === "month" ? "month" : "day";
  const fmt = unit === "month" ? "Mon YYYY" : "DD Mon";
  const rows = await prisma.$queryRaw<{ label: string; value: string }[]>`
    SELECT to_char(date_trunc(${unit}, (s."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}), ${fmt}) AS label,
           SUM(si."subtotal" - si."discount" - si."unitCost" * si."quantity")::text AS value,
           date_trunc(${unit}, (s."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}) AS bucket
      FROM "citypalaza_database"."SaleItem" si JOIN "citypalaza_database"."Sale" s ON s."id" = si."saleId"
     WHERE ${saleWhere(p)} GROUP BY 3, 1 ORDER BY 3`;
  return rows.map((r) => ({ label: r.label, value: num(r.value) }));
}

export async function getProfitByProduct(p: Period, limit = 15) {
  return prisma.$queryRaw<{ name: string; sku: string; units: number; revenue: string; profit: string }[]>`
    SELECT si."productName" AS name, si."sku", SUM(si."quantity")::int AS units,
           SUM(si."subtotal" - si."discount")::text AS revenue,
           SUM(si."subtotal" - si."discount" - si."unitCost" * si."quantity")::text AS profit
      FROM "citypalaza_database"."SaleItem" si JOIN "citypalaza_database"."Sale" s ON s."id" = si."saleId"
     WHERE ${saleWhere(p)}
     GROUP BY si."productId", si."productName", si."sku"
     ORDER BY SUM(si."subtotal" - si."discount" - si."unitCost" * si."quantity") DESC LIMIT ${limit}`;
}

export async function getEmployeePerformance(p: Period) {
  return prisma.$queryRaw<
    { id: string; name: string; sales: number; units: number; revenue: string; discounts: string | null; profit: string; average: string }[]
  >`
    WITH employee_discounts AS (
      SELECT "employeeId",
             CASE WHEN COUNT("manualDiscount") = COUNT(*) THEN SUM("manualDiscount")::text ELSE NULL END AS discounts
        FROM "citypalaza_database"."Sale"
       WHERE "status" = 'COMPLETED' AND "createdAt" >= ${p.from} AND "createdAt" < ${p.to}
       GROUP BY "employeeId"
    )
    SELECT u."id", u."firstName" || ' ' || u."lastName" AS name,
           COUNT(DISTINCT s."id")::int AS sales,
           COALESCE(SUM(si."quantity"),0)::int AS units,
           COALESCE(SUM(si."subtotal" - si."discount"),0)::text AS revenue,
           ed.discounts,
           COALESCE(SUM(si."subtotal" - si."discount" - si."unitCost" * si."quantity"),0)::text AS profit,
           CASE WHEN COUNT(DISTINCT s."id") = 0 THEN '0.00'
                ELSE (SUM(si."subtotal" - si."discount") / COUNT(DISTINCT s."id"))::numeric(14,2)::text END AS average
      FROM "citypalaza_database"."User" u
      JOIN "citypalaza_database"."Sale" s ON s."employeeId" = u."id" AND s."status" = 'COMPLETED'
                   AND s."createdAt" >= ${p.from} AND s."createdAt" < ${p.to}
      JOIN "citypalaza_database"."SaleItem" si ON si."saleId" = s."id"
      LEFT JOIN employee_discounts ed ON ed."employeeId" = u."id"
     GROUP BY u."id", u."firstName", u."lastName", ed.discounts
     ORDER BY SUM(si."subtotal" - si."discount") DESC`;
}

export async function getSalesByEmployee(p: Period) {
  return prisma.$queryRaw<{ name: string; count: number; total: string }[]>`
    SELECT u."firstName" || ' ' || u."lastName" AS name, COUNT(*)::int AS count, SUM(s."total")::text AS total
      FROM "citypalaza_database"."Sale" s JOIN "citypalaza_database"."User" u ON u."id" = s."employeeId"
     WHERE ${saleWhere(p)} GROUP BY u."id", u."firstName", u."lastName" ORDER BY SUM(s."total") DESC`;
}

export async function getInventorySummary() {
  const [r] = await prisma.$queryRaw<
    { products: number; units: number; cost: string; retail: string; low: number; out: number }[]
  >`
    SELECT COUNT(*)::int AS products,
           COALESCE(SUM("quantity"),0)::int AS units,
           COALESCE(SUM("quantity" * "purchasePrice"),0)::text AS cost,
           COALESCE(SUM("quantity" * "sellingPrice"),0)::text AS retail,
           COUNT(*) FILTER (WHERE "quantity" > 0 AND "quantity" <= "minStock")::int AS low,
           COUNT(*) FILTER (WHERE "quantity" <= 0)::int AS out
      FROM "citypalaza_database"."Product" WHERE "status" = 'ACTIVE'`;
  const row = r!;
  return {
    products: row.products,
    units: row.units,
    costValue: row.cost,
    sellingValue: row.retail,
    potentialProfit: D(row.retail).minus(row.cost).toFixed(2),
    lowStock: row.low,
    outOfStock: row.out,
  };
}

export function getLowStockProducts(limit = 50) {
  return prisma.$queryRaw<{ id: string; slug: string; name: string; sku: string; quantity: number; minStock: number }[]>`
    SELECT "id", "slug", "name", "sku", "quantity", "minStock" FROM "citypalaza_database"."Product"
     WHERE "status" = 'ACTIVE' AND "quantity" > 0 AND "quantity" <= "minStock"
     ORDER BY "quantity" ASC, "name" ASC LIMIT ${limit}`;
}

export function getOutOfStockProducts(limit = 50) {
  return prisma.product.findMany({
    where: { status: "ACTIVE", quantity: { lte: 0 } },
    orderBy: { name: "asc" },
    take: limit,
    select: { id: true, slug: true, name: true, sku: true, minStock: true, category: { select: { name: true } } },
  });
}
