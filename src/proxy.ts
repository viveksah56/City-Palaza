import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/constants";
import { AuthConfigurationError, verifyAccessToken } from "@/lib/auth/token";
import { hasPermission, PERMISSION, type Permission } from "@/lib/rbac/permission";

const ROUTE_PERMISSIONS: ReadonlyArray<readonly [string, Permission]> = [
  ["/dashboard", PERMISSION.DASHBOARD_VIEW],
  ["/sales", PERMISSION.SALE_VIEW],
  ["/products", PERMISSION.PRODUCT_VIEW],
  ["/inventory", PERMISSION.INVENTORY_VIEW],
  ["/customers", PERMISSION.CUSTOMER_VIEW],
  ["/employees", PERMISSION.EMPLOYEE_VIEW],
  ["/reports", PERMISSION.REPORT_VIEW],
  ["/settings", PERMISSION.SETTINGS_VIEW],
  ["/audit-logs", PERMISSION.AUDIT_VIEW],
];

const EXACT_PERMISSIONS: Readonly<Record<string, Permission>> = {
  "/sales/new": PERMISSION.SALE_CREATE,
  "/products/new": PERMISSION.PRODUCT_CREATE,
  "/products/categories": PERMISSION.CATEGORY_VIEW,
  "/products/brands": PERMISSION.BRAND_VIEW,
  "/employees/new": PERMISSION.EMPLOYEE_CREATE,
  "/inventory/history": PERMISSION.INVENTORY_HISTORY_VIEW,
  "/api/products/search": PERMISSION.PRODUCT_VIEW,
  "/api/customers/search": PERMISSION.CUSTOMER_VIEW,
  "/api/products/bulk": PERMISSION.PRODUCT_CREATE,
};

const PUBLIC_AUTH_ROUTES = new Set([
  "/api/auth/forgot-password",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/refresh",
  "/api/auth/reset-password",
]);

function routePermission(pathname: string): Permission | null {
  const exact = EXACT_PERMISSIONS[pathname];
  if (exact) return exact;
  if (/^\/api\/products\/[^/]+\/serials$/.test(pathname)) return PERMISSION.SALE_CREATE;
  if (/^\/api\/sales\/[^/]+\/receipt$/.test(pathname)) return PERMISSION.SALE_VIEW;
  return ROUTE_PERMISSIONS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? null;
}

function isApiRequest(request: NextRequest): boolean {
  return request.nextUrl.pathname.startsWith("/api/");
}

function isPrefetch(request: NextRequest): boolean {
  return request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch";
}

function internalDestination(request: NextRequest): string {
  const destination = request.nextUrl.clone();
  destination.searchParams.delete("_rsc");
  return `${destination.pathname}${destination.search}`;
}

function denyUnauthenticated(request: NextRequest): NextResponse {
  if (isApiRequest(request)) {
    return NextResponse.json(
      { error: "UNAUTHENTICATED", message: "Your session has expired. Please sign in again." },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", internalDestination(request));
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (PUBLIC_AUTH_ROUTES.has(request.nextUrl.pathname)) return NextResponse.next();

  const accessToken = request.cookies.get(SESSION_COOKIE)?.value;
  let claims: Awaited<ReturnType<typeof verifyAccessToken>> = null;
  try {
    claims = await verifyAccessToken(accessToken);
  } catch (error) {
    if (!(error instanceof AuthConfigurationError)) throw error;
    console.error("[auth configuration] Session verification is unavailable.", error);
    if (isApiRequest(request)) {
      return NextResponse.json({ error: "AUTH_UNAVAILABLE", message: "The sign-in service is temporarily unavailable. Please try again shortly." }, { status: 503 });
    }
    return new NextResponse("The sign-in service is temporarily unavailable. Please try again shortly.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  }

  if (!claims) {
    if (isPrefetch(request)) return new NextResponse(null, { status: 401 });

    if (request.cookies.has(REFRESH_COOKIE) && (!isApiRequest(request) || request.method === "GET" || request.method === "HEAD")) {
      const refreshUrl = new URL("/api/auth/refresh", request.url);
      refreshUrl.searchParams.set("next", internalDestination(request));
      return NextResponse.redirect(refreshUrl);
    }
    return denyUnauthenticated(request);
  }

  const permission = routePermission(request.nextUrl.pathname);
  if (permission && !hasPermission(claims.role, permission)) {
    if (isApiRequest(request)) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "You don't have permission to access this resource." },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }

  return NextResponse.next();
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
