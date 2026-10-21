ALTER TABLE citypalaza_database."Product"
ADD CONSTRAINT product_quantity_non_negative CHECK ("quantity" >= 0);

ALTER TABLE citypalaza_database."Product"
ADD CONSTRAINT product_prices_non_negative CHECK ("purchasePrice" >= 0 AND "sellingPrice" >= 0);

ALTER TABLE citypalaza_database."SaleItem"
ADD CONSTRAINT saleitem_quantity_positive CHECK ("quantity" > 0);
