import { DomainError } from "@/lib/errors";
import { ROLE, type Role } from "@/lib/constants/roles";

export const PERMISSION = {
  DASHBOARD_VIEW: "DASHBOARD_VIEW",
  PRODUCT_VIEW: "PRODUCT_VIEW",
  PRODUCT_CREATE: "PRODUCT_CREATE",
  PRODUCT_UPDATE: "PRODUCT_UPDATE",
  PRODUCT_DELETE: "PRODUCT_DELETE",
  CATEGORY_VIEW: "CATEGORY_VIEW",
  CATEGORY_CREATE: "CATEGORY_CREATE",
  CATEGORY_UPDATE: "CATEGORY_UPDATE",
  CATEGORY_DELETE: "CATEGORY_DELETE",
  BRAND_VIEW: "BRAND_VIEW",
  BRAND_CREATE: "BRAND_CREATE",
  BRAND_UPDATE: "BRAND_UPDATE",
  BRAND_DELETE: "BRAND_DELETE",
  INVENTORY_VIEW: "INVENTORY_VIEW",
  INVENTORY_ADD: "INVENTORY_ADD",
  INVENTORY_ADJUST: "INVENTORY_ADJUST",
  INVENTORY_HISTORY_VIEW: "INVENTORY_HISTORY_VIEW",
  SALE_CREATE: "SALE_CREATE",
  SALE_VIEW: "SALE_VIEW",
  SALE_VIEW_ALL: "SALE_VIEW_ALL",
  SALE_VOID: "SALE_VOID",
  CUSTOMER_VIEW: "CUSTOMER_VIEW",
  CUSTOMER_CREATE: "CUSTOMER_CREATE",
  CUSTOMER_UPDATE: "CUSTOMER_UPDATE",
  EMPLOYEE_VIEW: "EMPLOYEE_VIEW",
  EMPLOYEE_CREATE: "EMPLOYEE_CREATE",
  EMPLOYEE_UPDATE: "EMPLOYEE_UPDATE",
  EMPLOYEE_DISABLE: "EMPLOYEE_DISABLE",
  REPORT_VIEW: "REPORT_VIEW",
  REPORT_SALES: "REPORT_SALES",
  REPORT_PROFIT: "REPORT_PROFIT",
  REPORT_INVENTORY: "REPORT_INVENTORY",
  AUDIT_VIEW: "AUDIT_VIEW",
  SETTINGS_VIEW: "SETTINGS_VIEW",
  SETTINGS_UPDATE: "SETTINGS_UPDATE",
} as const;

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION];

export const PERMISSIONS = Object.freeze(Object.values(PERMISSION)) as readonly Permission[];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  [ROLE.ADMIN]: new Set<Permission>(PERMISSIONS),
  [ROLE.EMPLOYEE]: new Set<Permission>([
    PERMISSION.DASHBOARD_VIEW,
    PERMISSION.PRODUCT_VIEW,
    PERMISSION.CATEGORY_VIEW,
    PERMISSION.BRAND_VIEW,
    PERMISSION.SALE_CREATE,
    PERMISSION.SALE_VIEW,
    PERMISSION.CUSTOMER_VIEW,
    PERMISSION.CUSTOMER_CREATE,
    PERMISSION.CUSTOMER_UPDATE,
  ]),
};

export function hasRole(role: Role | null | undefined, expected: Role | readonly Role[]): boolean {
  if (!role) return false;
  return Array.isArray(expected) ? expected.includes(role) : role === expected;
}

export function hasPermission(role: Role | null | undefined, permission: Permission): boolean {
  if (!role || !Object.hasOwn(ROLE_PERMISSIONS, role)) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) === true;
}

export function hasAnyPermission(role: Role | null | undefined, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export function assertRolePermission(role: Role | null | undefined, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new DomainError("FORBIDDEN", "You don't have permission to do that.");
  }
}
