import { redirect } from "next/navigation";
import { DomainError } from "@/lib/errors";
import { SESSION_EXPIRED_LOGOUT_URL } from "@/lib/constants";
import { hasPermission, type Permission } from "@/lib/rbac/permission";
import { getSessionUser, type SessionUser } from "./session";

/**
 * For pages / layouts: redirect when not allowed.
 * A request only gets here without a user when its cookies no longer match a live session (expired,
 * revoked, signed in elsewhere, account disabled), so we sign the browser out properly: the logout route
 * clears the stale cookies (a Server Component can't) and sends the person to /login with a notice.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(SESSION_EXPIRED_LOGOUT_URL);
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user.role, permission)) redirect("/forbidden");
  return user;
}

/** For server actions & route handlers: throw a DomainError (turned into a friendly result). */
export async function assertPermission(permission: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new DomainError("UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  if (!hasPermission(user.role, permission)) throw new DomainError("FORBIDDEN", "You don't have permission to do that.");
  return user;
}
