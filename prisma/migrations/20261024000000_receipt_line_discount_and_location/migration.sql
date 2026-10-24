ALTER TABLE "citypalaza_database"."SaleItem"
  ADD COLUMN "itemDiscount" DECIMAL(12,2);

UPDATE "citypalaza_database"."Setting"
SET "value" = '"Mirchiaya"'::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'address' AND "value" = '"New Road"'::jsonb;

UPDATE "citypalaza_database"."Setting"
SET "value" = '"Sirahah"'::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'city' AND "value" = '"Kathmandu"'::jsonb;

UPDATE "citypalaza_database"."Setting"
SET "value" = '""'::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'phone' AND "value" = '"+977-1-0000000"'::jsonb;

UPDATE "citypalaza_database"."Setting"
SET "value" = '""'::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'email' AND "value" = '"hello@cityplaza.local"'::jsonb;
