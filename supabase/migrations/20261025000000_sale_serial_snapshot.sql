ALTER TABLE "citypalaza_database"."SaleItem"
  ADD COLUMN "serialSnapshot" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "citypalaza_database"."SaleItem" AS item
SET "serialSnapshot" = COALESCE(
  (
    SELECT ARRAY_AGG(device."serial" ORDER BY device."serial")
    FROM "citypalaza_database"."ProductSerial" AS device
    WHERE device."saleItemId" = item."id"
  ),
  ARRAY[]::TEXT[]
);
