"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { PackagePlus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/ui/field";
import { addStockSchema, adjustStockSchema, type AddStockValues, type AdjustStockValues } from "@/validations/inventory";
import { addStockAction, adjustStockAction } from "@/server/actions";

export type StockProduct = { id: string; name: string; sku: string; trackingType: "QUANTITY" | "SERIALIZED" | "IMEI"; quantity: number };

export function StockActions({ product, canAdd, canAdjust }: { product: StockProduct; canAdd: boolean; canAdjust: boolean }) {
  const [mode, setMode] = React.useState<"add" | "adjust" | null>(null);
  return (
    <div className="flex justify-end gap-1.5">
      {canAdd && <Button size="sm" variant="outline" onClick={() => setMode("add")}><PackagePlus /> Add stock</Button>}
      {canAdjust && <Button size="sm" variant="ghost" onClick={() => setMode("adjust")} aria-label={`Adjust stock for ${product.name}`}><SlidersHorizontal /> Adjust</Button>}
      {mode && <StockDialog mode={mode} product={product} onClose={() => setMode(null)} />}
    </div>
  );
}

function StockDialog({ mode, product, onClose }: { mode: "add" | "adjust"; product: StockProduct; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add stock" : "Adjust stock"}</DialogTitle>
          <DialogDescription>{product.name} · <span className="font-mono">{product.sku}</span> · {product.quantity} on hand</DialogDescription>
        </DialogHeader>
        {mode === "add" ? <AddForm product={product} onClose={onClose} /> : <AdjustForm product={product} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function AddForm({ product, onClose }: { product: StockProduct; onClose: () => void }) {
  const router = useRouter();
  const serialized = product.trackingType !== "QUANTITY";
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<AddStockValues>({
    resolver: zodResolver(addStockSchema),
    defaultValues: { productId: product.id, type: "PURCHASE", quantity: serialized ? undefined : 1, serialsText: "", reference: "", reason: "" },
  });
  const type = watch("type");
  return (
    <form
      noValidate className="grid gap-4"
      onSubmit={handleSubmit(async (v) => {
        const res = await addStockAction(v);
        if (!res.ok) return void toast.error(res.error);
        toast.success(`Added ${res.data.quantity} · stock now ${res.data.newQuantity}`);
        onClose();
        router.refresh();
      })}
    >
      {serialized ? (
        <Field label={product.trackingType === "IMEI" ? "IMEI numbers" : "Serial numbers"} htmlFor="serialsText" required hint="One per line or comma-separated. A scanner works too." error={errors.serialsText?.message}>
          <Textarea id="serialsText" rows={5} className="font-mono" autoFocus {...register("serialsText")} />
        </Field>
      ) : (
        <Field label="Quantity received" htmlFor="quantity" required error={errors.quantity?.message}>
          <Input id="quantity" type="number" min="1" autoFocus {...register("quantity", { valueAsNumber: true })} />
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type" htmlFor="type"><NativeSelect id="type" {...register("type")}><option value="PURCHASE">Purchase / restock</option><option value="INITIAL_STOCK">Opening stock</option></NativeSelect></Field>
        {type === "PURCHASE" && <Field label="Unit cost" htmlFor="unitCost" hint="Leave blank to use the product's current cost." error={errors.unitCost?.message}><Input id="unitCost" type="number" min="0" step="0.01" inputMode="decimal" {...register("unitCost", { setValueAs: (value: string) => value === "" ? undefined : Number(value) })} /></Field>}
        <Field label="Supplier invoice / reference" htmlFor="reference" error={errors.reference?.message}><Input id="reference" {...register("reference")} /></Field>
      </div>
      <Field label="Note" htmlFor="reason" hint="Optional if you entered a reference."><Input id="reason" {...register("reason")} /></Field>
      <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Adding…" : "Add stock"}</Button></DialogFooter>
    </form>
  );
}

function AdjustForm({ product, onClose }: { product: StockProduct; onClose: () => void }) {
  const router = useRouter();
  const serialized = product.trackingType !== "QUANTITY";
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<AdjustStockValues>({
    resolver: zodResolver(adjustStockSchema),
    defaultValues: { productId: product.id, type: serialized ? "DAMAGE" : "ADJUSTMENT", direction: "DECREASE", quantity: 1, serialsText: "", reason: "" },
  });
  const type = watch("type");
  return (
    <form
      noValidate className="grid gap-4"
      onSubmit={handleSubmit(async (v) => {
        const res = await adjustStockAction(v);
        if (!res.ok) return void toast.error(res.error);
        toast.success(`Stock updated · now ${res.data.newQuantity}`);
        onClose();
        router.refresh();
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="What happened?" htmlFor="adj-type">
          <NativeSelect id="adj-type" {...register("type")}>
            {!serialized && <option value="ADJUSTMENT">Stock count correction</option>}
            <option value="DAMAGE">Damaged</option>
            <option value="LOST">Lost / stolen</option>
          </NativeSelect>
        </Field>
        {type === "ADJUSTMENT" && !serialized && (
          <Field label="Direction" htmlFor="direction"><NativeSelect id="direction" {...register("direction")}><option value="DECREASE">Remove units</option><option value="INCREASE">Add units</option></NativeSelect></Field>
        )}
      </div>
      {serialized ? (
        <Field label={product.trackingType === "IMEI" ? "IMEI numbers affected" : "Serial numbers affected"} htmlFor="adj-serials" required error={errors.serialsText?.message}>
          <Textarea id="adj-serials" rows={4} className="font-mono" {...register("serialsText")} />
        </Field>
      ) : (
        <Field label="Quantity" htmlFor="adj-qty" required error={errors.quantity?.message}><Input id="adj-qty" type="number" min="1" {...register("quantity", { valueAsNumber: true })} /></Field>
      )}
      <Field label="Reason" htmlFor="adj-reason" required error={errors.reason?.message} hint="Required. Appears in inventory history and audit logs."><Textarea id="adj-reason" rows={2} {...register("reason")} /></Field>
      <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Record adjustment"}</Button></DialogFooter>
    </form>
  );
}
