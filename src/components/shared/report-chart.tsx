"use client";

import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export type ChartPoint = { label: string; value: number };
type ChartType = "line" | "bar" | "hbar" | "pie";

const ChartContent = React.lazy(() => import("./report-chart-content").then((module) => ({ default: module.ReportChartContent })));

export function ReportChart({ type, data, kind = "currency", height = 260, label }: { type: ChartType; data: ChartPoint[]; kind?: "currency" | "number"; height?: number; label: string }) {
  const [visible, setVisible] = React.useState(false);
  const hostRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host || visible) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "240px" });
    observer.observe(host);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={hostRef} role="img" aria-label={label} aria-busy={!visible} style={{ minHeight: height }} className="w-full">
      {visible ? (
        <React.Suspense fallback={<ChartSkeleton height={height} />}>
          <ChartContent type={type} data={data} kind={kind} height={height} label={label} />
        </React.Suspense>
      ) : <ChartSkeleton height={height} />}
    </div>
  );
}

function ChartSkeleton({ height }: { height: number }) {
  return <div aria-hidden="true" className="flex items-end gap-3 px-4 pb-6" style={{ height }}><Skeleton className="h-1/3 flex-1" /><Skeleton className="h-2/3 flex-1" /><Skeleton className="h-1/2 flex-1" /><Skeleton className="h-5/6 flex-1" /><Skeleton className="h-2/5 flex-1" /></div>;
}
