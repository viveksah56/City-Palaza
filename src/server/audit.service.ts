import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { resolveRange } from "@/lib/dates";
import { parsePage, parseSort, paged, type PageQuery, type SortOrder } from "@/lib/pagination";
import { first, type SearchParams } from "@/lib/url";

export type AuditQuery = { action?: string; actorId?: string; search?: string; from: Date; to: Date; sort: "createdAt" | "action"; order: SortOrder } & PageQuery;

export function parseAuditQuery(sp: SearchParams): AuditQuery {
  const r = resolveRange(first(sp.range), first(sp.from), first(sp.to), { fallback: "last7" });
  return { ...parsePage(sp, 25), ...parseSort(sp, ["createdAt", "action"] as const, "createdAt"), action: first(sp.action), actorId: first(sp.actor), search: first(sp.search), from: r.from, to: r.to };
}

export async function listAuditLogs(q: AuditQuery) {
  const where: Prisma.AuditLogWhereInput = {
    createdAt: { gte: q.from, lt: q.to },
    ...(q.action && { action: q.action }),
    ...(q.actorId && { actorId: q.actorId }),
    ...(q.search && { OR: [{ description: { contains: q.search, mode: "insensitive" } }, { entityId: q.search }] }),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { [q.sort]: q.order }, skip: q.skip, take: q.take, include: { actor: { select: { firstName: true, lastName: true, email: true } } } }),
    prisma.auditLog.count({ where }),
  ]);
  return paged(rows, total, q);
}
