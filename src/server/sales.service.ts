import { Prisma, type PaymentMethod, type SaleStatus } from "@/generated/prisma/client";
import { prisma, type Tx } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { calculateSale, assertDiscountAllowed } from "@/lib/sales-calc";
import { D, toDb, money } from "@/lib/money";
import { formatCurrency } from "@/lib/format";
import { PERMISSION, assertRolePermission, hasPermission } from "@/lib/rbac/permission";
import { ROLE, type Role } from "@/lib/constants/roles";
import { resolveRange } from "@/lib/dates";
import { parsePage, parseSort, paged, type PageQuery, type SortOrder } from "@/lib/pagination";
import { first, type SearchParams } from "@/lib/url";
import { PAYMENT_METHODS } from "@/lib/constants";
import { createSaleSchema, voidSaleSchema, type CreateSaleInput } from "@/validations/sale";
import { changeStock, normalizeSerials, type Actor } from "./inventory.service";
import { readSettings } from "./settings.service";
import { uniqueSlug } from "@/lib/slug";

async function nextCounter(tx: Tx, key: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "citypalaza_database"."Counter" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1
    RETURNING "value"`;
  return rows[0]!.value;
}

type Prepared = { product: Prisma.ProductGetPayload<object>; quantity: number; serials: string[] };

/**
 * Creates a sale. EVERYTHING happens in one DB transaction:
 * Sale + SaleItems + serial claims + guarded stock deduction + inventory transactions + audit.
 * Prices, discounts, tax and totals are recomputed here – nothing numeric from the browser is trusted.
 */
export async function createSale(actor: Actor, raw: unknown): Promise<{ id: string; slug: string; saleNumber: string }> {
  assertRolePermission(actor.role, PERMISSION.SALE_CREATE);
  const input: CreateSaleInput = createSaleSchema.parse(raw);

  // merge duplicate product lines
  const merged = new Map<string, { quantity: number; serials: string[]; discount: CreateSaleInput["items"][number]["discount"] }>();
  for (const it of input.items) {
    const cur = merged.get(it.productId) ?? { quantity: 0, serials: [], discount: it.discount };
    if (JSON.stringify(cur.discount ?? null) !== JSON.stringify(it.discount ?? null)) throw new DomainError("VALIDATION", "A product can only have one item discount per sale.");
    cur.quantity += it.quantity;
    cur.serials.push(...(it.serials ?? []));
    merged.set(it.productId, cur);
  }
  if (merged.size === 0) throw new DomainError("EMPTY_SALE", "Add at least one product to the sale.");
  const ids = [...merged.keys()].sort(); // deterministic lock order → no deadlocks

  return prisma.$transaction(
    async (tx) => {
      const settings = await readSettings(tx);
      const products = await tx.product.findMany({ where: { id: { in: ids } } });
      const byId = new Map(products.map((p) => [p.id, p]));

      const prepared: Prepared[] = ids.map((id) => {
        const p = byId.get(id);
        if (!p) throw new DomainError("NOT_FOUND", "A product in the cart no longer exists.");
        if (p.status !== "ACTIVE") throw new DomainError("CONFLICT", `${p.name}${p.variantLabel ? ` · ${p.variantLabel}` : ""} is not available for sale.`);
        const m = merged.get(id)!;
        if (p.trackingType === "QUANTITY") return { product: p, quantity: m.quantity, serials: [] };
        const serials = normalizeSerials(m.serials, p.trackingType);
        if (serials.length === 0) throw new DomainError("VALIDATION", `Select the ${p.trackingType === "IMEI" ? "IMEI" : "serial number"} of the ${p.name}${p.variantLabel ? ` · ${p.variantLabel}` : ""} being sold.`);
        return { product: p, quantity: serials.length, serials };
      });

      const calc = calculateSale({
        lines: prepared.map((x) => ({
          productId: x.product.id,
          unitPrice: x.product.sellingPrice,
          unitCost: x.product.purchasePrice,
          quantity: x.quantity,
          promoPercent: x.product.discountPercent,
          discount: merged.get(x.product.id)?.discount,
        })),
        discount: input.discount && D(input.discount.value).gt(0) ? input.discount : null,
        taxRatePercent: settings.taxRate,
      });
      assertDiscountAllowed(calc.manualDiscount, calc.netAfterPromo, actor.role, settings.employeeDiscountLimit, settings.currency);
      if (actor.role !== ROLE.ADMIN && settings.employeeMaxTotalDiscountPercent !== null) {
        const maximum = money(calc.subtotal.times(settings.employeeMaxTotalDiscountPercent).div(100));
        if (calc.discount.gt(maximum)) throw new DomainError("DISCOUNT_NOT_ALLOWED", `Total discount exceeds the ${settings.employeeMaxTotalDiscountPercent}% limit.`);
      }
      const soldBelowCost = calc.lines.some((line) => line.subtotal.minus(line.discount).lt(line.unitCost.times(line.quantity)));
      if (actor.role !== ROLE.ADMIN && soldBelowCost) throw new DomainError("DISCOUNT_NOT_ALLOWED", "This discount needs admin approval.");

      // customer (optional → walk-in)
      let customerId: string | null = input.customerId ?? null;
      if (!customerId && input.newCustomer) {
        const nc = input.newCustomer;
        const phone = nc.phone?.trim() || null;
        const existing = phone ? await tx.customer.findUnique({ where: { phone } }) : null;
        customerId =
          existing?.id ??
          (await tx.customer.create({ data: { slug: await uniqueSlug(nc.name, async (value) => !!(await tx.customer.findUnique({ where: { slug: value }, select: { id: true } }))), name: nc.name.trim(), phone, email: nc.email?.trim() || null, address: nc.address?.trim() || null } })).id;
      }
      if (customerId && !(await tx.customer.findUnique({ where: { id: customerId }, select: { id: true } }))) {
        throw new DomainError("NOT_FOUND", "Selected customer no longer exists.");
      }

      // payment
      const paymentStatus = input.paymentStatus ?? "PAID";
      if (paymentStatus === "REFUNDED") throw new DomainError("VALIDATION", "A new sale can't be marked as refunded.");
      let amountPaid = calc.total;
      if (paymentStatus === "PENDING") amountPaid = D(0);
      if (paymentStatus === "PARTIAL") {
        amountPaid = money(input.amountPaid ?? 0);
        if (amountPaid.lte(0) || amountPaid.gte(calc.total)) throw new DomainError("VALIDATION", "For a partial payment enter an amount above 0 and below the total.");
      }

      const seq = await nextCounter(tx, "sale");
      const saleNumber = `${settings.invoicePrefix}-${String(seq).padStart(6, "0")}`;
      const saleSlug = saleNumber.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

      const sale = await tx.sale.create({
        data: {
          slug: saleSlug,
          saleNumber,
          employeeId: actor.id,
          customerId,
          subtotal: toDb(calc.subtotal),
          discount: toDb(calc.discount),
          promoDiscount: toDb(calc.promoDiscount),
          manualDiscount: toDb(calc.manualDiscount),
          tax: toDb(calc.tax),
          total: toDb(calc.total),
          discountType: input.discount && D(input.discount.value).gt(0) ? input.discount.type : null,
          discountValue: input.discount && D(input.discount.value).gt(0) ? toDb(input.discount.value) : null,
          taxRate: D(settings.taxRate).toFixed(2),
          paymentMethod: input.paymentMethod,
          paymentStatus,
          amountPaid: toDb(amountPaid),
          notes: input.notes?.trim() || null,
          items: {
            create: calc.lines.map((l, i) => ({
              productId: l.productId,
              productName: prepared[i]!.product.variantLabel
                ? `${prepared[i]!.product.name} · ${prepared[i]!.product.variantLabel}`
                : prepared[i]!.product.name,
              sku: prepared[i]!.product.sku,
              quantity: l.quantity,
              serialSnapshot: prepared[i]!.serials,
              unitPrice: toDb(l.unitPrice),
              unitCost: toDb(l.unitCost),
              discount: toDb(l.discount),
              promoDiscount: toDb(l.promoDiscount),
              saleDiscount: toDb(l.saleDiscount.plus(l.itemManualDiscount)),
              tax: toDb(l.tax),
              subtotal: toDb(l.subtotal),
              total: toDb(l.total),
            })),
          },
        },
        include: { items: true },
      });

      for (const prep of prepared) {
        const item = sale.items.find((i) => i.productId === prep.product.id)!;
        if (prep.serials.length) {
          // atomic claim: only devices still IN_STOCK can flip to SOLD – a sold IMEI can never be sold twice
          const r = await tx.productSerial.updateMany({
            where: { productId: prep.product.id, serial: { in: prep.serials }, status: "IN_STOCK" },
            data: { status: "SOLD", saleItemId: item.id },
          });
          if (r.count !== prep.serials.length) throw new DomainError("SERIAL_UNAVAILABLE", `One or more selected devices of ${prep.product.name} are no longer available.`);
        }
        await changeStock(tx, {
          productId: prep.product.id,
          delta: -prep.quantity,
          type: "SALE",
          referenceType: "SALE",
          referenceId: sale.id,
          reason: `Sale ${saleNumber}`,
          userId: actor.id,
        });
      }

      if (customerId) await tx.customer.update({ where: { id: customerId }, data: { lastPurchaseAt: new Date() } });

      await writeAudit(tx, {
        actorId: actor.id,
        action: PERMISSION.SALE_CREATE,
        entityType: "Sale",
        entityId: sale.id,
        description: `Sale ${saleNumber}: ${prepared.length} product(s), total ${formatCurrency(calc.total, settings.currency)} (${input.paymentMethod})${soldBelowCost ? " · sold below cost" : ""}`,
      });
      return { id: sale.id, slug: sale.slug, saleNumber };
    },
    { timeout: 20_000, maxWait: 10_000 },
  );
}

export async function voidSale(actor: Actor, raw: unknown) {
  assertRolePermission(actor.role, PERMISSION.SALE_VOID);
  const { saleId, reason } = voidSaleSchema.parse(raw);
  await prisma.$transaction(async (tx) => {
    // status flip is the lock: a second concurrent void matches 0 rows
    const flipped = await tx.sale.updateMany({
      where: { id: saleId, status: "COMPLETED" },
      data: { status: "VOIDED", voidedAt: new Date(), voidedById: actor.id, voidReason: reason, paymentStatus: "REFUNDED" },
    });
    if (flipped.count === 0) {
      const exists = await tx.sale.findUnique({ where: { id: saleId }, select: { id: true } });
      throw new DomainError(exists ? "CONFLICT" : "NOT_FOUND", exists ? "This sale has already been voided." : "Sale not found.");
    }
    const sale = await tx.sale.findUniqueOrThrow({ where: { id: saleId }, include: { items: true, customer: { select: { id: true } } } });

    const itemIds = sale.items.map((i) => i.id);
    await tx.productSerial.updateMany({ where: { saleItemId: { in: itemIds } }, data: { status: "IN_STOCK" } });

    for (const item of [...sale.items].sort((a, b) => a.productId.localeCompare(b.productId))) {
      await changeStock(tx, {
        productId: item.productId,
        delta: item.quantity,
        type: "RETURN", // reversal entry
        referenceType: PERMISSION.SALE_VOID,
        referenceId: sale.id,
        reason: `Void ${sale.saleNumber}: ${reason}`,
        userId: actor.id,
      });
    }

    if (sale.customerId) {
      const last = await tx.sale.findFirst({ where: { customerId: sale.customerId, status: "COMPLETED" }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
      await tx.customer.update({ where: { id: sale.customerId }, data: { lastPurchaseAt: last?.createdAt ?? null } });
    }
    await writeAudit(tx, { actorId: actor.id, action: PERMISSION.SALE_VOID, entityType: "Sale", entityId: sale.id, description: `Voided sale ${sale.saleNumber}: ${reason}` });
  });
}

// ---------- queries ----------
export type SalesQuery = {
  from: Date;
  to: Date;
  employeeId?: string;
  customerId?: string;
  paymentMethod?: PaymentMethod;
  status?: SaleStatus;
  search?: string;
  sort: "saleNumber" | "createdAt" | "total" | "paymentStatus";
  order: SortOrder;
} & PageQuery;

export function parseSalesQuery(sp: SearchParams): SalesQuery {
  const range = resolveRange(first(sp.range), first(sp.from), first(sp.to), { fallback: "last30" });
  const pm = first(sp.payment);
  const st = first(sp.status);
  const sorting = parseSort(sp, ["saleNumber", "createdAt", "total", "paymentStatus"] as const, "createdAt");
  return {
    ...parsePage(sp),
    ...sorting,
    from: range.from,
    to: range.to,
    employeeId: first(sp.employee),
    customerId: first(sp.customer),
    paymentMethod: PAYMENT_METHODS.includes(pm as PaymentMethod) ? (pm as PaymentMethod) : undefined,
    status: st === "COMPLETED" || st === "VOIDED" ? st : undefined,
    search: first(sp.search),
  };
}

export async function listSales(user: { id: string; role: Role }, q: SalesQuery) {
  assertRolePermission(user.role, PERMISSION.SALE_VIEW);
  const ownOnly = !hasPermission(user.role, PERMISSION.SALE_VIEW_ALL);
  const where: Prisma.SaleWhereInput = {
    createdAt: { gte: q.from, lt: q.to },
    ...(ownOnly ? { employeeId: user.id } : q.employeeId && { employeeId: q.employeeId }),
    ...(q.customerId && { customerId: q.customerId }),
    ...(q.paymentMethod && { paymentMethod: q.paymentMethod }),
    ...(q.status && { status: q.status }),
    ...(q.search && { OR: [{ saleNumber: { contains: q.search, mode: "insensitive" } }, { customer: { name: { contains: q.search, mode: "insensitive" } } }] }),
  };
  const [rows, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      orderBy: { [q.sort]: q.order },
      skip: q.skip,
      take: q.take,
      include: { employee: { select: { firstName: true, lastName: true } }, customer: { select: { name: true } }, _count: { select: { items: true } } },
    }),
    prisma.sale.count({ where }),
  ]);
  return paged(rows, total, q);
}

/** Employees can only open their own sales (returns null → 404 for anyone else's). */
export async function getSaleForUser(user: { id: string; role: Role }, id: string) {
  assertRolePermission(user.role, PERMISSION.SALE_VIEW);
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      employee: { select: { firstName: true, lastName: true } },
      voidedBy: { select: { firstName: true, lastName: true } },
      customer: true,
      items: { include: { serials: { select: { serial: true } } }, orderBy: { productName: "asc" } },
    },
  });
  if (!sale) return null;
  if (!hasPermission(user.role, PERMISSION.SALE_VIEW_ALL) && sale.employeeId !== user.id) return null;
  return sale;
}

export async function getSaleForUserBySlug(user: { id: string; role: Role }, slug: string) {
  assertRolePermission(user.role, PERMISSION.SALE_VIEW);
  const sale = await prisma.sale.findUnique({
    where: { slug },
    include: {
      employee: { select: { firstName: true, lastName: true } },
      voidedBy: { select: { firstName: true, lastName: true } },
      customer: true,
      items: { include: { serials: { select: { serial: true } } }, orderBy: { productName: "asc" } },
    },
  });
  if (!sale) return null;
  if (!hasPermission(user.role, PERMISSION.SALE_VIEW_ALL) && sale.employeeId !== user.id) return null;
  return sale;
}
