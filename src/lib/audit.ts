import type { Prisma } from "@/generated/prisma/client";
import { prisma, type Db } from "./db";

export type AuditAction =
  | "LOGIN" | "LOGOUT"
  | "PRODUCT_CREATE" | "PRODUCT_UPDATE" | "PRODUCT_DEACTIVATE" | "PRODUCT_DELETE"
  | "CATEGORY_CREATE" | "CATEGORY_UPDATE" | "CATEGORY_DELETE"
  | "BRAND_CREATE" | "BRAND_UPDATE" | "BRAND_DELETE"
  | "STOCK_ADD" | "STOCK_ADJUST"
  | "SALE_CREATE" | "SALE_VOID"
  | "CUSTOMER_CREATE" | "CUSTOMER_UPDATE"
  | "EMPLOYEE_CREATE" | "EMPLOYEE_UPDATE" | "EMPLOYEE_DISABLE" | "EMPLOYEE_REACTIVATE" | "EMPLOYEE_PASSWORD_RESET"
  | "SETTINGS_UPDATE";

export const AUDIT_ACTIONS: AuditAction[] = [
  "LOGIN", "LOGOUT", "PRODUCT_CREATE", "PRODUCT_UPDATE", "PRODUCT_DEACTIVATE", "PRODUCT_DELETE",
  "CATEGORY_CREATE", "CATEGORY_UPDATE", "CATEGORY_DELETE", "BRAND_CREATE", "BRAND_UPDATE", "BRAND_DELETE",
  "STOCK_ADD", "STOCK_ADJUST", "SALE_CREATE", "SALE_VOID", "CUSTOMER_CREATE", "CUSTOMER_UPDATE",
  "EMPLOYEE_CREATE", "EMPLOYEE_UPDATE", "EMPLOYEE_DISABLE", "EMPLOYEE_REACTIVATE", "EMPLOYEE_PASSWORD_RESET",
  "SETTINGS_UPDATE",
];

async function requestMeta(): Promise<{ ip: string | null; ua: string | null }> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
    return { ip: ip ?? null, ua: h.get("user-agent")?.slice(0, 255) ?? null };
  } catch {
    return { ip: null, ua: null }; // outside a request (seed, tests)
  }
}

/** Pass the transaction client so the audit row commits/rolls back with the business change. */
export async function writeAudit(
  db: Db,
  e: {
    actorId: string | null;
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    description: string;
    metadata?: Prisma.InputJsonValue;
  },
) {
  const { ip, ua } = await requestMeta();
  await (db ?? prisma).auditLog.create({
    data: {
      actorId: e.actorId,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId ?? null,
      description: e.description,
      metadata: e.metadata,
      ipAddress: ip,
      userAgent: ua,
    },
  });
}

export { requestMeta };
