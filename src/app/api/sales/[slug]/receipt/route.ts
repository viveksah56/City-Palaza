import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { PERMISSION, hasPermission } from "@/lib/rbac/permission";
import { getSaleForUserBySlug } from "@/server/sales.service";
import { readSettings } from "@/server/settings.service";
import { rateLimitResponse } from "@/lib/rate-limit";
import { createReceiptPdf } from "@/server/receipt-document";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const limited = await rateLimitResponse(_request, "sales:receipt", { limit: 30, windowSeconds: 300 });
  if (limited) return limited;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!hasPermission(user.role, PERMISSION.SALE_VIEW)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { slug } = await params;
  const sale = await getSaleForUserBySlug(user, slug);
  if (!sale) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const settings = await readSettings();
  const pdf = await createReceiptPdf(sale, settings);
  const filename = `receipt-${sale.saleNumber.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
