import { PERMISSION } from "@/lib/rbac/permission";
import type { Permission } from "./permission";

export type NavItem = { title: string; href: string; icon: string; permission: Permission };

/** Admin sees all of these; employees only see what their permissions allow
 *  (Dashboard, Sales, Products, Customers). */
export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", permission: PERMISSION.DASHBOARD_VIEW },
  { title: "Sales", href: "/sales", icon: "ShoppingCart", permission: PERMISSION.SALE_VIEW },
  { title: "Products", href: "/products", icon: "Smartphone", permission: PERMISSION.PRODUCT_VIEW },
  { title: "Inventory", href: "/inventory", icon: "Boxes", permission: PERMISSION.INVENTORY_VIEW },
  { title: "Customers", href: "/customers", icon: "Users", permission: PERMISSION.CUSTOMER_VIEW },
  { title: "Reports", href: "/reports", icon: "BarChart3", permission: PERMISSION.REPORT_VIEW },
  { title: "Employees", href: "/employees", icon: "UserCog", permission: PERMISSION.EMPLOYEE_VIEW },
  { title: "Audit logs", href: "/audit-logs", icon: "ScrollText", permission: PERMISSION.AUDIT_VIEW },
  { title: "Settings", href: "/settings", icon: "Settings", permission: PERMISSION.SETTINGS_VIEW },
];
