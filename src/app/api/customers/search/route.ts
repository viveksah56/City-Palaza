import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import {PERMISSION, hasPermission} from "@/lib/rbac/permission";
import { searchCustomers } from "@/server/customers.service";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!hasPermission(user.role, PERMISSION.CUSTOMER_VIEW)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ customers: await searchCustomers(q.slice(0, 80)) });
}
