"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addStockSchema, adjustStockSchema, type AddStockInput, type AddStockValues, type AdjustStockValues } from "@/validations/inventory";
import { addStockAction, adjustStockAction } from "@/server/actions";
import type { StockProduct } from "./inventory-adjustment-form";

export function StockDialog({ mode, product, onClose }: { mode: "add" | "remove"; product: StockProduct; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[min(90dvh,46rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add stock" : "Remove stock"}</DialogTitle>
          <DialogDescription>{product.name} · <span className="font-mono">{product.sku}</span> · {product.quantity} on hand</DialogDescription>
        </DialogHeader>
        {mode === "add" ? <AddForm product={product} onClose={onClose} /> : <RemoveForm product={product} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function AddForm({ product, onClose }: { product: StockProduct; onClose: () => void }) {
  const router = useRouter();
  const serialized = product.trackingType !== "QUANTITY";
  const form = useForm<AddStockInput, unknown, AddStockValues>({
    resolver: zodResolver(addStockSchema),
    defaultValues: { productId: product.id, type: "PURCHASE", quantity: serialized ? undefined : 1, serialsText: "", reference: "", reason: "" },
  });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = form;
  return (
    <Form {...form}>
    <form
      noValidate className="grid gap-4"
      onSubmit={handleSubmit(async (v) => {
        try {
          const res = await addStockAction(v);
          if (!res.ok) return void toast.error(res.error);
          toast.success(`Added ${res.data.quantity} · stock now ${res.data.newQuantity}`);
          onClose();
          router.refresh();
        } catch {
          toast.error("Stock could not be added. Check your connection and try again.");
        }
      })}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Unit cost" htmlFor="unitCost" hint="Leave blank to use the product's current cost." error={errors.unitCost?.message}><Input id="unitCost" type="number" min="0" step="0.01" inputMode="decimal" {...register("unitCost", { setValueAs: (value: string) => value === "" ? undefined : Number(value) })} /></Field>
        {serialized ? (
          <Field label={product.trackingType === "IMEI" ? "IMEI numbers" : "Serial numbers"} htmlFor="serialsText" required hint="One per line or comma-separated. A scanner works too." error={errors.serialsText?.message} className="md:col-span-2">
            <Textarea id="serialsText" rows={5} className="font-mono" autoFocus {...register("serialsText")} />
          </Field>
        ) : (
          <Field label="Quantity received" htmlFor="quantity" required error={errors.quantity?.message}>
            <Input id="quantity" type="number" min="1" autoFocus {...register("quantity", { valueAsNumber: true })} />
          </Field>
        )}
        <Field label="Supplier invoice / reference" htmlFor="reference" error={errors.reference?.message}><Input id="reference" {...register("reference")} /></Field>
        <Field label="Note" htmlFor="reason" hint="Optional if you entered a reference." className="md:col-span-2"><Input id="reason" {...register("reason")} /></Field>
      </div>
      <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Adding…" : "Add stock"}</Button></DialogFooter>
    </form>
    </Form>
  );
}

function RemoveForm({ product, onClose }: { product: StockProduct; onClose: () => void }) {
  const router = useRouter();
  const serialized = product.trackingType !== "QUANTITY";
  const form = useForm<AdjustStockValues>({
    resolver: zodResolver(adjustStockSchema),
    defaultValues: { productId: product.id, type: serialized ? "DAMAGE" : "ADJUSTMENT", quantity: 1, serialsText: "", reason: "" },
  });
  const { control, register, handleSubmit, formState: { errors, isSubmitting } } = form;
  return (
    <Form {...form}>
    <form
      noValidate className="grid gap-4"
      onSubmit={handleSubmit(async (v) => {
        try {
          const res = await adjustStockAction(v);
          if (!res.ok) return void toast.error(res.error);
          toast.success(`Stock removed · now ${res.data.newQuantity}`);
          onClose();
          router.refresh();
        } catch {
          toast.error("Stock could not be removed. Check your connection and try again.");
        }
      })}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField control={control} name="type" render={({ field }) => (
          <FormItem>
          <FormLabel>Removal reason</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>
              {!serialized && <SelectItem value="ADJUSTMENT">Remove units</SelectItem>}
                <SelectItem value="DAMAGE">Damaged</SelectItem>
                <SelectItem value="LOST">Lost / stolen</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>Every removal is recorded in inventory history.</FormDescription>
            <FormMessage />
          </FormItem>
        )} />
        {serialized ? (
          <Field label={product.trackingType === "IMEI" ? "IMEI numbers affected" : "Serial numbers affected"} htmlFor="adj-serials" required error={errors.serialsText?.message} className="md:col-span-2">
            <Textarea id="adj-serials" rows={4} className="font-mono" {...register("serialsText")} />
          </Field>
        ) : (
          <Field label="Quantity" htmlFor="adj-qty" required error={errors.quantity?.message}><Input id="adj-qty" type="number" min="1" {...register("quantity", { valueAsNumber: true })} /></Field>
        )}
        <Field label="Reason" htmlFor="adj-reason" required error={errors.reason?.message} hint="Required. Appears in inventory history and audit logs." className="md:col-span-2"><Textarea id="adj-reason" rows={2} {...register("reason")} /></Field>
      </div>
      <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Removing…" : "Remove stock"}</Button></DialogFooter>
    </form>
    </Form>
  );
}
