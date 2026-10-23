import { NextResponse } from "next/server";

/**
 * Defence-in-depth CSRF check for cookie-authenticated POST endpoints (SameSite=Lax is the first layer).
 * Browsers always send `Origin` on cross-site POSTs, so a mismatching Origin is rejected; requests without
 * the header (curl, server-to-server) are not browser CSRF vectors and pass.
 */
export function rejectCrossOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  const allowed = new Set<string>();
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))?.split(",")[0]?.trim();
  if (host) allowed.add(host);
  if (process.env.APP_URL) {
    try { allowed.add(new URL(process.env.APP_URL).host); } catch { /* ignore malformed APP_URL */ }
  }

  let originHost: string | null = null;
  try { originHost = new URL(origin).host; } catch { /* "null" or malformed */ }
  if (originHost && allowed.has(originHost)) return null;

  return NextResponse.json(
    { error: "FORBIDDEN", message: "Cross-site requests are not allowed." },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}
