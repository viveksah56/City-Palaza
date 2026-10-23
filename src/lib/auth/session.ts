import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { ACCESS_TOKEN_TTL_MINUTES, REFRESH_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE_HOURS } from "@/lib/constants";
import type { Role } from "@/lib/constants/roles";
import { randomUUID } from "node:crypto";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, type AccessTokenSubject } from "./token";

export type SessionUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  /** Hard end of the login (the refresh token can't outlive it). Present when loaded from the database. */
  sessionExpiresAt?: Date;
};

export const authCookieOptions = (expires: Date) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires,
});

type CookieJar = Awaited<ReturnType<typeof cookies>>;

export function clearAuthCookies(jar: CookieJar): void {
  jar.delete(SESSION_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function createSession(subject: AccessTokenSubject, meta: { ip?: string | null; userAgent?: string | null }) {
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_MAX_AGE_HOURS * 60 * 60_000);
  const accessExpiresAt = new Date(now + ACCESS_TOKEN_TTL_MINUTES * 60_000);
  const refreshTokenId = randomUUID();
  const session = await prisma.$transaction(async (tx) => {
    // pg_advisory_xact_lock returns Postgres `void`, which Prisma 7's pg adapter cannot deserialize,
    // so it must run through $executeRaw (never $queryRaw). Serialises concurrent logins per user.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${subject.userId}))`;
    await tx.session.deleteMany({ where: { userId: subject.userId } });
    return tx.session.create({
      data: { userId: subject.userId, expiresAt, refreshTokenId, ipAddress: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 255) ?? null },
    });
  });
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(subject, session.id, accessExpiresAt),
    signRefreshToken(session.id, refreshTokenId, expiresAt),
  ]);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, accessToken, authCookieOptions(accessExpiresAt));
  jar.set(REFRESH_COOKIE, refreshToken, authCookieOptions(expiresAt));
}

/** Resolves the logged-in user for this request (deduplicated per request). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const verified = await verifyAccessToken(token);
  if (!verified) return null;
  const session = await prisma.session.findUnique({
    where: { id: verified.sessionId },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true } } },
  });
  if (!session || session.expiresAt < new Date() || session.user.status !== "ACTIVE") return null;
  const { status: _status, ...user } = session.user;
  return { ...user, sessionExpiresAt: session.expiresAt };
});

/**
 * Revokes the server-side session (best effort) and ALWAYS clears both cookies, so a database hiccup
 * can never leave the browser looking signed in. Returns whether the database row was revoked.
 */
export async function destroySession(): Promise<{ revoked: boolean }> {
  const jar = await cookies();
  const access = jar.get(SESSION_COOKIE)?.value;
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  let revoked = true;
  try {
    const [accessToken, refreshToken] = await Promise.all([
      access ? verifyAccessToken(access) : null,
      refresh ? verifyRefreshToken(refresh) : null,
    ]);
    const sessionId = accessToken?.sessionId ?? refreshToken?.sessionId;
    if (sessionId) await prisma.session.deleteMany({ where: { id: sessionId } });
  } catch (error) {
    revoked = false;
    console.error("[session revoke failure]", error);
  }
  clearAuthCookies(jar);
  return { revoked };
}
