"use server";
import {PERMISSION} from "@/lib/rbac/permission";
/**
 * Every mutation enters here: assert permission → validate with Zod → call a service
 * (which owns the DB transaction) → revalidate.
 */
import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ProductStatus, UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { run, DomainError, type ActionResult } from "@/lib/errors";
import { assertPermission } from "@/lib/auth/guards";
import { TAXONOMY_CACHE_TAG, TAXONOMY_KIND } from "@/lib/constants/categories";
import { createSession, destroySession, getSessionUser } from "@/lib/auth/session";
import { safeInternalRedirect } from "@/lib/auth/redirects";
import { LOW_STOCK_NOTIFICATIONS_CACHE_TAG } from "@/lib/constants";
import { consumePasswordReset, createPasswordReset } from "@/lib/auth/password-reset";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { requestMeta, writeAudit } from "@/lib/audit";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema } from "@/validations/employee";
import { settingsSchema } from "@/validations/settings";
import { addStockSchema, adjustStockSchema, splitSerials } from "@/validations/inventory";
import * as products from "./products.service";
import * as taxonomy from "./taxonomy.service";
import * as inventory from "./inventory.service";
import * as sales from "./sales.service";
import * as customers from "./customers.service";
import * as employees from "./employees.service";
import { updateSettings } from "./settings.service";

// ---------- auth ----------
export async function loginAction(raw: unknown, requestedRedirect?: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  return run(async () => {
    let stage = "input validation";
    try {
      const { email, password } = loginSchema.parse(raw);
      stage = "user lookup";
      const user = await prisma.user.findUnique({ where: { email } });
      const ok = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
      if (!user || !ok) throw new DomainError("UNAUTHENTICATED", "Email or password is incorrect.");
      if (user.status !== "ACTIVE") throw new DomainError("FORBIDDEN", "This account is disabled. Ask an admin to reactivate it.");
      stage = "session creation";
      const meta = await requestMeta();
      await createSession({ userId: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role }, { ip: meta.ip, userAgent: meta.ua });
      stage = "post-login bookkeeping";
      const bookkeeping = await Promise.allSettled([
        prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
        writeAudit(prisma, { actorId: user.id, action: "LOGIN", entityType: "User", entityId: user.id, description: `${user.email} signed in` }),
      ]);
      for (const result of bookkeeping) {
        if (result.status === "rejected") console.error("[login bookkeeping error]", result.reason);
      }
      return { redirectTo: safeInternalRedirect(requestedRedirect) };
    } catch (error) {
      if (!(error instanceof DomainError)) console.error(`[login failure: ${stage}]`, error);
      throw error;
    }
  });
}

export async function logoutAction() {
  try {
    const user = await getSessionUser();
    if (user) await writeAudit(prisma, { actorId: user.id, action: "LOGOUT", entityType: "User", entityId: user.id, description: `${user.email} signed out` });
    await destroySession();
  } catch {
    return { ok: false as const };
  }
  redirect("/login");
}

export async function requestPasswordResetAction(raw: unknown): Promise<ActionResult> {
  const input = forgotPasswordSchema.safeParse(raw);
  if (input.success) {
    try {
      await createPasswordReset(input.data.email);
    } catch {
      return { ok: true, data: undefined };
    }
  }
  return { ok: true, data: undefined };
}

export async function resetPasswordAction(raw: unknown): Promise<ActionResult> {
  return run(async () => {
    const input = resetPasswordSchema.parse(raw);
    await consumePasswordReset(input.token, input.password);
    return undefined;
  });
}

// ---------- products ----------
export async function createProductAction(raw: unknown) {
  return run(async () => {
    const actor = await assertPermission(PERMISSION.PRODUCT_CREATE);
    const res = await products.createProduct(actor, raw);
    updateTag(LOW_STOCK_NOTIFICATIONS_CACHE_TAG);
    revalidatePath("/products");
    revalidatePath("/inventory");
    return res;
  });
}
export async function updateProductAction(id: string, raw: unknown) {
  return run(async () => {
    const actor = await assertPermission(PERMISSION.PRODUCT_UPDATE);
    await products.updateProduct(actor, id, raw);
    updateTag(LOW_STOCK_NOTIFICATIONS_CACHE_TAG);
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return undefined;
  });
}
export async function setProductStatusAction(id: string, status: ProductStatus) {
  return run(async () => {
    const actor = await assertPermission(PERMISSION.PRODUCT_UPDATE);
    z.enum(["ACTIVE", "INACTIVE", "DISCONTINUED"]).parse(status);
    await products.setProductStatus(actor, id, status);
    updateTag(LOW_STOCK_NOTIFICATIONS_CACHE_TAG);
    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
    return undefined;
  });
}
export async function deleteProductAction(id: string) {
  return run(async () => {
    const actor = await assertPermission(PERMISSION.PRODUCT_DELETE);
    await products.deleteProduct(actor, id);
    updateTag(LOW_STOCK_NOTIFICATIONS_CACHE_TAG);
    revalidatePath("/products");
    return undefined;
  });
}

// ---------- categories & brands ----------
export async function saveTaxonomyAction(kind: taxonomy.TaxonomyKind, raw: unknown) {
  return run(async () => {
    kind = z.enum([TAXONOMY_KIND.CATEGORY, TAXONOMY_KIND.BRAND]).parse(kind);
    const isEdit = typeof raw === "object" && raw !== null && "id" in raw && !!(raw as { id?: string }).id;
    const perm = kind === TAXONOMY_KIND.CATEGORY ? (isEdit ? PERMISSION.CATEGORY_UPDATE : PERMISSION.CATEGORY_CREATE) : isEdit ? PERMISSION.BRAND_UPDATE : PERMISSION.BRAND_CREATE;
    const actor = await assertPermission(perm);
    const res = await taxonomy.saveTaxonomy(actor, kind, raw);
    revalidateTag(TAXONOMY_CACHE_TAG[kind], "max");
    revalidatePath("/products", "layout");
    return res;
  });
}
export async function deleteTaxonomyAction(kind: taxonomy.TaxonomyKind, id: string) {
  return run(async () => {
    kind = z.enum([TAXONOMY_KIND.CATEGORY, TAXONOMY_KIND.BRAND]).parse(kind);
    const actor = await assertPermission(kind === TAXONOMY_KIND.CATEGORY ? PERMISSION.CATEGORY_DELETE : PERMISSION.BRAND_DELETE);
    await taxonomy.deleteTaxonomy(actor, kind, id);
    revalidateTag(TAXONOMY_CACHE_TAG[kind], "max");
    revalidatePath("/products", "layout");
    return undefined;
  });
}

// ---------- inventory ----------
export async function addStockAction(raw: unknown) {
  return run(async () => {
    const actor = await assertPermission(PERMISSION.INVENTORY_ADD);
    const v = addStockSchema.parse(raw);
    const res = await inventory.addStock(actor, {
      productId: v.productId,
      type: v.type,
      quantity: typeof v.quantity === "number" && Number.isFinite(v.quantity) ? v.quantity : undefined,
      serials: splitSerials(v.serialsText),
      reason: v.reason,
      reference: v.reference,
    });
    updateTag(LOW_STOCK_NOTIFICATIONS_CACHE_TAG);
    revalidatePath("/inventory");
    revalidatePath("/products");
    revalidatePath("/dashboard");
    return res;
  });
}
export async function adjustStockAction(raw: unknown) {
  return run(async () => {
    const actor = await assertPermission(PERMISSION.INVENTORY_ADJUST);
    const v = adjustStockSchema.parse(raw);
    const res = await inventory.adjustStock(actor, {
      productId: v.productId,
      type: v.type,
      direction: v.direction,
      quantity: typeof v.quantity === "number" && Number.isFinite(v.quantity) ? v.quantity : undefined,
      serials: splitSerials(v.serialsText),
      reason: v.reason,
    });
    updateTag(LOW_STOCK_NOTIFICATIONS_CACHE_TAG);
    revalidatePath("/inventory");
    revalidatePath("/products");
    revalidatePath("/dashboard");
    return res;
  });
}

// ---------- sales ----------
export async function createSaleAction(raw: unknown) {
  return run(async () => {
    const actor = await assertPermission(PERMISSION.SALE_CREATE);
    const res = await sales.createSale(actor, raw);
    updateTag(LOW_STOCK_NOTIFICATIONS_CACHE_TAG);
    revalidatePath("/sales");
    revalidatePath("/products");
    revalidatePath("/inventory");
    revalidatePath("/dashboard");
    revalidatePath("/customers");
    return res;
  });
}
export async function voidSaleAction(raw: unknown) {
  return run(async () => {
    const actor = await assertPermission(PERMISSION.SALE_VOID);
    await sales.voidSale(actor, raw);
    updateTag(LOW_STOCK_NOTIFICATIONS_CACHE_TAG);
    revalidatePath("/sales", "layout");
    revalidatePath("/inventory");
    revalidatePath("/products");
    revalidatePath("/dashboard");
    return undefined;
  });
}

// ---------- customers ----------
export async function saveCustomerAction(raw: unknown) {
  return run(async () => {
    const isEdit = typeof raw === "object" && raw !== null && !!(raw as { id?: string }).id;
    const actor = await assertPermission(isEdit ? PERMISSION.CUSTOMER_UPDATE : PERMISSION.CUSTOMER_CREATE);
    const res = await customers.saveCustomer(actor, raw);
    revalidatePath("/customers");
    return res;
  });
}

// ---------- employees ----------
export async function createEmployeeAction(raw: unknown) {
  return run(async () => {
    const actor = await assertPermission(PERMISSION.EMPLOYEE_CREATE);
    const res = await employees.createEmployee(actor, raw);
    revalidatePath("/employees");
    return res;
  });
}
export async function updateEmployeeAction(raw: unknown) {
  return run(async () => {
    const actor = await assertPermission(PERMISSION.EMPLOYEE_UPDATE);
    await employees.updateEmployee(actor, raw);
    revalidatePath("/employees", "layout");
    return undefined;
  });
}
export async function setEmployeeStatusAction(id: string, status: UserStatus) {
  return run(async () => {
    const actor = await assertPermission(PERMISSION.EMPLOYEE_DISABLE);
    z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).parse(status);
    await employees.setEmployeeStatus(actor, id, status);
    revalidatePath("/employees", "layout");
    return undefined;
  });
}
export async function resetEmployeePasswordAction(raw: unknown) {
  return run(async () => {
    const actor = await assertPermission(PERMISSION.EMPLOYEE_UPDATE);
    await employees.resetEmployeePassword(actor, raw);
    return undefined;
  });
}

// ---------- settings ----------
export async function updateSettingsAction(raw: unknown) {
  return run(async () => {
    const actor = await assertPermission(PERMISSION.SETTINGS_UPDATE);
    const v = settingsSchema.parse(raw);
    await updateSettings(actor, v);
    revalidateTag("settings", "max");
    revalidatePath("/", "layout");
    return undefined;
  });
}
