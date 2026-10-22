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
};

const cookieOptions = (expires: Date) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires,
});

export async function createSession(subject: AccessTokenSubject, meta: { ip?: string | null; userAgent?: string | null }) {
  const now = Date.now();
  const expiresAt = new Date(now + SESSION_MAX_AGE_HOURS * 60 * 60_000);
  const accessExpiresAt = new Date(now + ACCESS_TOKEN_TTL_MINUTES * 60_000);
  const refreshTokenId = randomUUID();
  const session = await prisma.session.create({
    data: { userId: subject.userId, expiresAt, refreshTokenId, ipAddress: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 255) ?? null },
  });
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(subject, session.id, accessExpiresAt),
    signRefreshToken(session.id, refreshTokenId, expiresAt),
  ]);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, accessToken, cookieOptions(accessExpiresAt));
  jar.set(REFRESH_COOKIE, refreshToken, cookieOptions(expiresAt));
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
  return user;
});

export async function destroySession() {
  const jar = await cookies();
  const access = jar.get(SESSION_COOKIE)?.value;
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  const [accessToken, refreshToken] = await Promise.all([
    access ? verifyAccessToken(access) : null,
    refresh ? verifyRefreshToken(refresh) : null,
  ]);
  const sessionId = accessToken?.sessionId ?? refreshToken?.sessionId;
  if (sessionId) await prisma.session.deleteMany({ where: { id: sessionId } });
  jar.delete(SESSION_COOKIE);
  jar.delete(REFRESH_COOKIE);
}
