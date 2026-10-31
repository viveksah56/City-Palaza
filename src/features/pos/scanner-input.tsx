"use client";
import * as React from "react";
import { toast } from "sonner";
import { ScanBarcode } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ProductRow } from "@/server/products.service";
import type { CartDevice } from "@/stores/cart-store";
import { scanCode } from "./pos-queries";

/**
 * Barcode / IMEI scanner field. Hardware scanners type the code and press Enter, so Enter submits.
 * An IMEI 1 / IMEI 2 adds that exact device; a barcode or SKU adds the product.
 */
export function ScannerInput({ onAdd, onNotFound }: { onAdd: (product: ProductRow, device?: CartDevice) => void; onNotFound?: (code: string) => void }) {
  const [value, setValue] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const ref = React.useRef<HTMLInputElement>(null);

  async function submit() {
    const code = value.trim();
    if (!code || busy) return;
    setBusy(true);
    try {
      const result = await scanCode(code);
      switch (result.kind) {
        case "device":
          onAdd(result.product, { serial: result.serial, imei2: result.imei2 });
          toast.success(`${result.product.name} · IMEI ${result.serial}`);
          break;
        case "product":
          onAdd(result.product);
          toast.success(`Added ${result.product.name}`);
          break;
        case "unavailable":
          toast.error(result.reason);
          break;
        case "not_found":
          toast.error(`No product or device matches “${code}”.`);
          onNotFound?.(code);
          break;
      }
      setValue("");
    } catch {
      toast.error("Scan failed. Check your connection and try again.");
    } finally {
      setBusy(false);
      ref.current?.focus();
    }
  }

  return (
    <div className="relative">
      <ScanBarcode aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-primary" />
      <Input
        ref={ref}
        autoFocus
        value={value}
        disabled={busy}
        inputMode="text"
        autoComplete="off"
        aria-label="Scan barcode or IMEI"
        placeholder="Scan barcode / IMEI, then Enter"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void submit(); } }}
        className="h-11 rounded-lg border-primary/40 bg-primary/5 pl-10 font-mono text-sm shadow-none focus-visible:border-primary"
      />
    </div>
  );
}
