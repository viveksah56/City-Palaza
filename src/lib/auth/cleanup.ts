import "server-only";
import { prisma } from "@/lib/db";
import { pruneRateLimits } from "@/lib/rate-limit";

const MIN_INTERVAL_MS = 10 * 60_000;
let lastRun = 0;

/**
 * Deletes expired sessions, spent/expired password-reset tokens and stale rate-limit rows.
 * Throttled per server instance, so it is cheap to call opportunistically (e.g. after a login).
 */
export async function pruneExpiredAuthData(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastRun < MIN_INTERVAL_MS) return;
  lastRun = now;
  const at = new Date(now);
  await Promise.all([
    prisma.session.deleteMany({ where: { expiresAt: { lt: at } } }),
    prisma.passwordResetToken.deleteMany({ where: { OR: [{ expiresAt: { lt: at } }, { usedAt: { not: null } }] } }),
    pruneRateLimits(),
  ]);
}
