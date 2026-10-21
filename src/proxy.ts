import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE, SESSION_COOKIE } from "@/lib/constants";
import { verifyAccessToken } from "@/lib/auth/token";
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

function routePermission(pathname: string): Permission | null {
  const exactPermissions: Readonly<Record<string, Permission>> = {
    "/sales/new": PERMISSION.SALE_CREATE,
    "/products/new": PERMISSION.PRODUCT_CREATE,
    "/products/categories": PERMISSION.CATEGORY_VIEW,
    "/products/brands": PERMISSION.BRAND_VIEW,
    "/employees/new": PERMISSION.EMPLOYEE_CREATE,
    "/inventory/history": PERMISSION.INVENTORY_HISTORY_VIEW,
  };
  const exact = exactPermissions[pathname];
  if (exact) return exact;
  if (pathname === "/api/products/search") return PERMISSION.PRODUCT_VIEW;
  if (pathname === "/api/customers/search") return PERMISSION.CUSTOMER_VIEW;
  if (/^\/api\/products\/[^/]+\/serials$/.test(pathname)) return PERMISSION.SALE_CREATE;
  if (pathname === "/api/products/bulk") return PERMISSION.PRODUCT_CREATE;
  if (/^\/api\/sales\/[^/]+\/receipt$/.test(pathname)) return PERMISSION.SALE_VIEW;
  return ROUTE_PERMISSIONS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? null;
}

function isApiRequest(request: NextRequest): boolean {
  return request.nextUrl.pathname.startsWith("/api/");
}

function internalDestination(request: NextRequest): string {
  const destination = request.nextUrl.clone();
  destination.searchParams.delete("_rsc");
  return `${destination.pathname}${destination.search}`;
}

function denyUnauthenticated(request: NextRequest): NextResponse {
  if (isApiRequest(request)) {
    return NextResponse.json({ error: "UNAUTHENTICATED", message: "Your session has expired. Please sign in again." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", internalDestination(request));
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (request.nextUrl.pathname === "/api/auth/refresh") return NextResponse.next();
  const accessToken = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = accessToken ? await verifyAccessToken(accessToken) : null;
  if (!claims) {
    if (request.cookies.has(REFRESH_COOKIE) && !isApiRequest(request)) {
      const refreshUrl = new URL("/api/auth/refresh", request.url);
      refreshUrl.searchParams.set("next", internalDestination(request));
      return NextResponse.redirect(refreshUrl);
    }
    return denyUnauthenticated(request);
  }

  const permission = routePermission(request.nextUrl.pathname);
  if (permission && !hasPermission(claims.role, permission)) {
    if (isApiRequest(request)) return NextResponse.json({ error: "FORBIDDEN", message: "You don't have permission to access this resource." }, { status: 403 });
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
