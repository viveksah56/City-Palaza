import Link from "next/link";
import { D } from "@/lib/money";
import type { DateRange } from "@/lib/dates";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportCard } from "@/components/shared/report-card";
import { ReportChart } from "@/components/shared/report-chart";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/states";
import * as r from "@/server/reports.service";
import { getSettings } from "@/server/settings.service";

const empty = <EmptyState title="No sales in this period" />;

export async function SalesReport({ range }: { range: DateRange }) {
  const [s, cur, series, byCat, top, pay, byEmp] = await Promise.all([
    r.getSalesSummary(range), getSettings(), r.getSalesOverTime(range), r.getSalesByCategory(range),
    r.getTopProducts(range, 10), r.getPaymentDistribution(range), r.getSalesByEmployee(range),
  ]);
  const c = cur.currency;
  const money = (v: string) => <CurrencyDisplay value={v} currency={c} />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <ReportCard label="Gross sales" value={money(s.grossSales)} hint="Before discounts" />
        <ReportCard label="Discounts" value={money(s.discounts)} />
        <ReportCard label="Taxes" value={money(s.taxes)} />
        <ReportCard label="Net sales" value={money(s.netSales)} hint="Gross − discounts" />
        <ReportCard label="Collected" value={money(s.collected)} hint="Payments received in period" accent="green" />
        <ReportCard label="Outstanding" value={money(s.outstanding)} hint="Balance due on completed sales" accent="orange" />
        <ReportCard label="Number of sales" value={s.count} />
        <ReportCard label="Average sale" value={money(s.averageSale)} hint="Net per completed sale, excluding tax" />
      </div>
      <Card><CardHeader><CardTitle>Sales over time</CardTitle></CardHeader><CardContent><ReportChart type="line" data={series} label="Sales" /></CardContent></Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>By category</CardTitle></CardHeader><CardContent><ReportChart type="bar" data={byCat.map((x) => ({ label: x.name, value: D(x.revenue).toNumber() }))} label="Revenue" /></CardContent></Card>
        <Card><CardHeader><CardTitle>Payment methods</CardTitle></CardHeader><CardContent><ReportChart type="pie" data={pay.map((x) => ({ label: PAYMENT_METHOD_LABELS[x.method as keyof typeof PAYMENT_METHOD_LABELS] ?? x.method, value: D(x.total).toNumber() }))} label="Payments" /></CardContent></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-0 py-0"><CardHeader className="p-4"><CardTitle>Top products</CardTitle></CardHeader>
          <DataTable empty={empty} rows={top} rowKey={(x) => x.sku} columns={[
            { key: "n", header: "Product", cell: (x) => x.name }, { key: "u", header: "Units", align: "right", cell: (x) => <span className="num">{x.units}</span> },
            { key: "r", header: "Revenue", align: "right", cell: (x) => money(x.revenue) },
          ] satisfies Column<(typeof top)[number]>[]} /></Card>
        <Card className="gap-0 py-0"><CardHeader className="p-4"><CardTitle>By employee</CardTitle></CardHeader>
          <DataTable empty={empty} rows={byEmp} rowKey={(x) => x.name} columns={[
            { key: "n", header: "Employee", cell: (x) => x.name }, { key: "c", header: "Sales", align: "right", cell: (x) => <span className="num">{x.count}</span> },
            { key: "t", header: "Total", align: "right", cell: (x) => money(x.total) },
          ] satisfies Column<(typeof byEmp)[number]>[]} /></Card>
      </div>
    </div>
  );
}

export async function ProfitReport({ range }: { range: DateRange }) {
  const [p, cur, series, byProduct] = await Promise.all([r.getProfitSummary(range), getSettings(), r.getProfitOverTime(range), r.getProfitByProduct(range)]);
  const c = cur.currency;
  const money = (v: string) => <CurrencyDisplay value={v} currency={c} />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <ReportCard label="Revenue (after discounts)" value={money(p.revenue)} />
        <ReportCard label="Cost of goods sold" value={money(p.cost)} hint="Purchase prices at time of sale" />
        <ReportCard label="Gross profit" value={money(p.profit)} />
        <ReportCard label="Margin" value={`${p.marginPercent}%`} />
      </div>
      <Card><CardHeader><CardTitle>Gross profit over time</CardTitle></CardHeader><CardContent><ReportChart type="line" data={series} label="Profit" /></CardContent></Card>
      <Card className="gap-0 py-0"><CardHeader className="p-4"><CardTitle>Most profitable products</CardTitle></CardHeader>
        <DataTable empty={empty} rows={byProduct} rowKey={(x) => x.sku} columns={[
          { key: "n", header: "Product", cell: (x) => <div>{x.name}<p className="font-mono text-xs text-muted-foreground">{x.sku}</p></div> },
          { key: "u", header: "Units", align: "right", cell: (x) => <span className="num">{x.units}</span> },
          { key: "r", header: "Revenue", align: "right", cell: (x) => money(x.revenue) },
          { key: "p", header: "Profit", align: "right", cell: (x) => <span className="font-medium">{money(x.profit)}</span> },
        ] satisfies Column<(typeof byProduct)[number]>[]} /></Card>
    </div>
  );
}

export async function InventoryReport() {
  const [s, cur, low, out] = await Promise.all([r.getInventorySummary(), getSettings(), r.getLowStockProducts(), r.getOutOfStockProducts()]);
  const c = cur.currency;
  const money = (v: string) => <CurrencyDisplay value={v} currency={c} />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <ReportCard label="Active products" value={s.products} />
        <ReportCard label="Units in stock" value={s.units} />
        <ReportCard label="Inventory cost value" value={money(s.costValue)} />
        <ReportCard label="Inventory selling value" value={money(s.sellingValue)} />
        <ReportCard label="Potential gross profit" value={money(s.potentialProfit)} />
        <ReportCard label="Low stock" value={s.lowStock} tone={s.lowStock ? "warning" : "default"} />
        <ReportCard label="Out of stock" value={s.outOfStock} tone={s.outOfStock ? "danger" : "default"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-0 py-0"><CardHeader className="p-4"><CardTitle>Low stock</CardTitle></CardHeader>
          <DataTable empty={<EmptyState title="Nothing is running low" />} rows={low} rowKey={(x) => x.id} columns={[
            { key: "n", header: "Product", cell: (x) => <Link className="hover:underline" href={`/products/${x.slug}`}>{x.name}</Link> },
            { key: "q", header: "On hand", align: "right", cell: (x) => <span className="num">{x.quantity}</span> },
            { key: "m", header: "Min", align: "right", cell: (x) => <span className="num text-muted-foreground">{x.minStock}</span> },
          ] satisfies Column<(typeof low)[number]>[]} /></Card>
        <Card className="gap-0 py-0"><CardHeader className="p-4"><CardTitle>Out of stock</CardTitle></CardHeader>
          <DataTable empty={<EmptyState title="Everything has stock" />} rows={out} rowKey={(x) => x.id} columns={[
            { key: "n", header: "Product", cell: (x) => <Link className="hover:underline" href={`/products/${x.slug}`}>{x.name}</Link> },
            { key: "c", header: "Category", cell: (x) => x.category.name },
          ] satisfies Column<(typeof out)[number]>[]} /></Card>
      </div>
    </div>
  );
}

export async function EmployeeReport({ range }: { range: DateRange }) {
  const [rows, cur] = await Promise.all([r.getEmployeePerformance(range), getSettings()]);
  const money = (v: string) => <CurrencyDisplay value={v} currency={cur.currency} />;
  return (
    <Card className="gap-0 py-0"><CardHeader className="p-4"><CardTitle>Employee performance</CardTitle></CardHeader>
      <DataTable empty={empty} rows={rows} rowKey={(x) => x.id} columns={[
        { key: "n", header: "Employee", cell: (x) => <span className="font-medium">{x.name}</span> },
        { key: "s", header: "Sales", align: "right", cell: (x) => <span className="num">{x.sales}</span> },
        { key: "u", header: "Units", align: "right", cell: (x) => <span className="num">{x.units}</span> },
        { key: "r", header: "Revenue", align: "right", cell: (x) => money(x.revenue) },
        { key: "d", header: "Manual discounts", align: "right", cell: (x) => x.discounts === null ? <span className="text-muted-foreground">Unknown for legacy sales</span> : money(x.discounts) },
        { key: "p", header: "Gross profit", align: "right", cell: (x) => money(x.profit) },
        { key: "a", header: "Avg. sale", align: "right", cell: (x) => money(x.average) },
      ] satisfies Column<(typeof rows)[number]>[]} />
    </Card>
  );
}
