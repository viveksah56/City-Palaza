"use client";
import * as React from "react";
import dynamic from "next/dynamic";
import { PackageMinus, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/shared/icon-button";

const StockDialog = dynamic(() => import("./stock-dialog").then((module) => module.StockDialog), {
  ssr: false,
  loading: () => <div className="sr-only" role="status">Opening stock form…</div>,
});

export type StockProduct = { id: string; name: string; sku: string; trackingType: "QUANTITY" | "SERIALIZED" | "IMEI"; quantity: number };

export function StockActions({ product, canAdd, canAdjust, compact = false }: { product: StockProduct; canAdd: boolean; canAdjust: boolean; compact?: boolean }) {
  const [mode, setMode] = React.useState<"add" | "remove" | null>(null);
  return (
    <div className="flex justify-end gap-1.5">
      {canAdd && (compact ? <IconButton label={`Add stock to ${product.name}`} variant="outline" onClick={() => setMode("add")}><PackagePlus /></IconButton> : <Button size="sm" variant="outline" onClick={() => setMode("add")}><PackagePlus /> Add stock</Button>)}
      {canAdjust && (compact ? <IconButton label={`Remove stock from ${product.name}`} variant="outline" onClick={() => setMode("remove")}><PackageMinus /></IconButton> : <Button size="sm" variant="outline" onClick={() => setMode("remove")}><PackageMinus /> Remove stock</Button>)}
      {mode && <StockDialog mode={mode} product={product} onClose={() => setMode(null)} />}
    </div>
  );
}
