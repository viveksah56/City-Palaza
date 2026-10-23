import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { rejectCrossOrigin } from "@/lib/auth/origin";
import { safeInternalRedirect } from "@/lib/auth/redirects";
import { LOGIN_NOTICES, type LoginNoticeKey } from "@/lib/constants";

function noticeKey(value: string | null): LoginNoticeKey {
  return value !== null && value in LOGIN_NOTICES ? (value as LoginNoticeKey) : "expired";
}

/**
 * Browser navigation target for "your session is gone": revokes what's left server-side, clears both
 * cookies (impossible from a Server Component) and lands on /login with an explanatory notice.
 */
export async function GET(request: Request): Promise<NextResponse> {
  await destroySession();
  const url = new URL(request.url);
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("reason", noticeKey(url.searchParams.get("reason")));
  const next = url.searchParams.get("next");
  if (next) loginUrl.searchParams.set("next", safeInternalRedirect(next));
  const response = NextResponse.redirect(loginUrl);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/** Programmatic sign-out (e.g. from a client that already knows its session ended). */
export async function POST(request: Request): Promise<NextResponse> {
  const crossSite = rejectCrossOrigin(request);
  if (crossSite) return crossSite;
  const { revoked } = await destroySession();
  return NextResponse.json({ ok: true, revoked }, { headers: { "Cache-Control": "no-store" } });
}
