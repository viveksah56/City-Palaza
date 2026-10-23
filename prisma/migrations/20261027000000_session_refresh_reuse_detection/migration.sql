ALTER TABLE "citypalaza_database"."Session" ADD COLUMN IF NOT EXISTS "previousRefreshTokenId" TEXT;
ALTER TABLE "citypalaza_database"."Session" ADD COLUMN IF NOT EXISTS "refreshRotatedAt" TIMESTAMP(3);
