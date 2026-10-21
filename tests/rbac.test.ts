import { describe, expect, it } from "vitest";
import { PERMISSIONS, hasPermission, ROLE_PERMISSIONS } from "@/lib/rbac/permission";
import { NAV_ITEMS } from "@/lib/rbac/navigation";

describe("RBAC", () => {
  it("admin has every permission", () => {
    for (const p of PERMISSIONS) expect(hasPermission("ADMIN", p)).toBe(true);
  });

  it("employee can sell and view products/customers", () => {
    for (const p of ["DASHBOARD_VIEW", "PRODUCT_VIEW", "SALE_CREATE", "SALE_VIEW", "CUSTOMER_VIEW", "CUSTOMER_CREATE"] as const) expect(hasPermission("EMPLOYEE", p)).toBe(true);
  });

  it("employee cannot manage products, stock, staff, reports, audit or settings", () => {
    for (const p of [
      "PRODUCT_CREATE", "PRODUCT_UPDATE", "PRODUCT_DELETE", "INVENTORY_VIEW", "INVENTORY_ADD", "INVENTORY_ADJUST", "INVENTORY_HISTORY_VIEW",
      "SALE_VIEW_ALL", "SALE_VOID", "EMPLOYEE_VIEW", "EMPLOYEE_CREATE", "EMPLOYEE_UPDATE", "EMPLOYEE_DISABLE",
      "REPORT_VIEW", "REPORT_SALES", "REPORT_PROFIT", "REPORT_INVENTORY", "AUDIT_VIEW", "SETTINGS_VIEW", "SETTINGS_UPDATE",
      "CATEGORY_CREATE", "CATEGORY_DELETE", "BRAND_UPDATE",
    ] as const) expect(hasPermission("EMPLOYEE", p), p).toBe(false);
  });

  it("anonymous users have nothing", () => {
    expect(hasPermission(null, "DASHBOARD_VIEW")).toBe(false);
    expect(hasPermission(undefined, "PRODUCT_VIEW")).toBe(false);
  });

  it("employee navigation is exactly Dashboard, Sales, Products, Customers", () => {
    const titles = NAV_ITEMS.filter((n) => hasPermission("EMPLOYEE", n.permission)).map((n) => n.title);
    expect(titles).toEqual(["Dashboard", "Sales", "Products", "Customers"]);
  });

  it("admin navigation shows all nine sections", () => {
    expect(NAV_ITEMS.filter((n) => hasPermission("ADMIN", n.permission))).toHaveLength(9);
  });

  it("employee permissions are a strict subset of admin's", () => {
    for (const p of ROLE_PERMISSIONS.EMPLOYEE) expect(ROLE_PERMISSIONS.ADMIN.has(p)).toBe(true);
  });
});
