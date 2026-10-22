import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { ACCESS_TOKEN_TTL_MINUTES, REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/constants";
import { safeInternalRedirect } from "@/lib/auth/redirects";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/auth/token";

const cookieOptions = (expires: Date) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires,
});

async function rotateRefreshToken(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(REFRESH_COOKIE)?.value;
  const verified = token ? await verifyRefreshToken(token) : null;
  if (!verified) return false;

  const now = new Date();
  const session = await prisma.session.findUnique({
    where: { id: verified.sessionId },
    select: { id: true, refreshTokenId: true, expiresAt: true, user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true } } },
  });
  if (!session || session.refreshTokenId !== verified.tokenId || session.expiresAt <= now || session.user.status !== "ACTIVE") return false;

  const accessExpiresAt = new Date(Math.min(Date.now() + ACCESS_TOKEN_TTL_MINUTES * 60_000, session.expiresAt.getTime()));
  const refreshExpiresAt = session.expiresAt;
  const refreshTokenId = randomUUID();
  const updated = await prisma.session.updateMany({
    where: { id: session.id, refreshTokenId: verified.tokenId, expiresAt: { gt: now } },
    data: { refreshTokenId },
  });
  if (updated.count !== 1) return false;

  const subject = { userId: session.user.id, firstName: session.user.firstName, lastName: session.user.lastName, email: session.user.email, role: session.user.role };
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(subject, session.id, accessExpiresAt),
    signRefreshToken(session.id, refreshTokenId, refreshExpiresAt),
  ]);
  jar.set(SESSION_COOKIE, accessToken, cookieOptions(accessExpiresAt));
  jar.set(REFRESH_COOKIE, refreshToken, cookieOptions(refreshExpiresAt));
  return true;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!(await rotateRefreshToken())) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(SESSION_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }
  const next = safeInternalRedirect(request.nextUrl.searchParams.get("next"));
  return NextResponse.redirect(new URL(next, request.url));
}

export async function POST(): Promise<NextResponse> {
  if (!(await rotateRefreshToken())) {
    const response = NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
    response.cookies.delete(SESSION_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }
  return NextResponse.json({ ok: true });
}
