ALTER TABLE "citypalaza_database"."Sale"
  ADD COLUMN "promoDiscount" DECIMAL(12,2),
  ADD COLUMN "manualDiscount" DECIMAL(12,2);

ALTER TABLE "citypalaza_database"."SaleItem"
  ADD COLUMN "promoDiscount" DECIMAL(12,2),
  ADD COLUMN "saleDiscount" DECIMAL(12,2);
