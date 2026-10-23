import "server-only";
import { createHash } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const RATE_LIMIT_COOLDOWN_SECONDS = 300;

export class RateLimitExceededError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Too many requests.");
    this.name = "RateLimitExceededError";
  }
}

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export function rateLimitKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function consumeRateLimit(
  bucket: string,
  options: { limit: number; windowSeconds: number; cooldownSeconds?: number },
): Promise<RateLimitResult> {
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
        WHEN "AuthRateLimit"."attempts" + 1 > ${options.limit} THEN ${cooldownEndsAt}
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

export function requestRateLimitIdentity(request: Request): string {
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return ip.slice(0, 128);
}

export async function rateLimitResponse(
  request: Request,
  bucket: string,
  options: { limit: number; windowSeconds: number; message?: string },
): Promise<NextResponse | null> {
  try {
    const result = await consumeRateLimit(`${bucket}:${requestRateLimitIdentity(request)}`, options);
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
