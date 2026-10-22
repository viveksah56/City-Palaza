import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, Boxes, Receipt, ShoppingBag, TrendingUp, Wallet, ArrowUpRight } from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import {PERMISSION, hasPermission} from "@/lib/rbac/permission";
import { resolveRange } from "@/lib/dates";
import { first, type SearchParams } from "@/lib/url";
import { formatDateTime, fullName } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { ReportCard } from "@/components/shared/report-card";
import { ReportChart } from "@/components/shared/report-chart";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { CurrencyDisplay } from "@/components/shared/currency-display";
import { StatusBadge } from "@/components/shared/badges";
import { LoadingSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getAdminDashboard, getEmployeeDashboard } from "@/server/dashboard.service";
import { getSettings } from "@/server/settings.service";
import { IconButton } from "@/components/shared/icon-button";
import { DashboardExports } from "@/features/reports/dashboard-exports";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [user, sp] = await Promise.all([requirePermission(PERMISSION.DASHBOARD_VIEW), searchParams]);
  if (!hasPermission(user.role, PERMISSION.REPORT_VIEW)) return <Suspense fallback={<LoadingSkeleton cards={4} rows={4} />}><EmployeeDashboard userId={user.id} name={user.firstName} /></Suspense>;

  const range = resolveRange(first(sp.range), first(sp.from), first(sp.to), { fallback: "last7" });
  return (
    <>
      <PageHeader title="Dashboard" description="A live view of sales, stock, and store activity." actions={<><DateRangePicker /><DashboardExports range={range} /><Button asChild variant="outline"><Link href="/sales/new"><ShoppingBag /> New sale</Link></Button></>} />
      <Suspense key={`${range.from.toISOString()}-${range.to.toISOString()}`} fallback={<LoadingSkeleton cards={8} rows={4} />}>
        <DashboardServerView range={range} />
      </Suspense>
    </>
  );
}

async function DashboardServerView({ range }: { range: ReturnType<typeof resolveRange> }) {
  const [d, s] = await Promise.all([getAdminDashboard(range), getSettings()]);
  const c = s.currency;
  return (
    <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_19rem] 2xl:gap-6">
      <div className="min-w-0 space-y-5 sm:space-y-6">
      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <ReportCard label="Today’s sales" value={<CurrencyDisplay value={d.kpis.todaySales} currency={c} />} icon={<Banknote className="size-5" />} />
        <ReportCard label="Today’s orders" value={d.kpis.todayOrders} icon={<Receipt className="size-5" />} />
        <ReportCard label="Today’s profit" value={<CurrencyDisplay value={d.kpis.todayProfit} currency={c} />} icon={<TrendingUp className="size-5" />} />
        <ReportCard label="Inventory value at cost" value={<CurrencyDisplay value={d.kpis.inventoryValue} currency={c} />} icon={<Wallet className="size-5" />} />
      </section>

      <Card>
        <CardHeader className="pb-1"><CardTitle>Store overview</CardTitle><CardDescription>Current product and team totals.</CardDescription></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 pt-2 sm:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">Active products</p><p className="mt-1 text-xl font-semibold num">{d.kpis.totalProducts}</p></div>
          <div><p className="text-xs text-muted-foreground">Low stock</p><p className="mt-1 text-xl font-semibold text-warning-foreground num">{d.kpis.lowStock}</p></div>
          <div><p className="text-xs text-muted-foreground">Out of stock</p><p className="mt-1 text-xl font-semibold text-destructive num">{d.kpis.outOfStock}</p></div>
          <div><p className="text-xs text-muted-foreground">Employees</p><p className="mt-1 text-xl font-semibold num">{d.kpis.employees}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales trend</CardTitle>
          <CardDescription>{range.label}. {d.rangeSummary.count} sales. Total <CurrencyDisplay value={d.rangeSummary.total} currency={c} />. Average <CurrencyDisplay value={d.rangeSummary.averageSale} currency={c} />.</CardDescription>
        </CardHeader>
        <CardContent><ReportChart type="line" data={d.series} label="Sales" /></CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader><CardTitle>Sales by category</CardTitle></CardHeader><CardContent><ReportChart type="bar" data={d.byCategory} label="Revenue" /></CardContent></Card>
        <Card><CardHeader><CardTitle>Top-selling products</CardTitle></CardHeader><CardContent><ReportChart type="hbar" kind="number" data={d.topProducts} label="Units" /></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Payment methods</CardTitle><CardDescription>Collected payments over the selected period.</CardDescription></CardHeader><CardContent><ReportChart type="pie" data={d.payments} label="Payments" height={280} /></CardContent></Card>
      </div>

      <aside aria-label="Store activity" className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-1">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle>Recent sales</CardTitle><CardDescription className="mt-1">Latest completed orders</CardDescription></div>
            <IconButton label="View all sales" variant="ghost" asChild><Link href="/sales"><ArrowUpRight /></Link></IconButton>
          </CardHeader>
          <CardContent>
            {d.recentSales.length === 0 ? <p className="py-3 text-sm text-muted-foreground">Sales will appear here as they are recorded.</p> : <ul className="divide-y divide-border">
              {d.recentSales.map((sale) => <li key={sale.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0"><Link href={`/sales/${sale.id}`} className="font-mono text-[13px] font-medium text-primary hover:underline">{sale.saleNumber}</Link><p className="truncate text-xs text-muted-foreground">{sale.customer?.name ?? "Walk-in"} · {fullName(sale.employee)}</p><p className="text-xs text-muted-foreground">{formatDateTime(sale.createdAt)}</p></div>
                <CurrencyDisplay value={sale.total} currency={c} className="shrink-0 text-sm font-medium" />
              </li>)}
            </ul>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle>Stock attention</CardTitle><CardDescription className="mt-1">At or below minimum stock</CardDescription></div>
            <IconButton label="View low stock" variant="ghost" asChild><Link href="/inventory?stock=low"><ArrowUpRight /></Link></IconButton>
          </CardHeader>
          <CardContent>
            {d.lowStock.length === 0 ? <p className="py-3 text-sm text-muted-foreground">All products are above minimum stock.</p> : <ul className="divide-y divide-border">
              {d.lowStock.map((product) => <li key={product.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <Link href={`/products/${product.id}`} className="min-w-0 truncate text-sm font-medium hover:text-primary hover:underline">{product.name}</Link>
                <span className="shrink-0 rounded-md bg-warning/10 px-2 py-1 text-xs font-medium text-warning-foreground num">{product.quantity} left</span>
              </li>)}
            </ul>}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

async function EmployeeDashboard({ userId, name }: { userId: string; name: string }) {
  const [d, s] = await Promise.all([getEmployeeDashboard(userId), getSettings()]);
  return (
    <>
      <PageHeader title={`Hello, ${name}`} description="Your day at the counter." actions={<><DashboardExports /><Button asChild><Link href="/sales/new"><ShoppingBag /> New sale</Link></Button></>} />
      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_19rem] 2xl:gap-6">
      <div className="min-w-0 space-y-5">
        <section aria-label="My performance today" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <ReportCard label="My sales today" value={<CurrencyDisplay value={d.todaySales} currency={s.currency} />} icon={<Banknote className="size-5" />} />
        <ReportCard label="My orders today" value={d.todayOrders} icon={<Receipt className="size-5" />} />
        <ReportCard label="Products available" value={d.availableProducts} icon={<Boxes className="size-5" />} />
        <ReportCard label="Low-stock products" value={d.lowStock.length} tone={d.lowStock.length ? "warning" : "default"} icon={<AlertTriangle className="size-5" />} />
        </section>
        <Card>
          <CardHeader><CardTitle>My sales trend</CardTitle><CardDescription>Your completed sales over the last seven days.</CardDescription></CardHeader>
          <CardContent><ReportChart type="line" data={d.salesTrend} label="My sales" /></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle>My recent sales</CardTitle><CardDescription className="mt-1">Your latest completed orders</CardDescription></div><IconButton label="View all my sales" variant="ghost" asChild><Link href="/sales"><ArrowUpRight /></Link></IconButton></CardHeader>
          <CardContent>
            {d.recent.length === 0 ? <p className="text-sm text-muted-foreground">No sales yet. Your first one will show up here.</p> : (
              <ul className="divide-y">
                {d.recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link href={`/sales/${r.id}`} className="font-mono text-[13px] font-medium text-primary hover:underline">{r.saleNumber}</Link>
                      <p className="truncate text-xs text-muted-foreground">{r.customer?.name ?? "Walk-in"} · {formatDateTime(r.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">{r.status === "VOIDED" && <StatusBadge status="VOIDED" />}<CurrencyDisplay value={r.total} currency={s.currency} /></div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
        <Card className="2xl:col-start-2 2xl:row-start-1">
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Running low</CardTitle><CardDescription className="mt-1">Products needing attention</CardDescription></div><IconButton label="View low stock" variant="ghost" asChild><Link href="/inventory?stock=low"><ArrowUpRight /></Link></IconButton></CardHeader>
          <CardContent>
            {d.lowStock.length === 0 ? <p className="text-sm text-muted-foreground">Everything is above its minimum level.</p> : (
              <ul className="divide-y">
                {d.lowStock.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <Link href={`/products/${p.id}`} className="truncate hover:underline">{p.name}</Link>
                    <span className="num text-muted-foreground">{p.quantity} left</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
