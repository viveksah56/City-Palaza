import * as React from "react";
import { getSessionUser } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/rbac/permission";

/** UI-only convenience. Real enforcement is always repeated server-side in actions/handlers. */
export async function PermissionGate({ permission, children, fallback = null }: { permission: Permission; children: React.ReactNode; fallback?: React.ReactNode }) {
  const user = await getSessionUser();
  return hasPermission(user?.role, permission) ? <>{children}</> : <>{fallback}</>;
}
