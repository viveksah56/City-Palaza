"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { lookupWarrantyAction } from "@/server/actions";
import type { WarrantyRow } from "@/server/warranties.service";
import { WarrantyTable } from "./warranty-table";

const lookupSchema = z.object({ term: z.string().trim().min(4, "Enter at least 4 characters of the IMEI or warranty tag").max(60) });
type LookupValues = z.infer<typeof lookupSchema>;

export function WarrantyLookup({ canClaim }: { canClaim: boolean }) {
  const [rows, setRows] = React.useState<WarrantyRow[] | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LookupValues>({ resolver: zodResolver(lookupSchema), defaultValues: { term: "" } });
  return (
    <div className="grid gap-5">
      <form noValidate className="flex max-w-xl items-start gap-2" onSubmit={handleSubmit(async ({ term }) => {
        const res = await lookupWarrantyAction(term);
        if (!res.ok) return void toast.error(res.error);
        setRows(res.data);
      })}>
        <div className="flex-1"><Field label="IMEI 1, IMEI 2 or warranty tag" htmlFor="warranty-term" error={errors.term?.message}><Input id="warranty-term" autoFocus placeholder="Scan IMEI or type tag e.g. CP-000123-W1" className="font-mono" {...register("term")} /></Field></div>
        <Button type="submit" disabled={isSubmitting} className="mt-[1.65rem]"><Search /> Look up</Button>
      </form>
      {rows && (rows.length === 0
        ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No warranty found for that code.</p>
        : <Card className="gap-0 overflow-x-auto py-0"><WarrantyTable rows={rows} canClaim={canClaim} /></Card>)}
    </div>
  );
}
