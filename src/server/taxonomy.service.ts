import { PERMISSION, assertRolePermission } from "@/lib/rbac/permission";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { slugify } from "@/lib/format";
import { emptyToNull } from "@/validations/common";
import { categoryBrandSchema } from "@/validations/product";
import type { Actor } from "./inventory.service";
import { TAXONOMY_KIND, type TaxonomyKind } from "@/lib/constants/categories";

export type { TaxonomyKind } from "@/lib/constants/categories";

const AUDIT = {
  [TAXONOMY_KIND.CATEGORY]: { create: PERMISSION.CATEGORY_CREATE, update: PERMISSION.CATEGORY_UPDATE, delete: PERMISSION.CATEGORY_DELETE, entity: "Category" },
  [TAXONOMY_KIND.BRAND]: { create: PERMISSION.BRAND_CREATE, update: PERMISSION.BRAND_UPDATE, delete: PERMISSION.BRAND_DELETE, entity: "Brand" },
} as const;

export async function saveTaxonomy(actor: Actor, kind: TaxonomyKind, raw: unknown) {
  const v = categoryBrandSchema.parse(raw);
  assertRolePermission(actor.role, AUDIT[kind][v.id ? "update" : "create"]);
  const data = { name: v.name.trim(), slug: slugify(v.name), description: emptyToNull(v.description), isActive: v.isActive };
  if (!data.slug) throw new DomainError("VALIDATION", "Name must contain letters or numbers.");
  const a = AUDIT[kind];

  return prisma.$transaction(async (tx) => {
    let id = v.id;
    if (id) {
      if (kind === TAXONOMY_KIND.CATEGORY) await tx.category.update({ where: { id }, data });
      else await tx.brand.update({ where: { id }, data });
    } else {
      const row = kind === TAXONOMY_KIND.CATEGORY ? await tx.category.create({ data }) : await tx.brand.create({ data });
      id = row.id;
    }
    await writeAudit(tx, {
      actorId: actor.id,
      action: v.id ? a.update : a.create,
      entityType: a.entity,
      entityId: id,
      description: `${v.id ? "Updated" : "Created"} ${kind} “${data.name}”`,
    });
    return { id };
  });
}

export async function deleteTaxonomy(actor: Actor, kind: TaxonomyKind, id: string) {
  const a = AUDIT[kind];
  assertRolePermission(actor.role, a.delete);
  await prisma.$transaction(async (tx) => {
    const used = await tx.product.count({ where: kind === TAXONOMY_KIND.CATEGORY ? { categoryId: id } : { brandId: id } });
    if (used > 0) throw new DomainError("CONFLICT", `${used} product(s) use this ${kind}. Deactivate it instead of deleting.`);
    const row = kind === TAXONOMY_KIND.CATEGORY ? await tx.category.delete({ where: { id } }) : await tx.brand.delete({ where: { id } });
    await writeAudit(tx, { actorId: actor.id, action: a.delete, entityType: a.entity, entityId: id, description: `Deleted ${kind} “${row.name}”` });
  });
}
