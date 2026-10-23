ALTER TABLE "citypalaza_database"."User" ADD COLUMN "slug" TEXT;
ALTER TABLE "citypalaza_database"."Product" ADD COLUMN "slug" TEXT;
ALTER TABLE "citypalaza_database"."Customer" ADD COLUMN "slug" TEXT;
ALTER TABLE "citypalaza_database"."Sale" ADD COLUMN "slug" TEXT;

WITH bases AS (
  SELECT "id", COALESCE(NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER("firstName" || '-' || "lastName"), '[^a-z0-9]+', '-', 'g')), ''), 'employee') AS base FROM "citypalaza_database"."User"
), numbered AS (
  SELECT "id", base, ROW_NUMBER() OVER (PARTITION BY base ORDER BY "id") AS position FROM bases
)
UPDATE "citypalaza_database"."User" AS target
SET "slug" = numbered.base || CASE WHEN numbered.position = 1 THEN '' ELSE '-' || numbered.position::text END
FROM numbered WHERE target."id" = numbered."id";

WITH bases AS (
  SELECT "id", COALESCE(NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER("name" || COALESCE('-' || NULLIF("variantLabel", ''), '')), '[^a-z0-9]+', '-', 'g')), ''), 'product') AS base FROM "citypalaza_database"."Product"
), numbered AS (
  SELECT "id", base, ROW_NUMBER() OVER (PARTITION BY base ORDER BY "id") AS position FROM bases
)
UPDATE "citypalaza_database"."Product" AS target
SET "slug" = numbered.base || CASE WHEN numbered.position = 1 THEN '' ELSE '-' || numbered.position::text END
FROM numbered WHERE target."id" = numbered."id";

WITH bases AS (
  SELECT "id", COALESCE(NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER("name"), '[^a-z0-9]+', '-', 'g')), ''), 'customer') AS base FROM "citypalaza_database"."Customer"
), numbered AS (
  SELECT "id", base, ROW_NUMBER() OVER (PARTITION BY base ORDER BY "id") AS position FROM bases
)
UPDATE "citypalaza_database"."Customer" AS target
SET "slug" = numbered.base || CASE WHEN numbered.position = 1 THEN '' ELSE '-' || numbered.position::text END
FROM numbered WHERE target."id" = numbered."id";

UPDATE "citypalaza_database"."Sale"
SET "slug" = LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE("saleNumber", '[^a-zA-Z0-9]+', '-', 'g')));

ALTER TABLE "citypalaza_database"."User" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "citypalaza_database"."Product" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "citypalaza_database"."Customer" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "citypalaza_database"."Sale" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "User_slug_key" ON "citypalaza_database"."User"("slug");
CREATE UNIQUE INDEX "Product_slug_key" ON "citypalaza_database"."Product"("slug");
CREATE UNIQUE INDEX "Customer_slug_key" ON "citypalaza_database"."Customer"("slug");
CREATE UNIQUE INDEX "Sale_slug_key" ON "citypalaza_database"."Sale"("slug");

UPDATE "citypalaza_database"."Setting"
SET "value" = to_jsonb('CityPlaza'::text)
WHERE "key" = 'shopName' AND "value" = to_jsonb('CityPalaza'::text);
