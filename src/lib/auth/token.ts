import { SignJWT, jwtVerify } from "jose";

function key(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set and at least 32 characters long.");
  }
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(sessionId: string, expiresAt: Date): Promise<string> {
  return new SignJWT({ sid: sessionId, typ: "access" })
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
    .sign(key());
}

export async function verifyAccessToken(token: string): Promise<{ sessionId: string; expiresAt: Date } | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.typ !== "access" || typeof payload.sid !== "string" || typeof payload.exp !== "number") return null;
    return { sessionId: payload.sid, expiresAt: new Date(payload.exp * 1000) };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<{ sessionId: string; tokenId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
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
