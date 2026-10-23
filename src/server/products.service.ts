import {PERMISSION, assertRolePermission} from "@/lib/rbac/permission";
import { randomUUID } from "node:crypto";
import { unstable_cache } from "next/cache";
import { Prisma, type ProductStatus, type TrackingType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { toDb, money } from "@/lib/money";
import { emptyToNull } from "@/validations/common";
import { parsePage, paged, type PageQuery } from "@/lib/pagination";
import { first, type SearchParams } from "@/lib/url";
import { LOW_STOCK_THRESHOLD, stockStatus, type StockStatus } from "@/lib/stock";
import { productSchema, type ProductFormValues } from "@/validations/product";
import { addStockTx, type Actor } from "./inventory.service";
import { PRODUCT_CATEGORY_SELECTION, TAXONOMY_CACHE_TAG, TAXONOMY_KIND } from "@/lib/constants/categories";
import { slugify } from "@/lib/format";
import { uniqueSlug } from "@/lib/slug";

export type ProductRow = {
  id: string;
  slug: string;
  sku: string;
  barcode: string | null;
  name: string;
  variantLabel: string | null;
  category: string;
  categoryId: string;
  brand: string | null;
  brandId: string | null;
  description: string | null;
  sellingPrice: string;
  /** only present when the viewer may see costs (never sent to employees) */
  purchasePrice?: string;
  maxDiscountPercent: string;
  quantity: number;
  trackingType: TrackingType;
  status: ProductStatus;
  stockStatus: StockStatus;
};

export type ProductQuery = {
  search?: string;
  categoryId?: string;
  brandId?: string;
  status?: ProductStatus;
  stock?: "low" | "out" | "in";
  sort: string;
  order: "asc" | "desc";
} & PageQuery;

export function parseProductQuery(sp: SearchParams, categorySlugToId?: Map<string, string>): ProductQuery {
  const status = first(sp.status);
  const stock = first(sp.stock);
  const catParam = first(sp.category);
  return {
    ...parsePage(sp),
    search: first(sp.search),
    // URL uses slugs (/products?category=smartphones); ids also accepted
    categoryId: catParam ? (categorySlugToId?.get(catParam) ?? catParam) : undefined,
    brandId: first(sp.brand),
    status: status === "ACTIVE" || status === "INACTIVE" || status === "DISCONTINUED" ? status : undefined,
    stock: stock === "low" || stock === "out" || stock === "in" ? stock : undefined,
    sort: first(sp.sort) ?? "name",
    order: first(sp.order) === "desc" ? "desc" : "asc",
  };
}

type ProductWithRels = Prisma.ProductGetPayload<{ include: { category: { select: { name: true } }; brand: { select: { name: true } } } }>;

export function toProductRow(p: ProductWithRels, canSeeCost: boolean): ProductRow {
  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    barcode: p.barcode,
    name: p.name,
    variantLabel: p.variantLabel,
    category: p.category.name,
    categoryId: p.categoryId,
    brand: p.brand?.name ?? null,
    brandId: p.brandId,
    description: p.description,
    sellingPrice: p.sellingPrice.toString(),
    ...(canSeeCost && { purchasePrice: p.purchasePrice.toString() }),
    maxDiscountPercent: p.maxDiscountPercent.toString(),
    quantity: p.quantity,
    trackingType: p.trackingType,
    status: p.status,
    stockStatus: stockStatus(p.quantity),
  };
}

export function buildProductWhere(q: Pick<ProductQuery, "search" | "categoryId" | "brandId" | "status" | "stock">, onlyActive = false): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [];
  if (q.search) {
    and.push({
      OR: [
        { name: { contains: q.search, mode: "insensitive" } },
        { variantLabel: { contains: q.search, mode: "insensitive" } },
        { sku: { contains: q.search, mode: "insensitive" } },
        { barcode: { contains: q.search } },
        { serials: { some: { serial: { contains: q.search.toUpperCase() } } } },
      ],
    });
  }
  if (q.stock === "out") and.push({ quantity: { lte: 0 } });
  if (q.stock === "low") and.push({ quantity: { gt: 0, lte: LOW_STOCK_THRESHOLD } });
  if (q.stock === "in") and.push({ quantity: { gt: LOW_STOCK_THRESHOLD } });
  return {
    ...(onlyActive ? { status: "ACTIVE" as const } : q.status ? { status: q.status } : { status: { not: "DISCONTINUED" as const } }),
    ...(q.categoryId && { categoryId: q.categoryId }),
    ...(q.brandId && { brandId: q.brandId }),
    ...(and.length && { AND: and }),
  };
}

const SORTABLE = ["name", "sku", "sellingPrice", "purchasePrice", "quantity", "createdAt"];

export async function listProducts(q: ProductQuery, canSeeCost: boolean, onlyActive = false) {
  const where = buildProductWhere(q, onlyActive);
  const sortKey = SORTABLE.includes(q.sort) && (canSeeCost || q.sort !== "purchasePrice") ? q.sort : "name";
  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { [sortKey]: q.order },
      skip: q.skip,
      take: q.take,
      include: { category: { select: { name: true } }, brand: { select: { name: true } } },
    }),
    prisma.product.count({ where }),
  ]);
  return paged(rows.map((p) => toProductRow(p, canSeeCost)), total, q);
}

/** Fast typeahead for the sales terminal – active products only, never exposes cost. */
export async function searchSellableProducts(term: string, limit = 20): Promise<ProductRow[]> {
  const t = term.trim();
  const rows = await prisma.product.findMany({
    where: buildProductWhere({ search: t || undefined }, true),
    orderBy: [{ quantity: "desc" }, { name: "asc" }],
    take: limit,
    include: { category: { select: { name: true } }, brand: { select: { name: true } } },
  });
  return rows.map((p) => toProductRow(p, false));
}

export async function getProductBySlug(slug: string, canSeeCost: boolean) {
  const p = await prisma.product.findUnique({
    where: { slug },
    include: { category: { select: { name: true } }, brand: { select: { name: true } } },
  });
  if (!p) return null;
  return { ...toProductRow(p, canSeeCost), description: p.description, createdAt: p.createdAt, updatedAt: p.updatedAt, brandId: p.brandId };
}

function toData(v: ProductFormValues, fallbackSku?: string) {
  return {
    sku: v.sku.trim().toUpperCase() || fallbackSku || `CP-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`,
    barcode: emptyToNull(v.barcode),
    name: v.name.trim(),
    variantLabel: v.variantLabel?.trim() || null,
    description: emptyToNull(v.description),
    categoryId: v.categoryId,
    brandId: v.brandId || null,
    purchasePrice: toDb(v.purchasePrice),
    sellingPrice: toDb(v.sellingPrice),
    maxDiscountPercent: money(Number.isFinite(v.maxDiscountPercent) ? v.maxDiscountPercent : 5).toFixed(2),
    trackingType: v.trackingType,
    status: "ACTIVE" as const,
  };
}

async function resolveProductCategory(tx: Prisma.TransactionClient, actor: Actor, values: ProductFormValues) {
  if (values.categoryId !== PRODUCT_CATEGORY_SELECTION.CUSTOM) return values.categoryId;

  assertRolePermission(actor.role, PERMISSION.CATEGORY_CREATE);
  const name = values.customCategory.trim();
  const slug = slugify(name);
  if (!slug) throw new DomainError("VALIDATION", "Category name must contain letters or numbers.");

  const existing = await tx.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true, isActive: true },
  });
  if (existing) {
    if (!existing.isActive) {
      await tx.category.update({ where: { id: existing.id }, data: { isActive: true } });
      await writeAudit(tx, {
        actorId: actor.id,
        action: PERMISSION.CATEGORY_UPDATE,
        entityType: "Category",
        entityId: existing.id,
        description: `Reactivated category “${existing.name}” while adding a product`,
      });
    }
    return existing.id;
  }

  const slugOwner = await tx.category.findUnique({ where: { slug }, select: { id: true } });
  if (slugOwner) throw new DomainError("CONFLICT", "A category with a similar name already exists. Choose it from the category list.");

  const category = await tx.category.create({ data: { name, slug, isActive: true } });
  await writeAudit(tx, {
    actorId: actor.id,
    action: PERMISSION.CATEGORY_CREATE,
    entityType: "Category",
    entityId: category.id,
    description: `Created category “${category.name}” while adding a product`,
  });
  return category.id;
}

export async function createProduct(actor: Actor, raw: unknown) {
  assertRolePermission(actor.role, PERMISSION.PRODUCT_CREATE);
  const v = productSchema.parse(raw);
  const data = toData(v);

  return prisma.$transaction(async (tx) => {
    const categoryId = await resolveProductCategory(tx, actor, v);
    const slug = await uniqueSlug(v.name, async (value) => !!(await tx.product.findUnique({ where: { slug: value }, select: { id: true } })));
    const product = await tx.product.create({ data: { ...data, slug, categoryId } });
    const openingSerials = v.openingSerialsText.trim().split(/[\s,;]+/).filter(Boolean);
    if (v.trackingType === "QUANTITY" && v.openingQuantity > 0) {
      await addStockTx(tx, actor, { productId: product.id, type: "INITIAL_STOCK", quantity: v.openingQuantity, reason: "Opening stock" });
    }
    if (v.trackingType !== "QUANTITY" && openingSerials.length > 0) {
      await addStockTx(tx, actor, { productId: product.id, type: "INITIAL_STOCK", serials: openingSerials, reason: "Opening stock" });
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: PERMISSION.PRODUCT_CREATE,
      entityType: "Product",
      entityId: product.id,
      description: `Created product ${product.name} (${product.sku})`,
    });
    return { id: product.id, slug: product.slug };
  });
}

export async function updateProduct(actor: Actor, id: string, raw: unknown) {
  assertRolePermission(actor.role, PERMISSION.PRODUCT_UPDATE);
  const v = productSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const before = await tx.product.findUnique({ where: { id }, include: { _count: { select: { serials: true } } } });
    if (!before) throw new DomainError("NOT_FOUND", "Product not found.");
    const { status: _status, ...data } = toData(v, before.sku);
    const categoryId = await resolveProductCategory(tx, actor, v);
    data.categoryId = categoryId;
    if (before.trackingType !== data.trackingType && (before.quantity > 0 || before._count.serials > 0)) {
      throw new DomainError("CONFLICT", "Tracking type can't be changed once the product has stock or registered devices.");
    }
    const updated = await tx.product.update({ where: { id }, data, select: { slug: true } });

    const changes: string[] = [];
    const watch = ["name", "variantLabel", "sku", "barcode", "purchasePrice", "sellingPrice", "maxDiscountPercent", "categoryId", "brandId"] as const;
    for (const k of watch) {
      const a = String(before[k] ?? "");
      const b = String(data[k] ?? "");
      if (a !== b) changes.push(`${k}: ${a || "—"} → ${b || "—"}`);
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: PERMISSION.PRODUCT_UPDATE,
      entityType: "Product",
      entityId: id,
      description: `Updated ${data.name} (${data.sku})${changes.length ? ` – ${changes.join("; ")}` : ""}`,
    });
    return updated.slug;
  });
}

export async function deleteProduct(actor: Actor, id: string): Promise<{ archived: boolean; slug: string }> {
  assertRolePermission(actor.role, PERMISSION.PRODUCT_DELETE);
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "citypalaza_database"."Product" WHERE "id" = ${id} FOR UPDATE`;
    if (locked.length === 0) throw new DomainError("NOT_FOUND", "Product not found.");
    const p = await tx.product.findUnique({
      where: { id },
      select: { name: true, slug: true, sku: true, status: true, quantity: true, _count: { select: { saleItems: true, inventoryTransactions: true, serials: true } } },
    });
    if (!p) throw new DomainError("NOT_FOUND", "Product not found.");
    const archived = p.quantity > 0 || p._count.saleItems > 0 || p._count.inventoryTransactions > 0 || p._count.serials > 0;
    if (archived) {
      await tx.product.update({ where: { id }, data: { status: "DISCONTINUED" } });
      await writeAudit(tx, { actorId: actor.id, action: PERMISSION.PRODUCT_DELETE, entityType: "Product", entityId: id, description: `Removed ${p.name} (${p.sku}) from the active catalogue; history retained` });
      return { archived: true, slug: p.slug };
    }
    await tx.product.delete({ where: { id } });
    await writeAudit(tx, { actorId: actor.id, action: PERMISSION.PRODUCT_DELETE, entityType: "Product", entityId: id, description: `Deleted product ${p.name} (${p.sku})` });
    return { archived: false, slug: p.slug };
  });
}

// ---------- cached, stable reference data ----------
export const getCategories = unstable_cache(
  () => prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, isActive: true, description: true } }),
  ["categories"],
  { tags: ["categories"] },
);
export const getBrands = unstable_cache(
  () => prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, isActive: true, description: true } }),
  ["brands"],
  { tags: ["brands"] },
);

export { Prisma };
