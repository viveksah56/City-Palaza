import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { money, toDb } from "@/lib/money";
import { PERMISSION, assertRolePermission, hasPermission } from "@/lib/rbac/permission";
import { ROLE, type Role } from "@/lib/constants/roles";
import { closeShiftSchema, openShiftSchema } from "@/validations/shift";
import type { Actor } from "./inventory.service";

export type ShiftSummary = {
  id: string;
  status: "OPEN" | "CLOSED";
  openedAt: Date;
  openedBy: string;
  openedById: string;
  openingBalance: string;
  closedAt: Date | null;
  closedBy: string | null;
  cashSales: string;
  expectedCash: string;
  countedCash: string | null;
  variance: string | null;
  salesCount: number;
  notes: string | null;
};

const userSelect = { select: { firstName: true, lastName: true } } as const;
const name = (u: { firstName: string; lastName: string } | null) => (u ? `${u.firstName} ${u.lastName}`.trim() : null);

/** Cash taken on completed sales attached to the shift (voided sales are refunded and excluded). */
async function cashTakenFor(shiftId: string, db: typeof prisma = prisma) {
  const [cash, count] = await Promise.all([
    db.salePayment.aggregate({ where: { method: "CASH", sale: { shiftId, status: "COMPLETED" } }, _sum: { amount: true } }),
    db.sale.count({ where: { shiftId, status: "COMPLETED" } }),
  ]);
  return { cash: money(cash._sum.amount ?? 0), count };
}

export async function getOpenShift(): Promise<ShiftSummary | null> {
  const shift = await prisma.cashShift.findFirst({ where: { status: "OPEN" }, include: { openedBy: userSelect, closedBy: userSelect } });
  if (!shift) return null;
  const { cash, count } = await cashTakenFor(shift.id);
  return toSummary(shift, cash.toFixed(2), count);
}

type ShiftRow = NonNullable<Awaited<ReturnType<typeof prisma.cashShift.findFirst<{ include: { openedBy: typeof userSelect; closedBy: typeof userSelect } }>>>>;
function toSummary(s: ShiftRow, liveCash: string, salesCount: number): ShiftSummary {
  const cashSales = s.cashSales?.toFixed(2) ?? liveCash;
  return {
    id: s.id,
    status: s.status,
    openedAt: s.openedAt,
    openedBy: name(s.openedBy) ?? "",
    openedById: s.openedById,
    openingBalance: s.openingBalance.toFixed(2),
    closedAt: s.closedAt,
    closedBy: name(s.closedBy),
    cashSales,
    expectedCash: s.expectedCash?.toFixed(2) ?? money(s.openingBalance.plus(cashSales)).toFixed(2),
    countedCash: s.countedCash?.toFixed(2) ?? null,
    variance: s.variance?.toFixed(2) ?? null,
    salesCount,
    notes: s.notes,
  };
}

export async function openShift(actor: Actor, raw: unknown) {
  assertRolePermission(actor.role, PERMISSION.SHIFT_OPEN);
  const v = openShiftSchema.parse(raw);
  try {
    return await prisma.$transaction(async (tx) => {
      const shift = await tx.cashShift.create({ data: { openedById: actor.id, openingBalance: toDb(v.openingBalance), notes: v.notes?.trim() || null } });
      await writeAudit(tx, { actorId: actor.id, action: PERMISSION.SHIFT_OPEN, entityType: "CashShift", entityId: shift.id, description: `Opened register with ${money(v.openingBalance).toFixed(2)}` });
      return { id: shift.id };
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new DomainError("CONFLICT", "A shift is already open. Close it before opening a new one.");
    }
    throw error;
  }
}

export async function closeShift(actor: Actor, raw: unknown) {
  assertRolePermission(actor.role, PERMISSION.SHIFT_CLOSE);
  const v = closeShiftSchema.parse(raw);
  return prisma.$transaction(async (tx) => {
    const shift = await tx.cashShift.findUnique({ where: { id: v.shiftId } });
    if (!shift) throw new DomainError("NOT_FOUND", "Shift not found.");
    if (shift.status !== "OPEN") throw new DomainError("CONFLICT", "This shift is already closed.");
    if (actor.role !== ROLE.ADMIN && shift.openedById !== actor.id) throw new DomainError("FORBIDDEN", "Only the person who opened the shift (or an admin) can close it.");
    const { cash } = await cashTakenFor(shift.id, tx as unknown as typeof prisma);
    const expected = money(shift.openingBalance.plus(cash));
    const counted = money(v.countedCash);
    const variance = money(counted.minus(expected));
    const closed = await tx.cashShift.updateMany({
      where: { id: shift.id, status: "OPEN" },
      data: { status: "CLOSED", closedAt: new Date(), closedById: actor.id, cashSales: toDb(cash), expectedCash: toDb(expected), countedCash: toDb(counted), variance: toDb(variance), notes: v.notes?.trim() || shift.notes },
    });
    if (closed.count !== 1) throw new DomainError("CONFLICT", "This shift was closed by someone else.");
    await writeAudit(tx, { actorId: actor.id, action: PERMISSION.SHIFT_CLOSE, entityType: "CashShift", entityId: shift.id, description: `Closed register: expected ${expected.toFixed(2)}, counted ${counted.toFixed(2)}, variance ${variance.toFixed(2)}` });
    return { expectedCash: expected.toFixed(2), countedCash: counted.toFixed(2), variance: variance.toFixed(2) };
  });
}

export async function listShifts(user: { id: string; role: Role }, take = 30): Promise<ShiftSummary[]> {
  assertRolePermission(user.role, PERMISSION.SHIFT_VIEW);
  const ownOnly = !hasPermission(user.role, PERMISSION.SHIFT_VIEW_ALL);
  const rows = await prisma.cashShift.findMany({
    where: ownOnly ? { openedById: user.id } : {},
    orderBy: { openedAt: "desc" },
    take,
    include: { openedBy: userSelect, closedBy: userSelect },
  });
  return Promise.all(rows.map(async (row) => {
    if (row.status === "CLOSED") return toSummary(row, row.cashSales?.toFixed(2) ?? "0.00", await prisma.sale.count({ where: { shiftId: row.id, status: "COMPLETED" } }));
    const { cash, count } = await cashTakenFor(row.id);
    return toSummary(row, cash.toFixed(2), count);
  }));
}
