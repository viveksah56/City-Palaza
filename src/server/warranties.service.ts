import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { normalizeSerial } from "@/lib/imei";
import { PERMISSION, assertRolePermission } from "@/lib/rbac/permission";
import type { Role } from "@/lib/constants/roles";
import type { Actor } from "./inventory.service";

const include = {
  customer: { select: { name: true, phone: true, slug: true } },
  serial: { select: { serial: true, imei2: true } },
  saleItem: { select: { productName: true, sale: { select: { saleNumber: true, slug: true, createdAt: true } } } },
} as const;

export type WarrantyRow = {
  id: string;
  tag: string;
  status: "ACTIVE" | "CLAIMED" | "VOIDED";
  /** ACTIVE warranties past their end date are reported as expired */
  expired: boolean;
  productName: string;
  imei1: string | null;
  imei2: string | null;
  startsAt: Date;
  endsAt: Date;
  customerName: string | null;
  customerPhone: string | null;
  saleNumber: string;
  saleSlug: string;
  notes: string | null;
};

type Row = Awaited<ReturnType<typeof prisma.warranty.findMany<{ include: typeof include }>>>[number];
function toRow(w: Row, now = new Date()): WarrantyRow {
  return {
    id: w.id, tag: w.tag, status: w.status, expired: w.status === "ACTIVE" && w.endsAt < now,
    productName: w.saleItem.productName, imei1: w.serial?.serial ?? null, imei2: w.serial?.imei2 ?? null,
    startsAt: w.startsAt, endsAt: w.endsAt, customerName: w.customer?.name ?? null, customerPhone: w.customer?.phone ?? null,
    saleNumber: w.saleItem.sale.saleNumber, saleSlug: w.saleItem.sale.slug, notes: w.notes,
  };
}

export async function listCustomerWarranties(user: { role: Role }, customerId: string): Promise<WarrantyRow[]> {
  assertRolePermission(user.role, PERMISSION.WARRANTY_VIEW);
  const rows = await prisma.warranty.findMany({ where: { customerId }, orderBy: { endsAt: "desc" }, include });
  return rows.map((w) => toRow(w));
}

/** Counter lookup: by warranty tag, IMEI 1 or IMEI 2. */
export async function lookupWarranty(user: { role: Role }, term: string): Promise<WarrantyRow[]> {
  assertRolePermission(user.role, PERMISSION.WARRANTY_VIEW);
  const t = term.trim();
  if (t.length < 4) return [];
  const imei = normalizeSerial(t);
  const rows = await prisma.warranty.findMany({
    where: { OR: [{ tag: { equals: t, mode: "insensitive" } }, { serial: { OR: [{ serial: imei }, { imei2: imei }] } }] },
    orderBy: { endsAt: "desc" },
    take: 10,
    include,
  });
  return rows.map((w) => toRow(w));
}

export async function markWarrantyClaimed(actor: Actor, id: string, notes: string) {
  assertRolePermission(actor.role, PERMISSION.WARRANTY_MANAGE);
  const clean = notes.trim().slice(0, 300);
  if (clean.length < 3) throw new DomainError("VALIDATION", "Add a short note about the claim.");
  await prisma.$transaction(async (tx) => {
    const r = await tx.warranty.updateMany({ where: { id, status: "ACTIVE", endsAt: { gte: new Date() } }, data: { status: "CLAIMED", notes: clean } });
    if (r.count !== 1) throw new DomainError("CONFLICT", "Only active, unexpired warranties can be claimed.");
    await writeAudit(tx, { actorId: actor.id, action: PERMISSION.WARRANTY_MANAGE, entityType: "Warranty", entityId: id, description: `Warranty claimed: ${clean}` });
  });
}
