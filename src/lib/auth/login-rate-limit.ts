import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 8;
const fallbackAttempts = new Map<string, { attempts: number; windowEndsAt: number }>();

function limiterKey(email: string, ip: string | null | undefined) {
  return createHash("sha256").update(`${email.trim().toLowerCase()}|${ip ?? "unknown"}`).digest("hex");
}

function missingRateLimitTable(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const value = error as { code?: unknown; meta?: { code?: unknown } };
  return value.code === "P2021" || (value.code === "P2010" && value.meta?.code === "42P01");
}

function pruneFallback(now: number) {
  for (const [key, entry] of fallbackAttempts) if (entry.windowEndsAt <= now) fallbackAttempts.delete(key);
}

export async function isLoginLimited(email: string, ip?: string | null): Promise<boolean> {
  const key = limiterKey(email, ip);
  try {
    const entry = await prisma.authRateLimit.findUnique({ where: { key }, select: { attempts: true, windowEndsAt: true } });
    return !!entry && entry.windowEndsAt > new Date() && entry.attempts >= MAX_ATTEMPTS;
  } catch (error) {
    if (!missingRateLimitTable(error)) throw error;
    const now = Date.now();
    pruneFallback(now);
    return (fallbackAttempts.get(key)?.attempts ?? 0) >= MAX_ATTEMPTS;
  }
}

export async function recordLoginFailure(email: string, ip?: string | null): Promise<void> {
  const key = limiterKey(email, ip);
  const now = new Date();
  const until = new Date(now.getTime() + WINDOW_MS);
  try {
    await prisma.$executeRaw`
      INSERT INTO "citypalaza_database"."AuthRateLimit" ("key", "attempts", "windowEndsAt", "updatedAt")
      VALUES (${key}, 1, ${until}, ${now})
      ON CONFLICT ("key") DO UPDATE SET
        "attempts" = CASE WHEN "AuthRateLimit"."windowEndsAt" <= ${now} THEN 1 ELSE "AuthRateLimit"."attempts" + 1 END,
        "windowEndsAt" = CASE WHEN "AuthRateLimit"."windowEndsAt" <= ${now} THEN ${until} ELSE "AuthRateLimit"."windowEndsAt" END,
        "updatedAt" = ${now}`;
  } catch (error) {
    if (!missingRateLimitTable(error)) throw error;
    const current = fallbackAttempts.get(key);
    fallbackAttempts.set(key, current && current.windowEndsAt > now.getTime()
      ? { attempts: current.attempts + 1, windowEndsAt: current.windowEndsAt }
      : { attempts: 1, windowEndsAt: until.getTime() });
  }
}

export async function clearLoginFailures(email: string, ip?: string | null): Promise<void> {
  const key = limiterKey(email, ip);
  fallbackAttempts.delete(key);
  try {
    await prisma.authRateLimit.deleteMany({ where: { key } });
  } catch (error) {
    if (!missingRateLimitTable(error)) throw error;
  }
}
