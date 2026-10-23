import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { ACCESS_TOKEN_TTL_MINUTES, REFRESH_COOKIE, REFRESH_REUSE_GRACE_SECONDS, SESSION_COOKIE } from "@/lib/constants";
import { safeInternalRedirect } from "@/lib/auth/redirects";
import { authCookieOptions, clearAuthCookies } from "@/lib/auth/session";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/lib/auth/token";
import { rejectCrossOrigin } from "@/lib/auth/origin";
import { rateLimitResponse } from "@/lib/rate-limit";

/**
 * REFRESHED   new cookies issued
 * INVALID     unknown / expired / disabled session -> sign out
 * CONCURRENT  another request rotated the token a moment ago -> client should retry with the new cookie
 * REUSED      a rotated-out token came back after the grace window: treat as replay, revoke the session
 */
type RefreshResult = "REFRESHED" | "INVALID" | "CONCURRENT" | "REUSED";

const REFRESH_LIMIT = { limit: 40, windowSeconds: 300 } as const;

/** Rate-limit per session (not per IP) so a whole shop behind one router doesn't share one budget. */
async function refreshRateLimit(request: Request): Promise<NextResponse | null> {
  const token = (await cookies()).get(REFRESH_COOKIE)?.value;
  const verified = token ? await verifyRefreshToken(token) : null;
  return rateLimitResponse(request, "auth:refresh", verified ? { ...REFRESH_LIMIT, identity: verified.sessionId } : { ...REFRESH_LIMIT, scope: "ip" });
}

async function rotateRefreshToken(): Promise<RefreshResult> {
  const jar = await cookies();
  const token = jar.get(REFRESH_COOKIE)?.value;
  const verified = token ? await verifyRefreshToken(token) : null;
  if (!verified) return "INVALID";

  const now = new Date();
  const session = await prisma.session.findUnique({
    where: { id: verified.sessionId },
    select: {
      id: true,
      refreshTokenId: true,
      refreshRotatedAt: true,
      expiresAt: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true } },
    },
  });
  if (!session || session.expiresAt <= now || session.user.status !== "ACTIVE") return "INVALID";

  if (session.refreshTokenId !== verified.tokenId) {
    // A validly signed token for this session that is no longer the current one.
    const rotatedAgoMs = session.refreshRotatedAt ? now.getTime() - session.refreshRotatedAt.getTime() : Number.POSITIVE_INFINITY;
    if (rotatedAgoMs <= REFRESH_REUSE_GRACE_SECONDS * 1000) return "CONCURRENT"; // two tabs raced; benign
    console.warn(`[session security] stale refresh token replayed for session ${session.id}; revoking session`);
    await prisma.session.deleteMany({ where: { id: session.id } });
    return "REUSED";
  }

  const accessExpiresAt = new Date(Math.min(Date.now() + ACCESS_TOKEN_TTL_MINUTES * 60_000, session.expiresAt.getTime()));
  const refreshExpiresAt = session.expiresAt;
  const refreshTokenId = randomUUID();
  const updated = await prisma.session.updateMany({
    where: { id: session.id, refreshTokenId: verified.tokenId, expiresAt: { gt: now } },
    data: { refreshTokenId, previousRefreshTokenId: verified.tokenId, refreshRotatedAt: now },
  });
  if (updated.count !== 1) return "CONCURRENT";

  const subject = { userId: session.user.id, firstName: session.user.firstName, lastName: session.user.lastName, email: session.user.email, role: session.user.role };
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(subject, session.id, accessExpiresAt),
    signRefreshToken(session.id, refreshTokenId, refreshExpiresAt),
  ]);
  jar.set(SESSION_COOKIE, accessToken, authCookieOptions(accessExpiresAt));
  jar.set(REFRESH_COOKIE, refreshToken, authCookieOptions(refreshExpiresAt));
  return "REFRESHED";
}

async function clearSessionCookies(): Promise<void> {
  clearAuthCookies(await cookies());
}

function refreshUnavailable(): NextResponse {
  return NextResponse.json(
    { error: "Your sign-in session could not be renewed right now. Please try again shortly." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limited = await refreshRateLimit(request);
  if (limited) return limited;
  let result: RefreshResult;
  try {
    result = await rotateRefreshToken();
  } catch (error) {
    console.error("[session refresh failure]", error);
    return refreshUnavailable();
  }
  const next = safeInternalRedirect(request.nextUrl.searchParams.get("next"));
  if (result === "INVALID" || result === "REUSED") {
    await clearSessionCookies();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", next);
    loginUrl.searchParams.set("reason", result === "REUSED" ? "security" : "expired");
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.redirect(new URL(next, request.url));
}

export async function POST(request: Request): Promise<NextResponse> {
  const crossSite = rejectCrossOrigin(request);
  if (crossSite) return crossSite;
  const limited = await refreshRateLimit(request);
  if (limited) return limited;
  let result: RefreshResult;
  try {
    result = await rotateRefreshToken();
  } catch (error) {
    console.error("[session refresh failure]", error);
    return refreshUnavailable();
  }
  if (result === "INVALID" || result === "REUSED") {
    await clearSessionCookies();
    return NextResponse.json(
      { error: "UNAUTHENTICATED", message: result === "REUSED" ? "Your session was ended for security reasons. Please sign in again." : "Your session has expired. Please sign in again." },
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
