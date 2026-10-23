import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { ACCESS_TOKEN_TTL_MINUTES, REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/constants";
import { safeInternalRedirect } from "@/lib/auth/redirects";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/auth/token";
import { rateLimitResponse } from "@/lib/rate-limit";

const cookieOptions = (expires: Date) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  expires,
});

type RefreshResult = "REFRESHED" | "INVALID" | "CONCURRENT";

async function rotateRefreshToken(): Promise<RefreshResult> {
  const jar = await cookies();
  const token = jar.get(REFRESH_COOKIE)?.value;
  const verified = token ? await verifyRefreshToken(token) : null;
  if (!verified) return "INVALID";

  const now = new Date();
  const session = await prisma.session.findUnique({
    where: { id: verified.sessionId },
    select: { id: true, refreshTokenId: true, expiresAt: true, user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true } } },
  });
  if (!session || session.refreshTokenId !== verified.tokenId || session.expiresAt <= now || session.user.status !== "ACTIVE") return "INVALID";

  const accessExpiresAt = new Date(Math.min(Date.now() + ACCESS_TOKEN_TTL_MINUTES * 60_000, session.expiresAt.getTime()));
  const refreshExpiresAt = session.expiresAt;
  const refreshTokenId = randomUUID();
  const updated = await prisma.session.updateMany({
    where: { id: session.id, refreshTokenId: verified.tokenId, expiresAt: { gt: now } },
    data: { refreshTokenId },
  });
  if (updated.count !== 1) return "CONCURRENT";

  const subject = { userId: session.user.id, firstName: session.user.firstName, lastName: session.user.lastName, email: session.user.email, role: session.user.role };
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(subject, session.id, accessExpiresAt),
    signRefreshToken(session.id, refreshTokenId, refreshExpiresAt),
  ]);
  jar.set(SESSION_COOKIE, accessToken, cookieOptions(accessExpiresAt));
  jar.set(REFRESH_COOKIE, refreshToken, cookieOptions(refreshExpiresAt));
  return "REFRESHED";
}

async function clearSessionCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

function refreshUnavailable(): NextResponse {
  return NextResponse.json(
    { error: "Your sign-in session could not be renewed right now. Please try again shortly." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limited = await rateLimitResponse(request, "auth:refresh", { limit: 40, windowSeconds: 300 });
  if (limited) return limited;
  let result: RefreshResult;
  try {
    result = await rotateRefreshToken();
  } catch (error) {
    console.error("[session refresh failure]", error);
    return refreshUnavailable();
  }
  const next = safeInternalRedirect(request.nextUrl.searchParams.get("next"));
  if (result === "INVALID") {
    await clearSessionCookies();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.redirect(new URL(next, request.url));
}

export async function POST(request: Request): Promise<NextResponse> {
  const limited = await rateLimitResponse(request, "auth:refresh", { limit: 40, windowSeconds: 300 });
  if (limited) return limited;
  let result: RefreshResult;
  try {
    result = await rotateRefreshToken();
  } catch (error) {
    console.error("[session refresh failure]", error);
    return refreshUnavailable();
  }
  if (result === "INVALID") {
    await clearSessionCookies();
    return NextResponse.json(
      { error: "UNAUTHENTICATED", message: "Your session has expired. Please sign in again." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (result === "CONCURRENT") {
    return NextResponse.json(
      { error: "SESSION_REFRESH_IN_PROGRESS", message: "Your session is being renewed. Please retry this request." },
      { status: 409, headers: { "Retry-After": "1", "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
