import type { Metadata } from "next";
import {PERMISSION} from "@/lib/rbac/permission";
import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/shared/page-header";
import { EmployeeForm } from "@/features/employees/employee-form";

export const metadata: Metadata = { title: "Add account" };

export default async function NewEmployeePage() {
  await requirePermission(PERMISSION.EMPLOYEE_CREATE);
  return (<><PageHeader title="Add account" description="Create an employee or admin account with a temporary password." /><EmployeeForm /></>);
}
