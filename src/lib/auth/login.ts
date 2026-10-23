import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { consumeRateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { createSession } from "@/lib/auth/session";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { requestMeta, writeAudit } from "@/lib/audit";
import { loginSchema } from "@/validations/employee";
import { safeInternalRedirect } from "@/lib/auth/redirects";

export class SignInUnavailableError extends Error {
  constructor(public readonly stage: string) {
    super("Sign-in is temporarily unavailable.");
    this.name = "SignInUnavailableError";
  }
}

export async function signIn(raw: unknown, requestedRedirect?: unknown): Promise<{ redirectTo: string }> {
  let stage = "request validation";
  let email = "";
  let ip: string | null = null;

  try {
    const credentials = loginSchema.parse(raw);
    email = credentials.email;
    stage = "request metadata";
    const meta = await requestMeta();
    ip = meta.ip;
    stage = "rate limit check";
    const [ipLimit, accountLimit] = await Promise.all([
      consumeRateLimit(`auth:login:ip:${ip ?? "unknown"}`, { limit: 60, windowSeconds: 900 }),
      consumeRateLimit(`auth:login:account:${email}:${ip ?? "unknown"}`, { limit: 8, windowSeconds: 900 }),
    ]);
    const blocked = [ipLimit, accountLimit].filter((result) => !result.allowed);
    if (blocked.length) throw new RateLimitExceededError(Math.max(...blocked.map((result) => result.retryAfterSeconds)));

    stage = "user lookup";
    const user = await prisma.user.findUnique({ where: { email } });
    stage = "password verification";
    const validPassword = await verifyPassword(credentials.password, user?.passwordHash ?? (await getDummyHash()));
    if (!user || !validPassword) throw new DomainError("UNAUTHENTICATED", "Email or password is incorrect.");
    if (user.status !== "ACTIVE") throw new DomainError("FORBIDDEN", "This account is disabled. Ask an admin to reactivate it.");

    stage = "session creation";
    await createSession(
      { userId: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
      { ip: meta.ip, userAgent: meta.ua },
    );

    stage = "post-login bookkeeping";
    const bookkeeping = await Promise.allSettled([
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
      writeAudit(prisma, { actorId: user.id, action: "LOGIN", entityType: "User", entityId: user.id, description: `${user.email} signed in` }),
    ]);
    for (const result of bookkeeping) {
      if (result.status === "rejected") console.error("[login post-session bookkeeping error]", result.reason);
    }
    return { redirectTo: safeInternalRedirect(requestedRedirect) };
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof DomainError || error instanceof RateLimitExceededError) throw error;
    console.error(`[login failure: ${stage}]`, error);
    throw new SignInUnavailableError(stage);
  }
}
