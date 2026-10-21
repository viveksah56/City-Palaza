import {PERMISSION, assertRolePermission} from "@/lib/rbac/permission";
import { unstable_cache } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma, type Db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import type { Actor } from "./inventory.service";

export type Settings = {
  shopName: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  currency: string;
  /** percent, tax-exclusive, e.g. 13 */
  taxRate: number;
  invoicePrefix: string;
  /** max manual discount (%) an employee may give */
  employeeDiscountLimit: number;
};

export const DEFAULT_SETTINGS: Settings = {
  shopName: "CityPalaza",
  address: "",
  city: "Kathmandu",
  phone: "",
  email: "",
  currency: "NPR",
  taxRate: 0,
  invoicePrefix: "CP",
  employeeDiscountLimit: 5,
};

/** Always hits the DB – used inside sale transactions (authoritative). */
export async function readSettings(db: Db = prisma): Promise<Settings> {
  const rows = await db.setting.findMany();
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) merged[r.key] = r.value;
  return merged as Settings;
}

/** Cached copy for UI chrome (receipts, formatting). Invalidated by `settings` tag. */
export const getSettings = unstable_cache(() => readSettings(), ["settings"], { tags: ["settings"] });

export async function updateSettings(actor: Actor, next: Settings) {
  assertRolePermission(actor.role, PERMISSION.SETTINGS_UPDATE);
  await prisma.$transaction(async (tx) => {
    const before = await readSettings(tx);
    for (const [key, value] of Object.entries(next)) {
      await tx.setting.upsert({
        where: { key },
        create: { key, value: value as Prisma.InputJsonValue },
        update: { value: value as Prisma.InputJsonValue },
      });
    }
    const changed = (Object.keys(next) as (keyof Settings)[]).filter((k) => before[k] !== next[k]);
    await writeAudit(tx, {
      actorId: actor.id,
      action: PERMISSION.SETTINGS_UPDATE,
      entityType: "Setting",
      description: changed.length ? `Updated settings: ${changed.join(", ")}` : "Saved settings (no changes)",
      metadata: JSON.parse(JSON.stringify({ before, after: next })) as Prisma.InputJsonValue,
    });
  });
}
