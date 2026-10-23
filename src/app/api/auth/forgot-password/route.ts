import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/validations/employee";
import { createPasswordReset } from "@/lib/auth/password-reset";
import { rateLimitResponse } from "@/lib/rate-limit";
import { rejectCrossOrigin } from "@/lib/auth/origin";

export async function POST(request: Request): Promise<NextResponse> {
  const crossSite = rejectCrossOrigin(request);
  if (crossSite) return crossSite;
  const limited = await rateLimitResponse(request, "auth:forgot-password", { ...{ limit: 5, windowSeconds: 300 }, scope: "ip" });
  if (limited) return limited;

  let input: ReturnType<typeof forgotPasswordSchema.parse>;
  try {
    input = forgotPasswordSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    await createPasswordReset(input.email);
    return NextResponse.json({ ok: true, message: "If an active account matches that email, a password reset link will arrive shortly." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[password reset request failure]", error);
    return NextResponse.json({ error: "Password reset is temporarily unavailable. Please try again shortly." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
