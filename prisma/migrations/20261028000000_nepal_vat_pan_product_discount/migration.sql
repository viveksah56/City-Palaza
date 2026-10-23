ALTER TABLE "citypalaza_database"."Product"
  ADD COLUMN "maxDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 5.00;

ALTER TABLE "citypalaza_database"."Product"
  ADD CONSTRAINT "product_max_discount_percent_range"
  CHECK ("maxDiscountPercent" >= 0 AND "maxDiscountPercent" <= 100);

INSERT INTO "citypalaza_database"."Setting" ("key", "value", "updatedAt")
VALUES ('taxRate', '13'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO UPDATE
SET "value" = '13'::jsonb, "updatedAt" = CURRENT_TIMESTAMP
WHERE "citypalaza_database"."Setting"."value" = '0'::jsonb;

INSERT INTO "citypalaza_database"."Setting" ("key", "value", "updatedAt")
VALUES ('panNumber', '"612865374"'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
