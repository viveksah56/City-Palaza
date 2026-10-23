import { SignJWT, jwtVerify } from "jose";
import { ROLE_VALUES, type Role } from "@/lib/constants/roles";

export type AccessTokenClaims = {
  sessionId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  expiresAt: Date;
};

export type AccessTokenSubject = Omit<AccessTokenClaims, "sessionId" | "expiresAt">;

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

function validated(name: string, secret: string | undefined): Uint8Array {
  if (!secret || secret.length < 32 || /replace-with|your-secret|changeme|example/i.test(secret)) {
    throw new AuthConfigurationError(`${name} must be set and at least 32 characters long.`);
  }
  return new TextEncoder().encode(secret);
}

function key(): Uint8Array {
  return validated("AUTH_SECRET", process.env.AUTH_SECRET);
}

/** Refresh tokens use their own secret when AUTH_REFRESH_SECRET is set, so one leaked key can't forge both kinds. */
function refreshKey(): Uint8Array {
  return process.env.AUTH_REFRESH_SECRET ? validated("AUTH_REFRESH_SECRET", process.env.AUTH_REFRESH_SECRET) : key();
}

export async function signAccessToken(subject: AccessTokenSubject, sessionId: string, expiresAt: Date): Promise<string> {
  return new SignJWT({ sid: sessionId, sub: subject.userId, firstName: subject.firstName, lastName: subject.lastName, email: subject.email, role: subject.role, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(key());
}

export async function signRefreshToken(sessionId: string, tokenId: string, expiresAt: Date): Promise<string> {
  return new SignJWT({ sid: sessionId, typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(tokenId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(refreshKey());
}

export async function verifyAccessToken(token: string | null | undefined): Promise<AccessTokenClaims | null> {
  if (!token) return null;
  const secret = key();
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (payload.typ !== "access" || typeof payload.sid !== "string" || typeof payload.sub !== "string" || typeof payload.firstName !== "string" || typeof payload.lastName !== "string" || typeof payload.email !== "string" || typeof payload.role !== "string" || !ROLE_VALUES.some((role) => role === payload.role) || typeof payload.exp !== "number") return null;
    return { sessionId: payload.sid, userId: payload.sub, firstName: payload.firstName, lastName: payload.lastName, email: payload.email, role: payload.role as Role, expiresAt: new Date(payload.exp * 1000) };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string | null | undefined): Promise<{ sessionId: string; tokenId: string } | null> {
  if (!token) return null;
  const secret = refreshKey();
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    if (payload.typ !== "refresh" || typeof payload.sid !== "string" || typeof payload.jti !== "string") return null;
    return { sessionId: payload.sid, tokenId: payload.jti };
  } catch {
    return null;
  }
}

export const signSessionToken = signAccessToken;
export async function verifySessionToken(token: string): Promise<string | null> {
  return (await verifyAccessToken(token))?.sessionId ?? null;
}
