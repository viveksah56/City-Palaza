/**
 * Constraints Prisma cannot express in schema.prisma. Idempotent – safe to re-run.
 *  - stock can never be negative (defence in depth next to the guarded UPDATE)
 *  - prices / quantities are non-negative
 *  - trigram index so product-name search stays fast with thousands of rows
 */
import { config } from "dotenv";
import { createPrismaClient } from "@/lib/prisma";

config({ path: process.env.PRISMA_ENV_FILE ?? (process.env.NODE_ENV === "production" ? ".env.production" : ".env.local") });

const prisma = createPrismaClient();

const statements = [
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'citypalaza_database' AND conname = 'product_quantity_non_negative') THEN
       ALTER TABLE "citypalaza_database"."Product" ADD CONSTRAINT product_quantity_non_negative CHECK ("quantity" >= 0);
     END IF;
   END $$;`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'citypalaza_database' AND conname = 'product_prices_non_negative') THEN
       ALTER TABLE "citypalaza_database"."Product" ADD CONSTRAINT product_prices_non_negative CHECK ("purchasePrice" >= 0 AND "sellingPrice" >= 0);
     END IF;
   END $$;`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'citypalaza_database' AND conname = 'saleitem_quantity_positive') THEN
       ALTER TABLE "citypalaza_database"."SaleItem" ADD CONSTRAINT saleitem_quantity_positive CHECK ("quantity" > 0);
     END IF;
   END $$;`,
];

const optional = [
  `CREATE EXTENSION IF NOT EXISTS pg_trgm;`,
  `CREATE INDEX IF NOT EXISTS product_name_trgm_idx ON "citypalaza_database"."Product" USING gin ("name" gin_trgm_ops);`,
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

main()
  .catch((error: unknown) => {
    console.error("Failed to apply database constraints.");
    console.error(error instanceof Error ? error.message : "Unknown database error.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
