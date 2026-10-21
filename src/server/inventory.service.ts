import { Prisma, type InventoryTransactionType, type TrackingType } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { normalizeSerials } from "@/lib/imei";
import { parsePage, parseSort, paged, type PageQuery, type SortOrder } from "@/lib/pagination";
import { first, type SearchParams } from "@/lib/url";
import { stockStatus } from "@/lib/stock";
import { resolveRange } from "@/lib/dates";
import { TX_TYPES } from "@/lib/constants";
import type { Role } from "@/lib/constants/roles";
import { PERMISSION, assertRolePermission } from "@/lib/rbac/permission";

export { normalizeSerials };
export type Actor = { id: string; role: Role };

export type StockChange = {
  productId: string;
  /** signed: + stock in, − stock out */
  delta: number;
  type: InventoryTransactionType;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  userId: string;
};

/**
 * THE only place that mutates Product.quantity.
 *
 * A single guarded UPDATE (`quantity + delta >= 0`) makes the check-and-decrement atomic in
 * PostgreSQL: if two cashiers sell the last unit at the same time, the row lock serialises
 * them and the second UPDATE matches zero rows → InsufficientStock → its whole sale rolls back.
 */
export async function changeStock(tx: Tx, c: StockChange): Promise<number> {
  if (!Number.isInteger(c.delta) || c.delta === 0) throw new DomainError("VALIDATION", "Stock change must be a non-zero whole number.");
  if (!c.reason && !c.referenceId) throw new DomainError("VALIDATION", "A reason or reference is required for every stock change.");

  const rows = await tx.$queryRaw<{ quantity: number }[]>`
    UPDATE "citypalaza_database"."Product"
       SET "quantity" = "quantity" + ${c.delta}::int, "updatedAt" = NOW()
     WHERE "id" = ${c.productId} AND "quantity" + ${c.delta}::int >= 0
 RETURNING "quantity"`;

  if (rows.length === 0) {
    const p = await tx.product.findUnique({ where: { id: c.productId }, select: { name: true, quantity: true } });
    if (!p) throw new DomainError("NOT_FOUND", "Product not found.");
    throw new DomainError("INSUFFICIENT_STOCK", `Not enough stock for ${p.name}. Available: ${p.quantity}.`);
  }
  const newQuantity = rows[0]!.quantity;
  await tx.inventoryTransaction.create({
    data: {
      productId: c.productId,
      type: c.type,
      quantity: c.delta,
      previousQuantity: newQuantity - c.delta,
      newQuantity,
      referenceType: c.referenceType ?? null,
      referenceId: c.referenceId ?? null,
      reason: c.reason ?? null,
      userId: c.userId,
    },
  });
  return newQuantity;
}

export type AddStockInput = {
  productId: string;
  type: "PURCHASE" | "INITIAL_STOCK";
  quantity?: number;
  serials?: string[];
  reason?: string | null;
  reference?: string | null;
};

export async function addStockTx(tx: Tx, actor: Actor, input: AddStockInput) {
  assertRolePermission(actor.role, PERMISSION.INVENTORY_ADD);
  const product = await tx.product.findUnique({
    where: { id: input.productId },
    select: { id: true, name: true, sku: true, trackingType: true },
  });
  if (!product) throw new DomainError("NOT_FOUND", "Product not found.");

  let quantity: number;
  if (product.trackingType === "QUANTITY") {
    quantity = input.quantity ?? 0;
    if (!Number.isInteger(quantity) || quantity < 1) throw new DomainError("VALIDATION", "Enter a quantity of at least 1.");
  } else {
    const serials = normalizeSerials(input.serials ?? [], product.trackingType);
    if (serials.length === 0) throw new DomainError("VALIDATION", `Enter at least one ${product.trackingType === "IMEI" ? "IMEI" : "serial number"}.`);
    const existing = await tx.productSerial.findMany({ where: { serial: { in: serials } }, select: { serial: true } });
    if (existing.length) throw new DomainError("DUPLICATE", `Already registered: ${existing.map((e) => e.serial).join(", ")}`);
    await tx.productSerial.createMany({ data: serials.map((serial) => ({ productId: product.id, serial })) });
    quantity = serials.length;
  }

  const reason = input.reason?.trim() || (input.reference ? null : input.type === "INITIAL_STOCK" ? "Opening stock" : "Stock received");
  const newQuantity = await changeStock(tx, {
    productId: product.id,
    delta: quantity,
    type: input.type,
    referenceType: input.reference ? "SUPPLIER_REF" : null,
    referenceId: input.reference?.trim() || null,
    reason,
    userId: actor.id,
  });
  await writeAudit(tx, {
    actorId: actor.id,
    action: "STOCK_ADD",
    entityType: "Product",
    entityId: product.id,
    description: `Added ${quantity} × ${product.name} (${product.sku}); stock now ${newQuantity}`,
  });
  return { quantity, newQuantity };
}

export function addStock(actor: Actor, input: AddStockInput) {
  assertRolePermission(actor.role, PERMISSION.INVENTORY_ADD);
  return prisma.$transaction((tx) => addStockTx(tx, actor, input));
}

export type AdjustStockInput = {
  productId: string;
  type: "ADJUSTMENT" | "DAMAGE" | "LOST";
  /** ADJUSTMENT only */
  direction?: "INCREASE" | "DECREASE";
  quantity?: number;
  /** serialized products: the devices being written off */
  serials?: string[];
  reason: string;
};

export async function adjustStock(actor: Actor, input: AdjustStockInput) {
  assertRolePermission(actor.role, PERMISSION.INVENTORY_ADJUST);
  const reason = input.reason.trim();
  if (reason.length < 3) throw new DomainError("VALIDATION", "A reason is required for stock adjustments.");

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: input.productId },
      select: { id: true, name: true, sku: true, trackingType: true },
    });
    if (!product) throw new DomainError("NOT_FOUND", "Product not found.");

    let delta: number;
    if (product.trackingType === "QUANTITY") {
      const q = input.quantity ?? 0;
      if (!Number.isInteger(q) || q < 1) throw new DomainError("VALIDATION", "Enter a quantity of at least 1.");
      delta = input.type === "ADJUSTMENT" && input.direction === "INCREASE" ? q : -q;
    } else {
      if (input.type === "ADJUSTMENT") {
        throw new DomainError("VALIDATION", "Serialized products can't be adjusted by count. Add devices via “Add stock” or mark them damaged/lost.");
      }
      const serials = normalizeSerials(input.serials ?? [], product.trackingType);
      if (!serials.length) throw new DomainError("VALIDATION", "Enter the IMEI / serial numbers being written off.");
      const r = await tx.productSerial.updateMany({
        where: { productId: product.id, serial: { in: serials }, status: "IN_STOCK" },
        data: { status: input.type === "DAMAGE" ? "DAMAGED" : "LOST", notes: reason },
      });
      if (r.count !== serials.length) throw new DomainError("SERIAL_UNAVAILABLE", "Some devices are not in stock (already sold, damaged or unknown).");
      delta = -serials.length;
    }

    const newQuantity = await changeStock(tx, {
      productId: product.id,
      delta,
      type: input.type,
      referenceType: "MANUAL",
      reason,
      userId: actor.id,
    });
    await writeAudit(tx, {
      actorId: actor.id,
      action: "STOCK_ADJUST",
      entityType: "Product",
      entityId: product.id,
      description: `${input.type} ${delta > 0 ? "+" : ""}${delta} × ${product.name} (${product.sku}): ${reason}`,
    });
    return { delta, newQuantity };
  });
}

// ---------- queries ----------
export type InventoryQuery = { search?: string; categoryId?: string; stock?: "low" | "out" | "in"; sort: string; order: "asc" | "desc" } & PageQuery;

export function parseInventoryQuery(sp: SearchParams): InventoryQuery {
  const stock = first(sp.stock);
  return {
    ...parsePage(sp),
    search: first(sp.search),
    categoryId: first(sp.category),
    stock: stock === "low" || stock === "out" || stock === "in" ? stock : undefined,
    sort: first(sp.sort) ?? "name",
    order: first(sp.order) === "desc" ? "desc" : "asc",
  };
}

export async function listInventory(q: InventoryQuery) {
  const where: Prisma.ProductWhereInput = {
    status: { not: "DISCONTINUED" },
    ...(q.categoryId && { categoryId: q.categoryId }),
    ...(q.search && {
      OR: [
        { name: { contains: q.search, mode: "insensitive" } },
        { variantLabel: { contains: q.search, mode: "insensitive" } },
        { sku: { contains: q.search, mode: "insensitive" } },
        { barcode: { contains: q.search } },
      ],
    }),
    ...(q.stock === "out" && { quantity: { lte: 0 } }),
    ...(q.stock === "low" && { quantity: { gt: 0, lte: prisma.product.fields.minStock } }),
    ...(q.stock === "in" && { quantity: { gt: prisma.product.fields.minStock } }),
  };
  const sortable = ["name", "sku", "quantity", "purchasePrice", "sellingPrice"];
  const orderBy = { [sortable.includes(q.sort) ? q.sort : "name"]: q.order } as Prisma.ProductOrderByWithRelationInput;
  const [rows, total] = await Promise.all([
    prisma.product.findMany({ where, orderBy, skip: q.skip, take: q.take, include: { category: { select: { name: true } }, brand: { select: { name: true } } } }),
    prisma.product.count({ where }),
  ]);
  return paged(
    rows.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      variantLabel: p.variantLabel,
      category: p.category.name,
      brand: p.brand?.name ?? null,
      trackingType: p.trackingType,
      quantity: p.quantity,
      minStock: p.minStock,
      maxStock: p.maxStock,
      purchasePrice: p.purchasePrice.toString(),
      sellingPrice: p.sellingPrice.toString(),
      stockStatus: stockStatus(p.quantity, p.minStock),
    })),
    total,
    q,
  );
}

export type HistoryQuery = { productId?: string; type?: string; from: Date; to: Date; search?: string; sort: "createdAt" | "type" | "quantity"; order: SortOrder } & PageQuery;

export function parseHistoryQuery(sp: SearchParams): HistoryQuery {
  const range = resolveRange(first(sp.range), first(sp.from), first(sp.to), { fallback: "last30" });
  const type = first(sp.type);
  return {
    ...parsePage(sp, 25),
    ...parseSort(sp, ["createdAt", "type", "quantity"] as const, "createdAt"),
    productId: first(sp.productId),
    type: TX_TYPES.includes(type as (typeof TX_TYPES)[number]) ? type : undefined,
    from: range.from,
    to: range.to,
    search: first(sp.search),
  };
}

export async function listInventoryHistory(q: HistoryQuery) {
  const where: Prisma.InventoryTransactionWhereInput = {
    createdAt: { gte: q.from, lt: q.to },
    ...(q.productId && { productId: q.productId }),
    ...(q.type && { type: q.type as InventoryTransactionType }),
    ...(q.search && { product: { OR: [{ name: { contains: q.search, mode: "insensitive" } }, { sku: { contains: q.search, mode: "insensitive" } }] } }),
  };
  const [rows, total] = await Promise.all([
    prisma.inventoryTransaction.findMany({
      where,
      orderBy: { [q.sort]: q.order },
      skip: q.skip,
      take: q.take,
      include: { product: { select: { name: true, sku: true } }, user: { select: { firstName: true, lastName: true } } },
    }),
    prisma.inventoryTransaction.count({ where }),
  ]);
  return paged(rows, total, q);
}

export async function listSerials(productId: string, status?: "IN_STOCK") {
  return prisma.productSerial.findMany({
    where: { productId, ...(status && { status }) },
    orderBy: [{ status: "asc" }, { serial: "asc" }],
    take: 500,
    select: { id: true, serial: true, status: true, notes: true },
  });
}
