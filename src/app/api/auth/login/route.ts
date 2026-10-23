import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "@/lib/errors";
import { RateLimitExceededError } from "@/lib/rate-limit";
import { signIn, SignInUnavailableError } from "@/lib/auth/login";
import { rejectCrossOrigin } from "@/lib/auth/origin";

export async function POST(request: Request): Promise<NextResponse> {
  const crossSite = rejectCrossOrigin(request);
  if (crossSite) return crossSite;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
  }

  const payload = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  try {
    const result = await signIn(payload, payload.redirectTo);
    return NextResponse.json({ ok: true, redirectTo: result.redirectTo }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: "Too many sign-in attempts. Please wait for the countdown before trying again.", retryAfterSeconds: error.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds), "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Check your sign-in details." }, { status: 400 });
    if (error instanceof DomainError && error.code === "UNAUTHENTICATED") return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof DomainError && error.code === "FORBIDDEN") return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof SignInUnavailableError) {
      const message = error.stage === "session creation"
        ? "Your account was verified, but we couldn’t start a secure sign-in session. Please try again shortly. If this continues, contact your administrator."
        : "We couldn’t check your account with the sign-in service. Please try again shortly. If the problem continues, contact your administrator to check the production database connection and migrations.";
      return NextResponse.json({ error: message }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    console.error("[login request failure]", error);
    return NextResponse.json({ error: "We couldn’t complete sign-in because of a temporary service problem. Please try again shortly." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
