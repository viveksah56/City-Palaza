BEGIN;

DO $$
DECLARE
  target_tables integer;
  target_types integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'citypalaza_database') THEN
    RAISE EXCEPTION 'Required schema citypalaza_database does not exist';
  END IF;

  SELECT count(*) INTO target_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'citypalaza_database' AND c.relkind IN ('r', 'p');

  SELECT count(*) INTO target_types
  FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = 'citypalaza_database' AND t.typtype = 'e';

  IF target_tables <> 0 OR target_types <> 0 THEN
    RAISE EXCEPTION 'Schema citypalaza_database must be empty before moving application objects (tables %, enums %)', target_tables, target_types;
  END IF;
END $$;

ALTER TYPE public."UserRole" SET SCHEMA citypalaza_database;
ALTER TYPE public."UserStatus" SET SCHEMA citypalaza_database;
ALTER TYPE public."TrackingType" SET SCHEMA citypalaza_database;
ALTER TYPE public."ProductStatus" SET SCHEMA citypalaza_database;
ALTER TYPE public."SerialStatus" SET SCHEMA citypalaza_database;
ALTER TYPE public."InventoryTransactionType" SET SCHEMA citypalaza_database;
ALTER TYPE public."PaymentMethod" SET SCHEMA citypalaza_database;
ALTER TYPE public."PaymentStatus" SET SCHEMA citypalaza_database;
ALTER TYPE public."SaleStatus" SET SCHEMA citypalaza_database;
ALTER TYPE public."DiscountType" SET SCHEMA citypalaza_database;

ALTER TABLE public."Role" SET SCHEMA citypalaza_database;
ALTER TABLE public."Permission" SET SCHEMA citypalaza_database;
ALTER TABLE public."RolePermission" SET SCHEMA citypalaza_database;
ALTER TABLE public."User" SET SCHEMA citypalaza_database;
ALTER TABLE public."Session" SET SCHEMA citypalaza_database;
ALTER TABLE public."PasswordResetToken" SET SCHEMA citypalaza_database;
ALTER TABLE public."Category" SET SCHEMA citypalaza_database;
ALTER TABLE public."Brand" SET SCHEMA citypalaza_database;
ALTER TABLE public."Product" SET SCHEMA citypalaza_database;
ALTER TABLE public."ProductSerial" SET SCHEMA citypalaza_database;
ALTER TABLE public."InventoryTransaction" SET SCHEMA citypalaza_database;
ALTER TABLE public."Customer" SET SCHEMA citypalaza_database;
ALTER TABLE public."Sale" SET SCHEMA citypalaza_database;
ALTER TABLE public."SaleItem" SET SCHEMA citypalaza_database;
ALTER TABLE public."AuditLog" SET SCHEMA citypalaza_database;
ALTER TABLE public."Setting" SET SCHEMA citypalaza_database;
ALTER TABLE public."Counter" SET SCHEMA citypalaza_database;
ALTER TABLE public."_prisma_migrations" SET SCHEMA citypalaza_database;

COMMIT;
