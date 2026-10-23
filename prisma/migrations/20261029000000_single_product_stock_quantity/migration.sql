UPDATE "citypalaza_database"."Product"
SET "maxDiscountPercent" = "discountPercent";

ALTER TABLE "citypalaza_database"."Product"
  DROP COLUMN "minStock",
  DROP COLUMN "maxStock",
  DROP COLUMN "discountPercent";
