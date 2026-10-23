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
import { destroySession, getSessionUser } from "@/lib/auth/session";
import { LOW_STOCK_NOTIFICATIONS_CACHE_TAG } from "@/lib/constants";
import { writeAudit } from "@/lib/audit";
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
export async function logoutAction() {
  // Signing out must never fail: audit problems are logged, and destroySession always clears the cookies.
  try {
    const user = await getSessionUser();
    if (user) await writeAudit(prisma, { actorId: user.id, action: "LOGOUT", entityType: "User", entityId: user.id, description: `${user.email} signed out` });
  } catch (error) {
    console.error("[logout audit failure]", error);
  }
  await destroySession();
  redirect("/login?reason=signed-out");
}

// ---------- products ----------
export async function createProductAction(raw: unknown) {
  return run(async () => {
    const actor = await assertPermission(PERMISSION.PRODUCT_CREATE);
    const res = await products.createProduct(actor, raw);
    updateTag(LOW_STOCK_NOTIFICATIONS_CACHE_TAG);
    revalidateTag(TAXONOMY_CACHE_TAG[TAXONOMY_KIND.CATEGORY], "max");
    revalidatePath("/products");
    revalidatePath("/inventory");
    return res;
  });
}
export async function updateProductAction(id: string, raw: unknown) {
  return run(async () => {
    const actor = await assertPermission(PERMISSION.PRODUCT_UPDATE);
    const slug = await products.updateProduct(actor, id, raw);
    updateTag(LOW_STOCK_NOTIFICATIONS_CACHE_TAG);
    revalidateTag(TAXONOMY_CACHE_TAG[TAXONOMY_KIND.CATEGORY], "max");
    revalidatePath("/products");
    revalidatePath(`/products/${slug}`);
    return undefined;
  });
}
export async function setProductStatusAction(id: string, status: ProductStatus) {
  return run(async () => {
    const actor = await assertPermission(PERMISSION.PRODUCT_UPDATE);
    z.enum(["ACTIVE", "INACTIVE", "DISCONTINUED"]).parse(status);
    const slug = await products.setProductStatus(actor, id, status);
    updateTag(LOW_STOCK_NOTIFICATIONS_CACHE_TAG);
    revalidatePath("/products");
    revalidatePath(`/products/${slug}`);
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
export async function deleteTaxonomiesAction(kind: taxonomy.TaxonomyKind, rawIds: unknown) {
  return run(async () => {
    kind = z.enum([TAXONOMY_KIND.CATEGORY, TAXONOMY_KIND.BRAND]).parse(kind);
    const ids = z.array(z.string().min(1).max(64)).min(1).max(100).superRefine((values, context) => {
      if (new Set(values).size !== values.length) context.addIssue({ code: "custom", message: "Selected items must be unique." });
    }).parse(rawIds);
    const permission = kind === TAXONOMY_KIND.CATEGORY ? PERMISSION.CATEGORY_DELETE : PERMISSION.BRAND_DELETE;
    const actor = await assertPermission(permission);
    const result = await taxonomy.deleteTaxonomies(actor, kind, ids);
    updateTag(TAXONOMY_CACHE_TAG[kind]);
    revalidatePath("/products", "layout");
    return result;
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
      unitCost: typeof v.unitCost === "number" ? v.unitCost : undefined,
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
export async function settleSalePaymentAction(raw: unknown) {
  return run(async () => {
    const actor = await assertPermission(PERMISSION.SALE_SETTLE);
    const res = await sales.settleSalePayment(actor, raw);
    revalidatePath("/sales");
    revalidatePath(`/sales/${res.slug}`);
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    return res;
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
    revalidatePath("/dashboard");
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
    revalidatePath("/dashboard");
    return undefined;
  });
}
export async function deleteEmployeeAction(id: string) {
  return run(async () => {
    const actor = await assertPermission(PERMISSION.EMPLOYEE_DELETE);
    z.string().min(1).parse(id);
    await employees.deleteEmployee(actor, id);
    revalidatePath("/employees", "layout");
    revalidatePath("/audit-logs");
    revalidatePath("/dashboard");
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
