"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import { PackagePlus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/shared/icon-button";

const StockDialog = dynamic(() => import("./stock-dialog").then((module) => module.StockDialog), {
  ssr: false,
  loading: () => <div className="sr-only" role="status">Opening stock form…</div>,
});

export type StockProduct = { id: string; name: string; sku: string; trackingType: "QUANTITY" | "SERIALIZED" | "IMEI"; quantity: number };

export function StockActions({ product, canAdd, canAdjust, compact = false }: { product: StockProduct; canAdd: boolean; canAdjust: boolean; compact?: boolean }) {
  const [mode, setMode] = React.useState<"add" | "adjust" | null>(null);
  return (
    <div className="flex justify-end gap-1.5">
      {canAdd && (compact ? <IconButton label={`Add stock to ${product.name}`} variant="outline" onClick={() => setMode("add")}><PackagePlus /></IconButton> : <Button size="sm" variant="outline" onClick={() => setMode("add")}><PackagePlus /> Add stock</Button>)}
      {canAdjust && (compact ? <IconButton label={`Adjust stock for ${product.name}`} variant="ghost" onClick={() => setMode("adjust")}><SlidersHorizontal /></IconButton> : <Button size="sm" variant="ghost" onClick={() => setMode("adjust")} aria-label={`Adjust stock for ${product.name}`}><SlidersHorizontal /> Adjust</Button>)}
      {mode && <StockDialog mode={mode} product={product} onClose={() => setMode(null)} />}
    </div>
  );
}
