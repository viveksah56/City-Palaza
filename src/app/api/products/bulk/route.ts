import {PERMISSION} from "@/lib/rbac/permission";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { DomainError, toActionError } from "@/lib/errors";
import { assertPermission } from "@/lib/auth/guards";
import { importProductsCsv } from "@/server/product-import.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await assertPermission(PERMISSION.PRODUCT_CREATE);
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a CSV file to upload." }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".csv")) return NextResponse.json({ error: "Upload a .csv file." }, { status: 415 });
    if (file.size === 0) return NextResponse.json({ error: "The selected CSV file is empty." }, { status: 400 });
    if (file.size > 1_000_000) return NextResponse.json({ error: "CSV file is too large. Maximum size is 1 MB." }, { status: 413 });

    const result = await importProductsCsv(actor, await file.text());
    if (result.issues.length) return NextResponse.json({ error: "No products were imported. Fix the listed rows and upload again.", issues: result.issues }, { status: 422 });

    revalidatePath("/products");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    revalidateTag("categories", "max");
    revalidateTag("brands", "max");
    return NextResponse.json({ imported: result.imported });
  } catch (error) {
    const actionError = toActionError(error);
    const status = error instanceof DomainError
      ? error.code === "UNAUTHENTICATED" ? 401 : error.code === "FORBIDDEN" ? 403 : error.code === "CONFLICT" || error.code === "DUPLICATE" ? 409 : 422
      : 500;
    return NextResponse.json({ error: actionError.error, ...(actionError.fieldErrors && { fieldErrors: actionError.fieldErrors }) }, { status });
  }
}
