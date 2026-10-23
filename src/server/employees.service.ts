import {PERMISSION, assertRolePermission} from "@/lib/rbac/permission";
import type { Prisma, UserStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { emptyToNull } from "@/validations/common";
import { employeeCreateSchema, employeeUpdateSchema, passwordResetSchema } from "@/validations/employee";
import { parsePage, parseSort, paged, type PageQuery, type SortOrder } from "@/lib/pagination";
import { first, type SearchParams } from "@/lib/url";
import type { Actor } from "./inventory.service";
import { ROLE } from "@/lib/constants/roles";
import { randomUUID } from "node:crypto";
import { timeServerOperation } from "./timing";
import { uniqueSlug } from "@/lib/slug";

export type EmployeeQuery = { search?: string; status?: UserStatus; sort: "firstName" | "role" | "status" | "lastLoginAt"; order: SortOrder } & PageQuery;
export function parseEmployeeQuery(sp: SearchParams): EmployeeQuery {
  const s = first(sp.status);
  return { ...parsePage(sp), ...parseSort(sp, ["firstName", "role", "status", "lastLoginAt"] as const, "firstName"), search: first(sp.search), status: s === "ACTIVE" || s === "INACTIVE" || s === "SUSPENDED" ? s : undefined };
}

export async function getEmployeeOverview() {
  const [total, active] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { status: "ACTIVE", deletedAt: null } }),
  ]);
  return { total, active, disabled: total - active };
}

const publicSelect = { id: true, slug: true, firstName: true, lastName: true, email: true, phone: true, role: true, status: true, lastLoginAt: true, createdAt: true } as const;

export async function listEmployees(q: EmployeeQuery) {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(q.status && { status: q.status }),
    ...(q.search && {
      OR: [
        { firstName: { contains: q.search, mode: "insensitive" } },
        { lastName: { contains: q.search, mode: "insensitive" } },
        { email: { contains: q.search, mode: "insensitive" } },
      ],
    }),
  };
  return timeServerOperation("employees.list.fetch", async () => {
  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: q.sort === "lastLoginAt" ? { lastLoginAt: { sort: q.order, nulls: "last" } } : { [q.sort]: q.order }, skip: q.skip, take: q.take, select: { ...publicSelect, _count: { select: { sales: true } } } }),
    prisma.user.count({ where }),
  ]);
  return paged(rows, total, q);
  });
}

export const getEmployeeBySlug = (slug: string) => prisma.user.findFirst({ where: { slug, deletedAt: null }, select: { ...publicSelect, _count: { select: { sales: true } } } });
export const listEmployeeOptions = () => prisma.user.findMany({ where: { deletedAt: null }, orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true, status: true } });

async function requireAnotherActiveAdmin(tx: Prisma.TransactionClient, id: string) {
  const count = await tx.user.count({ where: { id: { not: id }, role: ROLE.ADMIN, status: "ACTIVE", deletedAt: null } });
  if (count === 0) throw new DomainError("CONFLICT", "Keep at least one other active admin account before making this change.");
}

async function lockAdminAccessChanges(tx: Prisma.TransactionClient) {
  await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_advisory_xact_lock(641807214) IS NULL AS locked`;
}

export async function createEmployee(actor: Actor, raw: unknown) {
  assertRolePermission(actor.role, PERMISSION.EMPLOYEE_CREATE);
  const v = employeeCreateSchema.parse(raw);
  const passwordHash = await hashPassword(v.password);
  return prisma.$transaction(async (tx) => {
    const slug = await uniqueSlug(`${v.firstName} ${v.lastName}`, async (value) => !!(await tx.user.findUnique({ where: { slug: value }, select: { id: true } })));
    const u = await tx.user.create({
      data: { slug, firstName: v.firstName.trim(), lastName: v.lastName.trim(), email: v.email, phone: emptyToNull(v.phone), role: v.role, passwordHash },
      select: { id: true, email: true },
    });
    await writeAudit(tx, { actorId: actor.id, action: PERMISSION.EMPLOYEE_CREATE, entityType: "User", entityId: u.id, description: `Created ${v.role.toLowerCase()} account for ${u.email}` });
    return { id: u.id };
  });
}

export async function updateEmployee(actor: Actor, raw: unknown) {
  assertRolePermission(actor.role, PERMISSION.EMPLOYEE_UPDATE);
  const v = employeeUpdateSchema.parse(raw);
  if (v.id === actor.id && v.role !== ROLE.ADMIN) throw new DomainError("CONFLICT", "You can't remove your own admin role.");
  await prisma.$transaction(async (tx) => {
    await lockAdminAccessChanges(tx);
    const before = await tx.user.findFirst({ where: { id: v.id, deletedAt: null }, select: { role: true, status: true } });
    if (!before) throw new DomainError("NOT_FOUND", "Account not found.");
    if (before.role === ROLE.ADMIN && before.status === "ACTIVE" && v.role !== ROLE.ADMIN) await requireAnotherActiveAdmin(tx, v.id);
    const u = await tx.user.update({
      where: { id: v.id },
      data: { firstName: v.firstName.trim(), lastName: v.lastName.trim(), email: v.email, phone: emptyToNull(v.phone), role: v.role },
      select: { email: true },
    });
    // role changed → force that person to sign in again so the new permissions apply
    if (before.role !== v.role && v.id !== actor.id) await tx.session.deleteMany({ where: { userId: v.id } });
    await writeAudit(tx, { actorId: actor.id, action: PERMISSION.EMPLOYEE_UPDATE, entityType: "User", entityId: v.id, description: `Updated account ${u.email} (role ${v.role})` });
  });
}

export async function setEmployeeStatus(actor: Actor, id: string, status: UserStatus) {
  assertRolePermission(actor.role, PERMISSION.EMPLOYEE_DISABLE);
  if (id === actor.id && status !== "ACTIVE") throw new DomainError("CONFLICT", "You can't disable your own account.");
  await prisma.$transaction(async (tx) => {
    await lockAdminAccessChanges(tx);
    const existing = await tx.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, role: true, status: true, email: true } });
    if (!existing) throw new DomainError("NOT_FOUND", "Account not found.");
    if (existing.role === ROLE.ADMIN && existing.status === "ACTIVE" && status !== "ACTIVE") await requireAnotherActiveAdmin(tx, id);
    const u = await tx.user.update({ where: { id }, data: { status }, select: { email: true } });
    if (status !== "ACTIVE") await tx.session.deleteMany({ where: { userId: id } }); // kick out immediately
    await writeAudit(tx, {
      actorId: actor.id,
      action: status === "ACTIVE" ? "EMPLOYEE_REACTIVATE" : PERMISSION.EMPLOYEE_DISABLE,
      entityType: "User",
      entityId: id,
      description: `${status === "ACTIVE" ? "Reactivated" : `Set ${status} –`} ${u.email}`,
    });
  });
}

export async function deleteEmployee(actor: Actor, id: string) {
  assertRolePermission(actor.role, PERMISSION.EMPLOYEE_DELETE);
  if (id === actor.id) throw new DomainError("CONFLICT", "You can't delete your own account.");
  const deletedPasswordHash = await hashPassword(randomUUID());
  await prisma.$transaction(async (tx) => {
    await lockAdminAccessChanges(tx);
    const existing = await tx.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, email: true, role: true, status: true } });
    if (!existing) throw new DomainError("NOT_FOUND", "Account not found.");
    if (existing.role === ROLE.ADMIN && existing.status === "ACTIVE") await requireAnotherActiveAdmin(tx, id);
    const now = new Date();
    await Promise.all([
      tx.user.update({
        where: { id },
        data: {
          firstName: "Deleted",
          lastName: "Account",
          email: `deleted+${id}@deleted.citypalaza.invalid`,
          phone: null,
          passwordHash: deletedPasswordHash,
          status: "SUSPENDED",
          deletedAt: now,
        },
      }),
      tx.session.deleteMany({ where: { userId: id } }),
      tx.passwordResetToken.deleteMany({ where: { userId: id } }),
      tx.auditLog.updateMany({ where: { actorId: id }, data: { description: "Activity recorded for an anonymized account." } }),
      tx.auditLog.updateMany({ where: { entityType: "User", entityId: id }, data: { description: "Account management event for an anonymized account." } }),
    ]);
    await writeAudit(tx, {
      actorId: actor.id,
      action: PERMISSION.EMPLOYEE_DELETE,
      entityType: "User",
      entityId: id,
      description: `Anonymized and deleted access for account ${id}`,
    });
  });
}

export async function resetEmployeePassword(actor: Actor, raw: unknown) {
  assertRolePermission(actor.role, PERMISSION.EMPLOYEE_UPDATE);
  const v = passwordResetSchema.parse(raw);
  const passwordHash = await hashPassword(v.password);
  await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findFirst({ where: { id: v.id, deletedAt: null }, select: { id: true } });
    if (!existing) throw new DomainError("NOT_FOUND", "Account not found.");
    const u = await tx.user.update({ where: { id: v.id }, data: { passwordHash }, select: { email: true } });
    await tx.session.deleteMany({ where: { userId: v.id } });
    await writeAudit(tx, { actorId: actor.id, action: "EMPLOYEE_PASSWORD_RESET", entityType: "User", entityId: v.id, description: `Reset password for ${u.email}` });
  });
}
