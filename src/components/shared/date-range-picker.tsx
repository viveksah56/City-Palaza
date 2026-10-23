"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RANGE_PRESETS } from "@/lib/dates";

/** Preset + custom range stored in the URL (?range=last30 | ?range=custom&from=2026-01-01&to=2026-01-31). */
export function DateRangePicker({ defaultPreset = "last7" }: { defaultPreset?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const preset = sp.get("range") ?? defaultPreset;
  const [from, setFrom] = React.useState(sp.get("from") ?? "");
  const [to, setTo] = React.useState(sp.get("to") ?? "");

  const push = (mut: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(sp.toString());
    mut(next);
    next.delete("page");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-full sm:w-44">
        <Select value={preset} onValueChange={(value) => push((p) => { p.set("range", value); if (value !== "custom") { p.delete("from"); p.delete("to"); } })}>
          <SelectTrigger aria-label="Date range"><SelectValue /></SelectTrigger>
          <SelectContent>{RANGE_PRESETS.map((range) => <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {preset === "custom" && (
        <>
          <Input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="w-full sm:w-40" />
          <Input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="w-full sm:w-40" />
          <Button variant="secondary" disabled={!from || !to} onClick={() => push((p) => { p.set("range", "custom"); p.set("from", from); p.set("to", to); })}>Apply</Button>
        </>
      )}
    </div>
  );
}
