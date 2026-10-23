import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TEST_DB, prisma, resetDb, fixtures } from "./helpers";

describe.skipIf(!TEST_DB)("product CSV import (PostgreSQL)", () => {
  let products: typeof import("@/server/product-import.service");

  beforeEach(async () => {
    products = await import("@/server/product-import.service");
    await resetDb();
  });

  afterAll(() => prisma.$disconnect());

  it("imports quoted commas and uppercases SKUs", async () => {
    const f = await fixtures();
    const result = await products.importProductsCsv(f.admin, "sku,name,category,purchasePrice,sellingPrice,quantity,trackingType\ncp-quoted,\"Power, Adapter\",Phones,100,150,3,QUANTITY");
    expect(result).toMatchObject({ imported: 1, issues: [] });
    const product = await prisma.product.findUniqueOrThrow({ where: { sku: "CP-QUOTED" } });
    expect(product.name).toBe("Power, Adapter");
    expect(product.quantity).toBe(3);
    expect(await prisma.auditLog.count({ where: { entityId: product.id, action: "PRODUCT_CREATE" } })).toBe(1);
  });

  it("rejects blank prices instead of silently importing zero", async () => {
    const f = await fixtures();
    const result = await products.importProductsCsv(f.admin, "sku,name,category,purchasePrice,sellingPrice,quantity,trackingType\nBLANK,Blank price,Phones,,150,3,QUANTITY");
    expect(result.imported).toBe(0);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ message: "Purchase price is required." })]));
    expect(await prisma.product.count()).toBe(0);
  });

  it("rejects duplicate SKU and barcode rows in the same file without writing products", async () => {
    const f = await fixtures();
    const result = await products.importProductsCsv(f.admin, "sku,name,category,purchasePrice,sellingPrice,quantity,trackingType,barcode\nDUP1,First item,Phones,10,20,1,QUANTITY,123\nDUP1,Second item,Phones,10,20,1,QUANTITY,123");
    expect(result.imported).toBe(0);
    expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ message: "SKU is repeated in this file." }), expect.objectContaining({ message: "Barcode is repeated in this file." })]));
    expect(await prisma.product.count()).toBe(0);
  });

  it("rejects duplicate serialized values, invalid tracking types and batches above 250 rows", async () => {
    const f = await fixtures();
    const duplicateSerial = await products.importProductsCsv(f.admin, "sku,name,category,purchasePrice,sellingPrice,quantity,trackingType,serialnumbers\nSERIAL,Serial product,Phones,10,20,2,SERIALIZED,SN100|sn-100");
    expect(duplicateSerial.imported).toBe(0);
    expect(duplicateSerial.issues.length).toBeGreaterThan(0);
    const invalidType = await products.importProductsCsv(f.admin, "sku,name,category,purchasePrice,sellingPrice,quantity,trackingType\nBADTYPE,Invalid product,Phones,10,20,1,UNKNOWN");
    expect(invalidType.imported).toBe(0);
    expect(invalidType.issues.length).toBeGreaterThan(0);
    const rows = Array.from({ length: 251 }, (_, index) => `SKU${index},Product ${index},Phones,10,20,1,QUANTITY`).join("\n");
    await expect(products.importProductsCsv(f.admin, `sku,name,category,purchasePrice,sellingPrice,quantity,trackingType\n${rows}`)).rejects.toThrow(/at most 250/i);
    expect(await prisma.product.count()).toBe(0);
  });

  it("rolls back categories, products and audits when an imported serial already exists", async () => {
    const f = await fixtures();
    const existing = await f.mk("EXISTING-SERIAL", { trackingType: "SERIALIZED" });
    const { addStock } = await import("@/server/inventory.service");
    await addStock(f.admin, { productId: existing.id, type: "PURCHASE", serials: ["SERIAL-001"] });
    await expect(products.importProductsCsv(f.admin, "sku,name,category,purchasePrice,sellingPrice,quantity,trackingType,serialnumbers\nROLLBACK,Rollback item,Fresh category,10,20,1,SERIALIZED,SERIAL-001")).rejects.toThrow(/already registered/i);
    expect(await prisma.category.count({ where: { name: "Fresh category" } })).toBe(0);
    expect(await prisma.product.count({ where: { sku: "ROLLBACK" } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "PRODUCT_CREATE", description: { contains: "Rollback item" } } })).toBe(0);
  });

  it("reactivates an existing inactive category and brand during import", async () => {
    const f = await fixtures();
    const category = await prisma.category.update({ where: { id: f.category.id }, data: { isActive: false } });
    const brand = await prisma.brand.create({ data: { name: "North Star", slug: "north-star", isActive: false } });
    const result = await products.importProductsCsv(f.admin, "sku,name,category,brand,purchasePrice,sellingPrice,quantity,trackingType\nREUSE,Reuse catalog,Phones,North Star,10,20,0,QUANTITY");
    expect(result.imported).toBe(1);
    expect((await prisma.category.findUniqueOrThrow({ where: { id: category.id } })).isActive).toBe(true);
    expect((await prisma.brand.findUniqueOrThrow({ where: { id: brand.id } })).isActive).toBe(true);
    expect(await prisma.auditLog.count({ where: { entityId: category.id, action: "CATEGORY_UPDATE" } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { entityId: brand.id, action: "BRAND_UPDATE" } })).toBe(1);
  });
});
