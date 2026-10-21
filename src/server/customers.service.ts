import {PERMISSION, assertRolePermission} from "@/lib/rbac/permission";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { customerSchema } from "@/validations/customer";
import { emptyToNull } from "@/validations/common";
import { parsePage, paged, type PageQuery } from "@/lib/pagination";
import { first, type SearchParams } from "@/lib/url";
import type { Actor } from "./inventory.service";

export type CustomerQuery = { search?: string } & PageQuery;
export const parseCustomerQuery = (sp: SearchParams): CustomerQuery => ({ ...parsePage(sp), search: first(sp.search) });

export async function getCustomerOverview() {
  const [customers, purchasingCustomers] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { sales: { some: { status: "COMPLETED" } } } }),
  ]);
  return { customers, purchasingCustomers };
}

export async function listCustomers(q: CustomerQuery) {
  const where: Prisma.CustomerWhereInput = q.search
    ? { OR: [{ name: { contains: q.search, mode: "insensitive" } }, { phone: { contains: q.search } }, { email: { contains: q.search, mode: "insensitive" } }] }
    : {};
  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: [{ lastPurchaseAt: { sort: "desc", nulls: "last" } }, { name: "asc" }],
      skip: q.skip,
      take: q.take,
      select: { id: true, name: true, phone: true, email: true, address: true, lastPurchaseAt: true, _count: { select: { sales: true } } },
    }),
    prisma.customer.count({ where }),
  ]);
  return paged(rows, total, q);
}

export async function searchCustomers(term: string) {
  const t = term.trim();
  if (!t) return [];
  return prisma.customer.findMany({
    where: { OR: [{ name: { contains: t, mode: "insensitive" } }, { phone: { contains: t } }] },
    take: 8,
    orderBy: { name: "asc" },
    select: { id: true, name: true, phone: true },
  });
}

export async function saveCustomer(actor: Actor, raw: unknown) {
  const v = customerSchema.parse(raw);
  assertRolePermission(actor.role, v.id ? PERMISSION.CUSTOMER_UPDATE : PERMISSION.CUSTOMER_CREATE);
  const data = { name: v.name.trim(), phone: emptyToNull(v.phone), email: emptyToNull(v.email), address: emptyToNull(v.address) };
  return prisma.$transaction(async (tx) => {
    const c = v.id ? await tx.customer.update({ where: { id: v.id }, data }) : await tx.customer.create({ data });
    await writeAudit(tx, {
      actorId: actor.id,
      action: v.id ? PERMISSION.CUSTOMER_UPDATE : PERMISSION.CUSTOMER_CREATE,
      entityType: "Customer",
      entityId: c.id,
      description: `${v.id ? "Updated" : "Created"} customer ${c.name}`,
    });
    return { id: c.id, name: c.name, phone: c.phone };
  });
}

export async function getCustomer(id: string) {
  return prisma.customer.findUnique({ where: { id } });
}
