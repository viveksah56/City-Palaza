ALTER TABLE "citypalaza_database"."InventoryTransaction"
  ADD COLUMN "unitCost" DECIMAL(12,2);

UPDATE "citypalaza_database"."InventoryTransaction" AS t
SET "unitCost" = p."purchasePrice"
FROM "citypalaza_database"."Product" AS p
WHERE p."id" = t."productId" AND t."type" IN ('INITIAL_STOCK', 'PURCHASE');

ALTER TABLE "citypalaza_database"."SaleItem"
  ADD COLUMN "categoryName" TEXT;

UPDATE "citypalaza_database"."SaleItem" AS si
SET "categoryName" = c."name"
FROM "citypalaza_database"."Product" AS p
JOIN "citypalaza_database"."Category" AS c ON c."id" = p."categoryId"
WHERE p."id" = si."productId";

UPDATE "citypalaza_database"."SaleItem" SET "categoryName" = 'Uncategorized' WHERE "categoryName" IS NULL;

ALTER TABLE "citypalaza_database"."SaleItem"
  ALTER COLUMN "categoryName" SET NOT NULL;

CREATE TABLE "citypalaza_database"."SalePayment" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "method" "citypalaza_database"."PaymentMethod" NOT NULL,
  "receivedById" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  CONSTRAINT "SalePayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalePayment_saleId_receivedAt_idx" ON "citypalaza_database"."SalePayment"("saleId", "receivedAt");
CREATE INDEX "SalePayment_receivedAt_idx" ON "citypalaza_database"."SalePayment"("receivedAt");

INSERT INTO "citypalaza_database"."SalePayment" ("id", "saleId", "amount", "method", "receivedById", "receivedAt", "note")
SELECT 'opening-' || s."id", s."id", s."amountPaid", s."paymentMethod", s."employeeId", s."createdAt", 'Opening balance imported from existing sale'
FROM "citypalaza_database"."Sale" AS s
WHERE s."status" = 'COMPLETED' AND s."amountPaid" > 0;

ALTER TABLE "citypalaza_database"."SalePayment"
  ADD CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "citypalaza_database"."Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SalePayment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "citypalaza_database"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SalePayment_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "citypalaza_database"."Sale"
  ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "Sale_idempotencyKey_key" ON "citypalaza_database"."Sale"("idempotencyKey");

CREATE TABLE "citypalaza_database"."AuthRateLimit" (
  "key" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "windowEndsAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthRateLimit_pkey" PRIMARY KEY ("key"),
  CONSTRAINT "AuthRateLimit_attempts_non_negative" CHECK ("attempts" >= 0)
);
CREATE INDEX "AuthRateLimit_windowEndsAt_idx" ON "citypalaza_database"."AuthRateLimit"("windowEndsAt");

DELETE FROM "citypalaza_database"."Session" AS old
USING "citypalaza_database"."Session" AS newer
WHERE old."userId" = newer."userId"
  AND (old."createdAt" < newer."createdAt" OR (old."createdAt" = newer."createdAt" AND old."id" < newer."id"));

DROP INDEX IF EXISTS "citypalaza_database"."Session_userId_idx";
CREATE UNIQUE INDEX "Session_userId_key" ON "citypalaza_database"."Session"("userId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_quantity_non_negative') THEN
    ALTER TABLE "citypalaza_database"."Product" ADD CONSTRAINT "product_quantity_non_negative" CHECK ("quantity" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_prices_non_negative') THEN
    ALTER TABLE "citypalaza_database"."Product" ADD CONSTRAINT "product_prices_non_negative" CHECK ("purchasePrice" >= 0 AND "sellingPrice" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'saleitem_quantity_positive') THEN
    ALTER TABLE "citypalaza_database"."SaleItem" ADD CONSTRAINT "saleitem_quantity_positive" CHECK ("quantity" > 0);
  END IF;
END $$;
