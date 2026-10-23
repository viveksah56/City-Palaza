import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { resetPasswordSchema } from "@/validations/employee";
import { consumePasswordReset } from "@/lib/auth/password-reset";
import { rateLimitResponse } from "@/lib/rate-limit";
import { rejectCrossOrigin } from "@/lib/auth/origin";
import { DomainError } from "@/lib/errors";

export async function POST(request: Request): Promise<NextResponse> {
  const crossSite = rejectCrossOrigin(request);
  if (crossSite) return crossSite;
  const limited = await rateLimitResponse(request, "auth:reset-password", { ...{ limit: 8, windowSeconds: 300 }, scope: "ip" });
  if (limited) return limited;

  try {
    const input = resetPasswordSchema.parse(await request.json());
    await consumePasswordReset(input.token, input.password);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Check the password fields and try again." }, { status: 400 });
    if (error instanceof DomainError && error.code === "VALIDATION") return NextResponse.json({ error: error.message }, { status: 400, headers: { "Cache-Control": "no-store" } });
    console.error("[password reset failure]", error);
    return NextResponse.json({ error: "We couldn’t update your password right now. Please try again shortly." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
