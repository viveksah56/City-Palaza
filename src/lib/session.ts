import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/constants";
import { verifyAccessToken } from "@/lib/auth/token";
import type { SessionUser } from "@/lib/auth/session";

export type SessionClaims = SessionUser & { sessionId: string; expiresAt: Date };

export const getSessionClaims = cache(async (): Promise<SessionClaims | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifyAccessToken(token);
  if (!claims || claims.expiresAt.getTime() <= Date.now()) return null;
  return {
    id: claims.userId,
    firstName: claims.firstName,
    lastName: claims.lastName,
    email: claims.email,
    role: claims.role,
    sessionId: claims.sessionId,
    expiresAt: claims.expiresAt,
  };
});
