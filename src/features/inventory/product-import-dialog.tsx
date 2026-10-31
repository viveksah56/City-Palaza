"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Download, FileUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { api } from "@/lib/axios";

type ImportIssue = { row: number; sku?: string; message: string };
type ImportResponse = { imported?: number; error?: string; issues?: ImportIssue[] };

export function ProductImportDialog() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [issues, setIssues] = React.useState<ImportIssue[]>([]);
  const importMutation = useMutation({
    mutationFn: async (selectedFile: File): Promise<ImportResponse> => {
      const body = new FormData();
      body.set("file", selectedFile);
      const response = await api.post<ImportResponse>("/products/bulk", body);
      return response.data;
    },
    onSuccess: async (result) => {
      toast.success(`${result.imported ?? 0} products imported`);
      setOpen(false);
      setFile(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      ]);
      router.refresh();
    },
    onError: (error: unknown) => {
      if (axios.isAxiosError<ImportResponse>(error)) {
        const result = error.response?.data;
        setIssues(result?.issues ?? []);
        toast.error(result?.error ?? "Upload failed.");
        return;
      }
      toast.error("Upload failed. Check your connection and try again.");
    },
  });
  const submitting = importMutation.isPending;

  function upload() {
    if (!file) return toast.error("Choose a CSV file first.");
    setIssues([]);
    importMutation.mutate(file);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setIssues([]); }}>
      <DialogTrigger asChild><Button variant="outline"><FileUp data-icon="inline-start" /> Bulk upload</Button></DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import products from CSV</DialogTitle>
          <DialogDescription>Upload your catalogue and opening stock together. The import is all-or-nothing, and existing SKUs are left unchanged.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Button asChild variant="outline" className="w-fit">
            <a href="/citypalaza-products-template.csv" download><Download data-icon="inline-start" /> Download CSV template</a>
          </Button>
          <Field label="CSV file" htmlFor="product-import-file" required hint="Maximum 250 products and 1 MB per upload.">
            <Input id="product-import-file" type="file" accept=".csv,text/csv" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setIssues([]); }} />
          </Field>
          <Card className="gap-2 rounded-xl bg-muted/50 py-3 shadow-none">
            <CardHeader className="gap-1 px-4">
              <CardTitle className="text-sm">Before you import</CardTitle>
              <CardDescription className="text-xs leading-5"><span className="font-medium text-foreground">Required columns:</span> name, category, purchasePrice, sellingPrice. SKU, stock, tracking type, serials, and maximum employee discount are optional.</CardDescription>
            </CardHeader>
            <div className="px-4 text-xs leading-5 text-muted-foreground">Categories and brands are created when missing. Use <span className="font-medium text-foreground">QUANTITY</span> for count-tracked items or <span className="font-medium text-foreground">IMEI</span> / <span className="font-medium text-foreground">SERIALIZED</span> for devices. List identifiers separated by a pipe (|); quantity must match.</div>
            {file && <div className="px-4"><Badge variant="secondary">Selected: {file.name}</Badge></div>}
          </Card>
          {issues.length > 0 && (
            <div role="alert" className="max-h-44 overflow-y-auto rounded-xl border border-destructive/25 bg-destructive/5 p-3">
              <p className="mb-2 text-sm font-medium text-destructive">Fix these rows and upload again</p>
              <ul className="grid gap-1.5 text-xs text-muted-foreground">
                {issues.slice(0, 40).map((issue, index) => <li key={`${issue.row}-${index}`}><span className="font-medium text-foreground">Row {issue.row}{issue.sku ? ` · ${issue.sku}` : ""}:</span> {issue.message}</li>)}
                {issues.length > 40 && <li>And {issues.length - 40} more issue(s).</li>}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={submitting}>Cancel</Button></DialogClose>
          <Button onClick={upload} disabled={!file || submitting}><FileUp data-icon="inline-start" />{submitting ? "Importing…" : "Import products"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
