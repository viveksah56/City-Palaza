"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Check, Clipboard, LoaderCircle, LockKeyhole, Pencil, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PRODUCT_BRAND_SELECTION, PRODUCT_CATEGORY_SELECTION } from "@/lib/constants/categories";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate as formatStoreDate } from "@/lib/format";
import { checkProductBarcodeAction, createProductAction, updateProductAction } from "@/server/actions";
import { useMediaQuery } from "@/hooks/use-media-query";
import { productFormSchema, type ProductFormInput, type ProductFormProduct, type ProductFormValues } from "./product-form-schema";

type Option = { id: string; name: string };
type Mode = "add" | "edit";

function makeSkuPreview(category: string, name: string, variant: string) {
  const token = (value: string, fallback: string) => value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12) || fallback;
  const parts = [token(category, "ITEM"), token(name, "PRODUCT"), variant ? token(variant, "VARIANT") : ""];
  return parts.filter(Boolean).join("-").slice(0, 40);
}

function RequiredMark() {
  return <span aria-hidden="true" className="ml-1 text-destructive">*</span>;
}

type AdornedInputProps = React.ComponentProps<typeof Input> & { leading?: React.ReactNode; trailing?: React.ReactNode };
const AdornedInput = React.forwardRef<HTMLInputElement, AdornedInputProps>(({ leading, trailing, className, ...props }, ref) => (
  <div className="relative min-w-0">
    {leading && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">{leading}</span>}
    <Input ref={ref} className={cn(leading && "pl-10", trailing && "pr-9", className)} {...props} />
    {trailing && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">{trailing}</span>}
  </div>
));
AdornedInput.displayName = "AdornedInput";

function FieldShell({ label, required, description, className, children }: { label: string; required?: boolean; description?: string; className?: string; children: React.ReactNode }) {
  return (
    <FormItem className={cn("min-w-0 gap-1.5", className)}>
      <FormLabel className="min-h-5 text-sm font-medium">{label}{required && <RequiredMark />}</FormLabel>
      <FormControl>{children as React.ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>}</FormControl>
      <div className="min-h-9">
        {description && <FormDescription className="mt-1 text-xs leading-4">{description}</FormDescription>}
        <FormMessage className="mt-1" />
      </div>
    </FormItem>
  );
}

export type ProductFormDialogProps = {
  mode: Mode;
  categories: Option[];
  brands: Option[];
  defaultValues?: ProductFormProduct;
  productId?: string;
  triggerLabel?: string;
  triggerIconOnly?: boolean;
  autoOpen?: boolean;
  canSeeCost?: boolean;
  onSaved?: () => void;
};

export function ProductFormDialog({ mode, categories, brands, defaultValues, productId, triggerLabel, triggerIconOnly = false, autoOpen = false, canSeeCost = true, onSaved }: ProductFormDialogProps) {
  const router = useRouter();
  const isMobile = useMediaQuery("(max-width: 639px)");
  const isEdit = mode === "edit";
  const [open, setOpen] = React.useState(autoOpen);
  const [confirmClose, setConfirmClose] = React.useState(false);
  const [skuEditable, setSkuEditable] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [barcodeChecking, setBarcodeChecking] = React.useState(false);
  const form = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    mode: "onBlur",
    shouldFocusError: true,
    defaultValues: {
      sku: "", barcode: "", name: "", variantLabel: "", description: "", categoryId: "", customCategory: "", brandId: "", customBrand: "",
      purchasePrice: 0, sellingPrice: 0, maxDiscountPercent: 5,
      trackingType: "QUANTITY", openingQuantity: 0, openingSerialsText: "",
      ...defaultValues,
    },
  });

  const categoryId = form.watch("categoryId");
  const brandId = form.watch("brandId");
  const selectedCategory = categories.find((category) => category.id === categoryId)?.name ?? (categoryId === PRODUCT_CATEGORY_SELECTION.CUSTOM ? "Other" : "");
  const name = form.watch("name") ?? "";
  const variant = form.watch("variantLabel") ?? "";
  const sku = form.watch("sku") ?? "";
  const barcode = form.watch("barcode") ?? "";
  const purchasePrice = Number(form.watch("purchasePrice") ?? 0);
  const sellingPrice = Number(form.watch("sellingPrice") ?? 0);
  const margin = sellingPrice - purchasePrice;
  const marginPercent = purchasePrice > 0 ? (margin / purchasePrice) * 100 : null;
  const skuPreview = makeSkuPreview(selectedCategory, name, variant);

  const requestClose = React.useCallback((nextOpen: boolean) => {
    if (!nextOpen && form.formState.isDirty) {
      setConfirmClose(true);
      return;
    }
    setOpen(nextOpen);
    if (nextOpen) setSkuEditable(false);
  }, [form.formState.isDirty]);

  React.useEffect(() => {
    const normalized = barcode.trim();
    if (!normalized) {
      form.clearErrors("barcode");
      setBarcodeChecking(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      setBarcodeChecking(true);
      const result = await checkProductBarcodeAction(normalized, productId);
      if (!active) return;
      setBarcodeChecking(false);
      if (result.ok && !result.data) form.setError("barcode", { type: "validate", message: "A product with this barcode already exists." });
      else if (result.ok) form.clearErrors("barcode");
    }, 400);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [barcode, form, productId]);

  const copySku = async () => {
    if (!sku) return;
    try {
      await navigator.clipboard.writeText(sku);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy the SKU. Select and copy it manually.");
    }
  };

  const submit = form.handleSubmit(async (values) => {
    if (isEdit && !productId) {
      toast.error("This product could not be identified. Close the form and reopen it from the product row.");
      return;
    }
    try {
      if (values.barcode?.trim()) {
        const available = await checkProductBarcodeAction(values.barcode.trim(), productId);
        if (available.ok && !available.data) {
          form.setError("barcode", { type: "validate", message: "A product with this barcode already exists." });
          form.setFocus("barcode");
          return;
        }
      }
      const payload = {
        ...values,
        sku: values.sku.trim() || (!isEdit ? skuPreview : ""),
        purchasePrice: canSeeCost ? values.purchasePrice : Number(defaultValues?.purchasePrice ?? 0),
      };
      const result = isEdit ? await updateProductAction(productId!, payload) : await createProductAction(payload);
      if (!result.ok) {
        Object.entries(result.fieldErrors ?? {}).forEach(([field, messages]) => {
          if (messages?.[0]) form.setError(field as keyof ProductFormInput, { type: "server", message: messages[0] });
        });
        toast.error(result.error || "The product could not be saved. Check the fields and try again.");
        return;
      }
      toast.success(isEdit ? "Product changes saved" : "Product created");
      form.reset(values);
      setOpen(false);
      onSaved?.();
      router.refresh();
    } catch {
      toast.error("Could not save the product right now. Check your connection and try again.");
    }
  }, (errors) => {
    const firstInvalid = Object.keys(errors)[0] as keyof ProductFormInput | undefined;
    if (firstInvalid) form.setFocus(firstInvalid);
    toast.error("Review the highlighted fields and try again.");
  });

  const updateCategory = (value: string) => {
    form.setValue("categoryId", value, { shouldDirty: true, shouldValidate: true });
    if (value !== PRODUCT_CATEGORY_SELECTION.CUSTOM) form.setValue("customCategory", "", { shouldDirty: true });
  };
  const updateBrand = (value: string) => {
    form.setValue("brandId", value, { shouldDirty: true, shouldValidate: true });
    if (value !== PRODUCT_BRAND_SELECTION.CUSTOM) form.setValue("customBrand", "", { shouldDirty: true });
  };

  return (
    <TooltipProvider delayDuration={350}>
      <Dialog open={open} onOpenChange={requestClose}>
        <DialogTrigger asChild>
          <Button type="button" size={triggerIconOnly ? "icon" : "default"} variant={isEdit ? "outline" : "default"} aria-label={triggerIconOnly ? triggerLabel ?? `Edit ${defaultValues?.name ?? "product"}` : undefined}>
            {isEdit ? <Pencil data-icon={triggerIconOnly ? undefined : "inline-start"} /> : <Plus data-icon="inline-start" />}
            {triggerIconOnly ? null : triggerLabel ?? (isEdit ? "Edit product" : "Add product")}
          </Button>
        </DialogTrigger>
        <DialogContent
          className={isMobile
            ? "inset-x-0 bottom-0 top-auto left-0 h-[96dvh] max-h-[96dvh] w-full max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-t-2xl rounded-b-none p-0 pb-[env(safe-area-inset-bottom)]"
            : "grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl"}
        >
          <DialogHeader className="border-b border-border/60 bg-card/95 px-4 py-4 pr-14 backdrop-blur sm:px-6">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <DialogTitle>{isEdit ? "Edit product" : "Add product"}</DialogTitle>
                <DialogDescription className="mt-1">{isEdit ? "Update product details and pricing. Existing sales and stock history stay unchanged." : "Create a product and add its opening stock if you have it on hand."}</DialogDescription>
              </div>
              {isEdit && form.formState.isDirty && <Badge variant="warning" className="shrink-0">Unsaved changes</Badge>}
            </div>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6">
            <Form {...form}>
              <form id="product-form" onSubmit={(event) => void submit(event)} className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2" noValidate>
                <Card className="min-w-0 rounded-xl border-border/60 bg-card shadow-sm md:col-span-2">
                  <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3"><CardTitle className="text-base">Details</CardTitle><CardDescription>Product identity and catalog organization.</CardDescription></CardHeader>
                  <CardContent className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-3 p-4 pt-0 sm:p-6 sm:pt-0 md:grid-cols-2">
                    <FormField control={form.control} name="name" render={({ field }) => <FieldShell label="Product name" required className="md:col-span-2"><Input autoFocus={!isEdit} autoComplete="off" placeholder="e.g. iPhone 15" enterKeyHint="next" aria-required="true" {...field} /></FieldShell>} />
                    <FormField control={form.control} name="variantLabel" render={({ field }) => <FieldShell label="Variant" description="Optional, for example Black · 256 GB."><Input autoComplete="off" placeholder="Color, size, model…" enterKeyHint="next" {...field} value={field.value ?? ""} /></FieldShell>} />

                    <FormField control={form.control} name="sku" render={({ field }) => <FieldShell label="SKU" description={isEdit ? "Read-only to prevent accidental changes to existing references." : `Suggested SKU: ${skuPreview || "Enter a name and category"}`}>
                      <div className="flex min-w-0 gap-2">
                        <Input className="min-w-0 font-mono" placeholder={isEdit ? undefined : "Generated automatically"} readOnly={isEdit && !skuEditable} {...field} value={field.value ?? ""} />
                        {isEdit ? <Tooltip><TooltipTrigger asChild><Button type="button" variant="outline" size="icon" aria-label={skuEditable ? "Keep current SKU" : "Change SKU"} onClick={() => setSkuEditable((value) => !value)}>{skuEditable ? <X /> : <Pencil />}</Button></TooltipTrigger><TooltipContent>{skuEditable ? "Keep current SKU" : "Change SKU"}</TooltipContent></Tooltip> : null}
                        {isEdit && <Tooltip><TooltipTrigger asChild><Button type="button" variant="outline" size="icon" aria-label="Copy SKU" onClick={() => void copySku()}>{copied ? <Check /> : <Clipboard />}</Button></TooltipTrigger><TooltipContent>{copied ? "Copied" : "Copy SKU"}</TooltipContent></Tooltip>}
                      </div>
                    </FieldShell>} />
                    <FormField control={form.control} name="barcode" render={({ field }) => <FieldShell label="Barcode" description={barcodeChecking ? "Checking barcode…" : "Optional; duplicate barcodes are rejected before saving."}><Input autoComplete="off" inputMode="numeric" enterKeyHint="next" {...field} value={field.value ?? ""} /></FieldShell>} />

                    <FormField control={form.control} name="categoryId" render={({ field, fieldState }) => <FieldShell label="Category" required>
                      <Select value={field.value} onValueChange={updateCategory}>
                        <SelectTrigger id="categoryId-control" aria-label="Category" aria-required="true" aria-invalid={fieldState.invalid} aria-describedby={fieldState.error ? "categoryId-message" : undefined} onBlur={field.onBlur}><SelectValue placeholder="Choose a category" /></SelectTrigger>
                        <SelectContent><SelectGroup>{categories.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}<SelectItem value={PRODUCT_CATEGORY_SELECTION.CUSTOM}>Create a new category…</SelectItem></SelectGroup></SelectContent>
                      </Select>
                    </FieldShell>} />
                    <FormField control={form.control} name="brandId" render={({ field, fieldState }) => <FieldShell label="Brand" className={categoryId === PRODUCT_CATEGORY_SELECTION.CUSTOM || brandId === PRODUCT_BRAND_SELECTION.CUSTOM ? undefined : "md:col-span-2"} description="Optional. Type while the menu is open to find a brand quickly.">
                      <Select value={field.value || "none"} onValueChange={(value) => updateBrand(value === "none" ? "" : value)}>
                        <SelectTrigger id="brandId-control" aria-label="Brand" aria-invalid={fieldState.invalid} aria-describedby={fieldState.error ? "brandId-message" : undefined} onBlur={field.onBlur}><SelectValue placeholder="Choose a brand" /></SelectTrigger>
                        <SelectContent><SelectGroup><SelectItem value="none">No brand</SelectItem>{brands.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}<SelectItem value={PRODUCT_BRAND_SELECTION.CUSTOM}>Create a new brand…</SelectItem></SelectGroup></SelectContent>
                      </Select>
                    </FieldShell>} />
                    {categoryId === PRODUCT_CATEGORY_SELECTION.CUSTOM && <FormField control={form.control} name="customCategory" render={({ field }) => <FieldShell label="New category" required description="This category will be added to your catalog."><Input autoComplete="off" enterKeyHint="next" {...field} value={field.value ?? ""} /></FieldShell>} />}
                    {brandId === PRODUCT_BRAND_SELECTION.CUSTOM && <FormField control={form.control} name="customBrand" render={({ field }) => <FieldShell label="New brand" required description="This brand will be added to your catalog."><Input autoComplete="off" enterKeyHint="next" {...field} value={field.value ?? ""} /></FieldShell>} />}
                    <FormField control={form.control} name="description" render={({ field }) => <FieldShell label="Description" className="md:col-span-2" description="Optional product notes, up to 1,000 characters."><Textarea className="min-h-20" maxLength={1000} {...field} value={field.value ?? ""} /></FieldShell>} />
                  </CardContent>
                </Card>

                <Card className="min-w-0 rounded-xl border-border/60 bg-card shadow-sm md:col-span-2">
                  <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
                    <CardTitle className="text-base">Pricing</CardTitle>
                    <CardDescription className="flex items-center gap-1.5"><LockKeyhole aria-hidden className="size-3.5" />Only admins can see or change purchase prices. Past sales keep their original prices.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-3 p-4 pt-0 sm:p-6 sm:pt-0 md:grid-cols-2">
                    {canSeeCost && <FormField control={form.control} name="purchasePrice" render={({ field }) => <FieldShell label="Purchase price" required><AdornedInput leading="Rs" aria-required="true" type="number" min="0" step="0.01" inputMode="decimal" enterKeyHint="next" {...field} onChange={(event) => field.onChange(event.target.value === "" ? 0 : Number(event.target.value))} /></FieldShell>} />}
                    <FormField control={form.control} name="sellingPrice" render={({ field }) => <FieldShell label="Selling price" required><AdornedInput leading="Rs" aria-required="true" type="number" min="0" step="0.01" inputMode="decimal" enterKeyHint="next" {...field} onChange={(event) => field.onChange(event.target.value === "" ? 0 : Number(event.target.value))} /></FieldShell>} />
                    <FormField control={form.control} name="maxDiscountPercent" render={({ field }) => <FieldShell label="Maximum item discount" description="Employees cannot discount an item beyond this limit."><AdornedInput trailing="%" type="number" min="0" max="100" step="0.01" inputMode="decimal" enterKeyHint="next" {...field} onChange={(event) => field.onChange(event.target.value === "" ? 0 : Number(event.target.value))} /></FieldShell>} />
                    <div className="flex min-h-[4.75rem] items-center md:col-span-2">
                      <Badge variant={margin < 0 ? "destructive" : "secondary"} className="gap-1.5 px-3 py-1.5">
                        {margin < 0 && <AlertCircle aria-hidden />}
                        Profit margin: {formatCurrency(margin, "NPR")}{marginPercent !== null ? ` · ${marginPercent.toFixed(1)}%` : " · set a purchase price for %"}
                      </Badge>
                    </div>
                    {sellingPrice < purchasePrice && <p className="text-xs text-destructive md:col-span-2">Selling price is below purchase price. This is allowed, but review the pricing before saving.</p>}
                  </CardContent>
                </Card>

                {!isEdit && <Card className="min-w-0 rounded-xl border-border/60 bg-card shadow-sm md:col-span-2">
                  <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3"><CardTitle className="text-base">Opening inventory</CardTitle><CardDescription>Optional. You can also receive stock later from Inventory.</CardDescription></CardHeader>
                  <CardContent className="grid min-w-0 grid-cols-1 gap-x-6 gap-y-3 p-4 pt-0 sm:p-6 sm:pt-0 md:grid-cols-2">
                    <FormField control={form.control} name="trackingType" render={({ field }) => <FieldShell label="Stock tracking"><Select value={field.value} onValueChange={(value) => { field.onChange(value); if (value !== "QUANTITY") form.setValue("openingQuantity", 0, { shouldDirty: true }); }}><SelectTrigger aria-label="Stock tracking"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="QUANTITY">Quantity only</SelectItem><SelectItem value="IMEI">IMEI (each phone)</SelectItem><SelectItem value="SERIALIZED">Serial number</SelectItem></SelectGroup></SelectContent></Select></FieldShell>} />
                    {form.watch("trackingType") === "QUANTITY" ? <FormField control={form.control} name="openingQuantity" render={({ field }) => <FieldShell label="Opening stock" description="Whole number of units available at launch."><Input type="number" min="0" step="1" inputMode="numeric" enterKeyHint="done" {...field} onChange={(event) => field.onChange(event.target.value === "" ? 0 : Number(event.target.value))} /></FieldShell>} /> : <FormField control={form.control} name="openingSerialsText" render={({ field }) => <FieldShell label={form.watch("trackingType") === "IMEI" ? "Opening IMEI numbers" : "Opening serial numbers"} description="Enter one value per line or separate values with commas."><Textarea className="min-h-20" {...field} value={field.value ?? ""} /></FieldShell>} />}
                  </CardContent>
                </Card>}
              </form>
            </Form>
          </div>

          <div className="border-t border-border/60 bg-card/95 px-4 py-3 backdrop-blur sm:px-6">
            {isEdit && (defaultValues?.createdAt || defaultValues?.updatedAt) && <p className="mb-2 text-xs text-muted-foreground">{defaultValues?.createdAt ? `Created ${formatStoreDate(defaultValues.createdAt)}` : ""}{defaultValues?.createdAt && defaultValues?.updatedAt ? " · " : ""}{defaultValues?.updatedAt ? `Updated ${formatStoreDate(defaultValues.updatedAt)}` : ""}</p>}
            <Separator className="mb-3" />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="min-h-11 sm:min-h-10" onClick={() => requestClose(false)}>Cancel</Button>
              <Button type="submit" form="product-form" className="min-h-11 sm:min-h-10" disabled={form.formState.isSubmitting || barcodeChecking || (isEdit && !form.formState.isDirty)}>
                {form.formState.isSubmitting ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
                {form.formState.isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create product"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle><AlertDialogDescription>Your product changes have not been saved. Close the form and lose these edits?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmClose(false)}>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmClose(false); form.reset(); setOpen(false); }}>Discard changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
