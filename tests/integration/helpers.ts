import { createPrismaClient } from "@/lib/prisma";

export const TEST_DB = process.env.TEST_DATABASE_URL;
if (TEST_DB) process.env.DATABASE_URL = TEST_DB;

export const prisma = createPrismaClient();

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "AuditLog","InventoryTransaction","ProductSerial","SaleItem","Sale","Customer","Product","Category","Brand","Session","User","Setting","Counter","RolePermission","Permission","Role" RESTART IDENTITY CASCADE`,
  );
  for (const key of ["ADMIN", "EMPLOYEE"] as const) await prisma.role.create({ data: { key, name: key } });
}

export async function fixtures() {
  const admin = await prisma.user.create({ data: { firstName: "Ada", lastName: "Admin", email: "admin@t.local", passwordHash: "x", role: "ADMIN" } });
  const emp = await prisma.user.create({ data: { firstName: "Eve", lastName: "Emp", email: "emp@t.local", passwordHash: "x", role: "EMPLOYEE" } });
  const category = await prisma.category.create({ data: { name: "Phones", slug: "phones" } });
  const mk = (sku: string, over: Record<string, unknown> = {}) =>
    prisma.product.create({ data: { sku, name: `Product ${sku}`, categoryId: category.id, purchasePrice: "800.00", sellingPrice: "1000.00", minStock: 1, ...over } });
  return { admin: { id: admin.id, role: "ADMIN" as const }, emp: { id: emp.id, role: "EMPLOYEE" as const }, category, mk };
}
