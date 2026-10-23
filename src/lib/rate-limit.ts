import "server-only";
import { createHash } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { clientIpFromHeaders } from "@/lib/client-ip";
import { getSessionClaims } from "@/lib/session";

export const RATE_LIMIT_COOLDOWN_SECONDS = 300;

export class RateLimitExceededError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Too many requests.");
    this.name = "RateLimitExceededError";
  }
}

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };
export type RateLimitOptions = { limit: number; windowSeconds: number; cooldownSeconds?: number };

export function rateLimitKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Counts one attempt against `bucket` (atomic upsert, safe under concurrency).
 * Once the limit is exceeded the block lasts until the later of the window end and the cooldown.
 */
export async function consumeRateLimit(bucket: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const now = new Date();
  const windowEndsAt = new Date(now.getTime() + options.windowSeconds * 1000);
  const cooldownEndsAt = new Date(now.getTime() + (options.cooldownSeconds ?? RATE_LIMIT_COOLDOWN_SECONDS) * 1000);
  const key = rateLimitKey(bucket);
  const [entry] = await prisma.$queryRaw<Array<{ attempts: number; windowEndsAt: Date }>>`
    INSERT INTO "citypalaza_database"."AuthRateLimit" ("key", "attempts", "windowEndsAt", "updatedAt")
    VALUES (${key}, 1, ${windowEndsAt}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "attempts" = CASE
        WHEN "AuthRateLimit"."windowEndsAt" <= ${now} THEN 1
        ELSE "AuthRateLimit"."attempts" + 1
      END,
      "windowEndsAt" = CASE
        WHEN "AuthRateLimit"."windowEndsAt" <= ${now} THEN ${windowEndsAt}
        WHEN "AuthRateLimit"."attempts" >= ${options.limit} THEN "AuthRateLimit"."windowEndsAt"
        WHEN "AuthRateLimit"."attempts" + 1 > ${options.limit} THEN GREATEST("AuthRateLimit"."windowEndsAt", ${cooldownEndsAt})
        ELSE "AuthRateLimit"."windowEndsAt"
      END,
      "updatedAt" = ${now}
    RETURNING "attempts", "windowEndsAt"
  `;

  if (!entry) throw new Error("Rate-limit storage returned no result.");
  const allowed = entry.attempts <= options.limit;
  return {
    allowed,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((entry.windowEndsAt.getTime() - Date.now()) / 1000)),
  };
}

/** Forgets a bucket entirely, e.g. after a successful login. */
export async function resetRateLimit(bucket: string): Promise<void> {
  await prisma.$executeRaw`DELETE FROM "citypalaza_database"."AuthRateLimit" WHERE "key" = ${rateLimitKey(bucket)}`;
}

/** Gives back one attempt so only *failed* requests count against a shared bucket (e.g. one shop Wi-Fi IP). */
export async function refundRateLimit(bucket: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "citypalaza_database"."AuthRateLimit"
    SET "attempts" = GREATEST("attempts" - 1, 0)
    WHERE "key" = ${rateLimitKey(bucket)} AND "windowEndsAt" > ${new Date()}
  `;
}

/** Removes rate-limit rows whose window ended more than an hour ago. */
export async function pruneRateLimits(): Promise<number> {
  return prisma.$executeRaw`DELETE FROM "citypalaza_database"."AuthRateLimit" WHERE "windowEndsAt" < ${new Date(Date.now() - 3_600_000)}`;
}

export function requestRateLimitIdentity(request: Request): string {
  return (clientIpFromHeaders(request.headers) ?? "unknown").slice(0, 128);
}

export type RateLimitResponseOptions = RateLimitOptions & {
  message?: string;
  /**
   * "auto" (default): key by signed-in user when there is a valid session, otherwise by IP, so several
   * staff behind one shop router don't share a single budget. "ip": always key by IP (public auth routes).
   */
  scope?: "auto" | "ip";
  /** Explicit identity (e.g. a session id); takes precedence over `scope`. */
  identity?: string;
};

async function resolveIdentity(request: Request, options: RateLimitResponseOptions): Promise<string> {
  if (options.identity) return `id:${options.identity}`;
  if (options.scope !== "ip") {
    try {
      const claims = await getSessionClaims();
      if (claims) return `user:${claims.id}`;
    } catch (error) {
      unstable_rethrow(error);
    }
  }
  return `ip:${requestRateLimitIdentity(request)}`;
}

export async function rateLimitResponse(
  request: Request,
  bucket: string,
  options: RateLimitResponseOptions,
): Promise<NextResponse | null> {
  try {
    const identity = await resolveIdentity(request, options);
    const result = await consumeRateLimit(`${bucket}:${identity}`, options);
    if (result.allowed) return null;
    return NextResponse.json(
      { error: options.message ?? "Too many requests. Please wait before trying again.", retryAfterSeconds: result.retryAfterSeconds },
      { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds), "Cache-Control": "no-store" } },
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error(`[rate limit storage failure: ${bucket}]`, error);
    return NextResponse.json(
      { error: "This service is temporarily unavailable. Please try again shortly." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
