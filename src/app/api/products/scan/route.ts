import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { PERMISSION, hasPermission } from "@/lib/rbac/permission";
import { resolveScan } from "@/server/products.service";
import { rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: Request) {
  const limited = await rateLimitResponse(req, "products:scan", { limit: 300, windowSeconds: 300 });
  if (limited) return limited;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!hasPermission(user.role, PERMISSION.SALE_CREATE)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const code = (new URL(req.url).searchParams.get("code") ?? "").slice(0, 64);
  return NextResponse.json({ result: await resolveScan(code) });
}
