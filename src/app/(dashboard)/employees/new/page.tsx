import {PERMISSION} from "@/lib/rbac/permission";
import { requirePermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/shared/page-header";
import { EmployeeForm } from "@/features/employees/employee-form";

export const metadata = { title: "Add employee" };

export default async function NewEmployeePage() {
  await requirePermission(PERMISSION.EMPLOYEE_CREATE);
  return (<><PageHeader title="Add employee" description="Give them a temporary password and ask them to keep it private." /><EmployeeForm /></>);
}
