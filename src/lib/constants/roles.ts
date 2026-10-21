import { UserRole } from "@/generated/prisma/enums";

export const ROLE = {
  ADMIN: UserRole.ADMIN,
  EMPLOYEE: UserRole.EMPLOYEE,
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_VALUES = [ROLE.ADMIN, ROLE.EMPLOYEE] as const;

export const ROLE_LABELS: Record<Role, string> = {
  [ROLE.ADMIN]: "Admin",
  [ROLE.EMPLOYEE]: "Employee",
};
