ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "refreshTokenId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Session_refreshTokenId_key" ON "Session"("refreshTokenId");
