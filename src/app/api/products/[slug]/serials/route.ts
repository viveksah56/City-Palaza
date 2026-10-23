import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import {PERMISSION, hasPermission} from "@/lib/rbac/permission";
import { listSerialsByProductSlug } from "@/server/inventory.service";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!hasPermission(user.role, PERMISSION.SALE_CREATE)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { slug } = await params;
  return NextResponse.json({ serials: await listSerialsByProductSlug(slug, "IN_STOCK") });
}
