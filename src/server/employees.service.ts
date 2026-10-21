import {PERMISSION, assertRolePermission} from "@/lib/rbac/permission";
import type { Prisma, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { emptyToNull } from "@/validations/common";
import { employeeCreateSchema, employeeUpdateSchema, passwordResetSchema } from "@/validations/employee";
import { parsePage, paged, type PageQuery } from "@/lib/pagination";
import { first, type SearchParams } from "@/lib/url";
import type { Actor } from "./inventory.service";
import { ROLE } from "@/lib/constants/roles";

export type EmployeeQuery = { search?: string; status?: UserStatus } & PageQuery;
export function parseEmployeeQuery(sp: SearchParams): EmployeeQuery {
  const s = first(sp.status);
  return { ...parsePage(sp), search: first(sp.search), status: s === "ACTIVE" || s === "INACTIVE" || s === "SUSPENDED" ? s : undefined };
}

export async function getEmployeeOverview() {
  const [total, active] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
  ]);
  return { total, active, disabled: total - active };
}

const publicSelect = { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, status: true, lastLoginAt: true, createdAt: true } as const;

export async function listEmployees(q: EmployeeQuery) {
  const where: Prisma.UserWhereInput = {
    ...(q.status && { status: q.status }),
    ...(q.search && {
      OR: [
        { firstName: { contains: q.search, mode: "insensitive" } },
        { lastName: { contains: q.search, mode: "insensitive" } },
        { email: { contains: q.search, mode: "insensitive" } },
      ],
    }),
  };
  const [rows, total] = await Promise.all([
    prisma.user.findMany({ where, orderBy: [{ status: "asc" }, { firstName: "asc" }], skip: q.skip, take: q.take, select: { ...publicSelect, _count: { select: { sales: true } } } }),
    prisma.user.count({ where }),
  ]);
  return paged(rows, total, q);
}

export const getEmployee = (id: string) => prisma.user.findUnique({ where: { id }, select: { ...publicSelect, _count: { select: { sales: true } } } });
export const listEmployeeOptions = () => prisma.user.findMany({ orderBy: { firstName: "asc" }, select: { id: true, firstName: true, lastName: true, status: true } });

export async function createEmployee(actor: Actor, raw: unknown) {
  assertRolePermission(actor.role, PERMISSION.EMPLOYEE_CREATE);
  const v = employeeCreateSchema.parse(raw);
  const passwordHash = await hashPassword(v.password);
  return prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { firstName: v.firstName.trim(), lastName: v.lastName.trim(), email: v.email, phone: emptyToNull(v.phone), role: v.role, passwordHash },
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
    const before = await tx.user.findUnique({ where: { id: v.id }, select: { role: true } });
    if (!before) throw new DomainError("NOT_FOUND", "Account not found.");
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

/** Employees are never deleted (they own historical sales) – only disabled. */
export async function setEmployeeStatus(actor: Actor, id: string, status: UserStatus) {
  assertRolePermission(actor.role, PERMISSION.EMPLOYEE_DISABLE);
  if (id === actor.id && status !== "ACTIVE") throw new DomainError("CONFLICT", "You can't disable your own account.");
  await prisma.$transaction(async (tx) => {
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

export async function resetEmployeePassword(actor: Actor, raw: unknown) {
  assertRolePermission(actor.role, PERMISSION.EMPLOYEE_UPDATE);
  const v = passwordResetSchema.parse(raw);
  const passwordHash = await hashPassword(v.password);
  await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id: v.id }, data: { passwordHash }, select: { email: true } });
    await tx.session.deleteMany({ where: { userId: v.id } });
    await writeAudit(tx, { actorId: actor.id, action: "EMPLOYEE_PASSWORD_RESET", entityType: "User", entityId: v.id, description: `Reset password for ${u.email}` });
  });
}
