import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ACCESS_TOKEN_TTL_MINUTES, REFRESH_COOKIE, REFRESH_TOKEN_TTL_DAYS, SESSION_COOKIE } from "@/lib/constants";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "@/lib/auth/token";

const cookieOptions = (expires: Date) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires,
});

function unauthenticated(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "UNAUTHENTICATED", message: "Your session has expired. Please sign in again." }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login);
}

export async function proxy(request: NextRequest) {
  const access = request.cookies.get(SESSION_COOKIE)?.value;
  if (access) {
    const token = await verifyAccessToken(access);
    if (token && token.expiresAt.getTime() > Date.now() + 30_000) return NextResponse.next();
  }

  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const refreshToken = refresh ? await verifyRefreshToken(refresh) : null;
  if (!refreshToken) return unauthenticated(request);

  const session = await prisma.session.findUnique({
    where: { id: refreshToken.sessionId },
    select: { id: true, refreshTokenId: true, expiresAt: true, user: { select: { status: true } } },
  });
  const now = new Date();
  if (!session || session.refreshTokenId !== refreshToken.tokenId || session.expiresAt <= now || session.user.status !== "ACTIVE") {
    return unauthenticated(request);
  }

  const accessExpiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MINUTES * 60_000);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60_000);
  const refreshTokenId = randomUUID();
  const updated = await prisma.session.updateMany({
    where: { id: session.id, refreshTokenId: refreshToken.tokenId, expiresAt: { gt: now } },
    data: { refreshTokenId, expiresAt: refreshExpiresAt },
  });
  if (updated.count !== 1) return unauthenticated(request);

  const [nextAccess, nextRefresh] = await Promise.all([
    signAccessToken(session.id, accessExpiresAt),
    signRefreshToken(session.id, refreshTokenId, refreshExpiresAt),
  ]);
  request.cookies.set(SESSION_COOKIE, nextAccess);
  request.cookies.set(REFRESH_COOKIE, nextRefresh);
  const headers = new Headers(request.headers);
  headers.set("cookie", request.cookies.toString());
  const response = NextResponse.next({ request: { headers } });
  response.cookies.set(SESSION_COOKIE, nextAccess, cookieOptions(accessExpiresAt));
  response.cookies.set(REFRESH_COOKIE, nextRefresh, cookieOptions(refreshExpiresAt));
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/sales/:path*",
    "/products/:path*",
    "/inventory/:path*",
    "/customers/:path*",
    "/employees/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/audit-logs/:path*",
    "/api/:path*",
  ],
};
