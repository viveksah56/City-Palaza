import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import {PERMISSION, hasPermission} from "@/lib/rbac/permission";
import { getSaleForUser } from "@/server/sales.service";
import { readSettings } from "@/server/settings.service";
import { receiptHtml } from "@/lib/receipt-html";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!hasPermission(user.role, PERMISSION.SALE_VIEW)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const sale = await getSaleForUser(user, id); // enforces "own sales only" for employees
  if (!sale) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const html = receiptHtml(sale, await readSettings());
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Content-Disposition": `attachment; filename="receipt-${sale.saleNumber}.html"`, "Cache-Control": "private, no-store" },
  });
}
