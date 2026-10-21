/**
 * Constraints Prisma cannot express in schema.prisma. Idempotent – safe to re-run.
 *  - stock can never be negative (defence in depth next to the guarded UPDATE)
 *  - prices / quantities are non-negative
 *  - trigram index so product-name search stays fast with thousands of rows
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const statements = [
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_quantity_non_negative') THEN
       ALTER TABLE "Product" ADD CONSTRAINT product_quantity_non_negative CHECK ("quantity" >= 0);
     END IF;
   END $$;`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_prices_non_negative') THEN
       ALTER TABLE "Product" ADD CONSTRAINT product_prices_non_negative CHECK ("purchasePrice" >= 0 AND "sellingPrice" >= 0);
     END IF;
   END $$;`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saleitem_quantity_positive') THEN
       ALTER TABLE "SaleItem" ADD CONSTRAINT saleitem_quantity_positive CHECK ("quantity" > 0);
     END IF;
   END $$;`,
];

const optional = [
  `CREATE EXTENSION IF NOT EXISTS pg_trgm;`,
  `CREATE INDEX IF NOT EXISTS product_name_trgm_idx ON "Product" USING gin ("name" gin_trgm_ops);`,
];

async function main() {
  for (const sql of statements) await prisma.$executeRawUnsafe(sql);
  for (const sql of optional) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e) {
      console.warn("Optional statement skipped (needs extension privileges):", (e as Error).message);
    }
  }
  console.log("✔ Database constraints applied");
}

main().finally(() => prisma.$disconnect());
