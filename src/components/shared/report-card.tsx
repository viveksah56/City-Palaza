import * as React from "react";
import { cn } from "@/lib/utils";

const ACCENTS = {
  blue: "bg-blue/12 text-blue",
  green: "bg-green/15 text-green",
  orange: "bg-orange/15 text-orange",
  red: "bg-red/12 text-red",
  purple: "bg-purple/12 text-purple",
  teal: "bg-teal/15 text-teal",
  gray: "bg-gray/15 text-gray",
} as const;

/** KPI tile: colour-coded icon, quiet label, large tabular number. `tone` flags numbers that need attention. */
export function ReportCard({
  label, value, hint, icon, tone = "default", accent = "blue",
}: {
  label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode; tone?: "default" | "warning" | "danger"; accent?: keyof typeof ACCENTS;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground sm:text-[13px]">{label}</p>
        {icon && <span aria-hidden className={cn("grid size-8 place-items-center rounded-lg", ACCENTS[tone === "danger" ? "red" : tone === "warning" ? "orange" : accent])}>{icon}</span>}
      </div>
      <p className={cn("mt-3 truncate font-heading text-[1.55rem] leading-none font-semibold tracking-[-0.025em] num sm:text-[1.8rem]", tone === "warning" && "text-warning-foreground", tone === "danger" && "text-destructive")}>{value}</p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
