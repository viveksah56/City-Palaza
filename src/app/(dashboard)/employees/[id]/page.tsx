import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import {PERMISSION, hasPermission} from "@/lib/rbac/permission";
import { fullName } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/badges";
import { EmployeeForm } from "@/features/employees/employee-form";
import { DeleteEmployeeButton, EmployeeStatusButton, ResetPasswordDialog } from "@/features/employees/employee-actions";
import { getEmployee } from "@/server/employees.service";

export default async function EmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSION.EMPLOYEE_VIEW);
  const { id } = await params;
  const e = await getEmployee(id);
  if (!e) notFound();
  const canUpdate = hasPermission(user.role, PERMISSION.EMPLOYEE_UPDATE);
  return (
    <>
      <PageHeader
        title={fullName(e)}
        description={`${e._count.sales} sales on record`}
        actions={<><StatusBadge status={e.status} />{canUpdate && <ResetPasswordDialog id={e.id} />}{hasPermission(user.role, PERMISSION.EMPLOYEE_DISABLE) && <EmployeeStatusButton id={e.id} status={e.status} isSelf={e.id === user.id} />}{hasPermission(user.role, PERMISSION.EMPLOYEE_DELETE) && <DeleteEmployeeButton id={e.id} isSelf={e.id === user.id} />}</>}
      />
      {canUpdate ? <EmployeeForm employee={{ id: e.id, firstName: e.firstName, lastName: e.lastName, email: e.email, phone: e.phone, role: e.role }} /> : <p className="text-sm text-muted-foreground">{e.email}</p>}
    </>
  );
}
