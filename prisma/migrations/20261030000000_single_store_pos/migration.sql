-- Single-store mobile shop POS: remove PAN/VAT, add IMEI 2, warranties, cash shifts, cash tender.

-- ---------- Remove PAN / VAT ----------
-- Legacy sales that carried VAT keep the amount the customer actually paid in "total"/"amountPaid".
-- Leave an explanatory note on them before the tax columns are dropped.
UPDATE "citypalaza_database"."Sale"
SET "notes" = TRIM(BOTH E'\n' FROM COALESCE("notes", '') || E'\nLegacy sale: total includes VAT of ' || "tax"::text || ' (VAT tracking removed).')
WHERE "tax" > 0;

ALTER TABLE "citypalaza_database"."Sale" DROP COLUMN "tax", DROP COLUMN "taxRate";
ALTER TABLE "citypalaza_database"."SaleItem" DROP COLUMN "tax";
DELETE FROM "citypalaza_database"."Setting" WHERE "key" IN ('taxRate', 'panNumber');

-- ---------- Payment methods ----------
ALTER TYPE "citypalaza_database"."PaymentMethod" ADD VALUE IF NOT EXISTS 'UPI' BEFORE 'OTHER';

-- ---------- Enums ----------
CREATE TYPE "citypalaza_database"."WarrantyStatus" AS ENUM ('ACTIVE', 'CLAIMED', 'VOIDED');
CREATE TYPE "citypalaza_database"."ShiftStatus" AS ENUM ('OPEN', 'CLOSED');

-- ---------- Product: handset attributes ----------
ALTER TABLE "citypalaza_database"."Product"
  ADD COLUMN "model" TEXT,
  ADD COLUMN "ram" TEXT,
  ADD COLUMN "storage" TEXT,
  ADD COLUMN "color" TEXT,
  ADD COLUMN "warrantyMonths" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "citypalaza_database"."Product"
  ADD CONSTRAINT "product_warranty_months_range" CHECK ("warrantyMonths" >= 0 AND "warrantyMonths" <= 120);
CREATE INDEX "Product_model_idx" ON "citypalaza_database"."Product"("model");

-- ---------- IMEI 2 ----------
ALTER TABLE "citypalaza_database"."ProductSerial" ADD COLUMN "imei2" TEXT;
CREATE UNIQUE INDEX "ProductSerial_imei2_key" ON "citypalaza_database"."ProductSerial"("imei2");
ALTER TABLE "citypalaza_database"."SaleItem" ADD COLUMN "imei2Snapshot" TEXT[] DEFAULT ARRAY[]::TEXT[];
-- keep both snapshot arrays aligned for legacy rows
UPDATE "citypalaza_database"."SaleItem"
SET "imei2Snapshot" = ARRAY(SELECT '' FROM generate_series(1, COALESCE(array_length("serialSnapshot", 1), 0)));

-- ---------- Customers ----------
ALTER TABLE "citypalaza_database"."Customer" ADD COLUMN "notes" TEXT;

-- ---------- Cash register ----------
CREATE TABLE "citypalaza_database"."CashShift" (
  "id" TEXT NOT NULL,
  "status" "citypalaza_database"."ShiftStatus" NOT NULL DEFAULT 'OPEN',
  "openedById" TEXT NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "openingBalance" DECIMAL(12,2) NOT NULL,
  "closedById" TEXT,
  "closedAt" TIMESTAMP(3),
  "cashSales" DECIMAL(12,2),
  "expectedCash" DECIMAL(12,2),
  "countedCash" DECIMAL(12,2),
  "variance" DECIMAL(12,2),
  "notes" TEXT,
  CONSTRAINT "CashShift_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CashShift_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "citypalaza_database"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CashShift_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "citypalaza_database"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "cashshift_balances_non_negative" CHECK ("openingBalance" >= 0 AND ("countedCash" IS NULL OR "countedCash" >= 0))
);
CREATE INDEX "CashShift_status_idx" ON "citypalaza_database"."CashShift"("status");
CREATE INDEX "CashShift_openedAt_idx" ON "citypalaza_database"."CashShift"("openedAt");
-- single till: only one shift can be open at any time
CREATE UNIQUE INDEX "cashshift_single_open" ON "citypalaza_database"."CashShift"("status") WHERE "status" = 'OPEN';

ALTER TABLE "citypalaza_database"."Sale"
  ADD COLUMN "amountTendered" DECIMAL(12,2),
  ADD COLUMN "changeGiven" DECIMAL(12,2),
  ADD COLUMN "shiftId" TEXT;
ALTER TABLE "citypalaza_database"."Sale"
  ADD CONSTRAINT "Sale_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "citypalaza_database"."CashShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Sale_shiftId_idx" ON "citypalaza_database"."Sale"("shiftId");

-- ---------- Warranty ----------
CREATE TABLE "citypalaza_database"."Warranty" (
  "id" TEXT NOT NULL,
  "tag" TEXT NOT NULL,
  "saleItemId" TEXT NOT NULL,
  "serialId" TEXT,
  "customerId" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "terms" TEXT,
  "status" "citypalaza_database"."WarrantyStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Warranty_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Warranty_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "citypalaza_database"."SaleItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Warranty_serialId_fkey" FOREIGN KEY ("serialId") REFERENCES "citypalaza_database"."ProductSerial"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Warranty_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "citypalaza_database"."Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Warranty_tag_key" ON "citypalaza_database"."Warranty"("tag");
CREATE INDEX "Warranty_saleItemId_idx" ON "citypalaza_database"."Warranty"("saleItemId");
CREATE INDEX "Warranty_customerId_idx" ON "citypalaza_database"."Warranty"("customerId");
CREATE INDEX "Warranty_serialId_idx" ON "citypalaza_database"."Warranty"("serialId");
CREATE INDEX "Warranty_endsAt_idx" ON "citypalaza_database"."Warranty"("endsAt");
