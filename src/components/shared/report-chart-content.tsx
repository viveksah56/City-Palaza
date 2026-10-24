"use client";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { formatCompactNumber, formatCurrency } from "@/lib/format";

export type ChartPoint = { label: string; value: number };
const TIP = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 14, color: "var(--foreground)", boxShadow: "var(--shadow-pop)", fontSize: 13, padding: "8px 12px" } as const;
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

function fmt(v: number, kind: "currency" | "number") {
  return kind === "currency" ? formatCurrency(v, "NPR") : formatCompactNumber(v);
}

export function ReportChartContent({ type, data, kind = "currency", height = 260, label }: { type: "line" | "bar" | "hbar" | "pie"; data: ChartPoint[]; kind?: "currency" | "number"; height?: number; label: string }) {
  if (data.length === 0) {
    return <div className="grid place-items-center text-sm text-muted-foreground" style={{ height }}>No data for this period</div>;
  }
  if (type === "line" && data.length === 1) {
    return <div className="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 px-4 text-center" style={{ height }}>
      <span className="size-2 rounded-full bg-primary ring-4 ring-primary/15" aria-hidden="true" />
      <p className="text-sm font-medium">One data point in this period</p>
      <p className="text-xs text-muted-foreground">{data[0]?.label}: {fmt(data[0]?.value ?? 0, kind)}. Select a wider date range to see the trend.</p>
    </div>;
  }
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {type === "line" ? (
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.7} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} width={56} tickFormatter={formatCompactNumber} />
            <Tooltip cursor={{ fill: "var(--secondary)", opacity: 0.5 }} contentStyle={TIP} labelStyle={{ fontWeight: 600 }} formatter={(v: number) => fmt(v, kind)} />
            <Line type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={3} strokeLinecap="round" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} name={label} />
          </LineChart>
        ) : type === "bar" ? (
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.7} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} interval={0} tickFormatter={(v: string) => (v.length > 10 ? `${v.slice(0, 9)}…` : v)} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} width={56} tickFormatter={formatCompactNumber} />
            <Tooltip cursor={{ fill: "var(--secondary)", opacity: 0.5 }} contentStyle={TIP} labelStyle={{ fontWeight: 600 }} formatter={(v: number) => fmt(v, kind)} />
            <Bar dataKey="value" fill="var(--chart-1)" radius={[8, 8, 0, 0]} maxBarSize={44} name={label} />
          </BarChart>
        ) : type === "hbar" ? (
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" strokeOpacity={0.7} />
            <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
            <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} width={130} tickFormatter={(v: string) => (v.length > 20 ? `${v.slice(0, 19)}…` : v)} />
            <Tooltip cursor={{ fill: "var(--secondary)", opacity: 0.5 }} contentStyle={TIP} labelStyle={{ fontWeight: 600 }} formatter={(v: number) => fmt(v, kind)} />
            <Bar dataKey="value" fill="var(--chart-1)" radius={[0, 8, 8, 0]} maxBarSize={22} name={label} />
          </BarChart>
        ) : (
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="62%" outerRadius="88%" paddingAngle={3} cornerRadius={6} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip cursor={{ fill: "var(--secondary)", opacity: 0.5 }} contentStyle={TIP} labelStyle={{ fontWeight: 600 }} formatter={(v: number) => fmt(v, kind)} />
            <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
