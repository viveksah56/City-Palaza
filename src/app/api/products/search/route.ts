import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import {PERMISSION, hasPermission} from "@/lib/rbac/permission";
import { searchSellableProducts } from "@/server/products.service";
import { rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const limited = await rateLimitResponse(req, "products:search", { limit: 120, windowSeconds: 300 });
  if (limited) return limited;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!hasPermission(user.role, PERMISSION.PRODUCT_VIEW)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ products: await searchSellableProducts(q.slice(0, 80)) });
}
