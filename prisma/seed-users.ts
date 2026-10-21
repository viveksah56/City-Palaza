/**
 * Seed one administrator and one employee from environment variables.
 * Required: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_EMPLOYEE_EMAIL,
 * SEED_EMPLOYEE_PASSWORD. Production additionally requires
 * ALLOW_PRODUCTION_ACCOUNT_SEED=true and only creates missing accounts.
 */
import { PrismaClient, type UserRole } from "@prisma/client";
import { config } from "dotenv";
import { hashPassword } from "../src/lib/auth/password";
import { PERMISSIONS, ROLE_PERMISSIONS } from "../src/lib/rbac/permission";
import { ROLE, ROLE_LABELS, ROLE_VALUES, type Role } from "../src/lib/constants/roles";

config({ path: process.env.SEED_ENV_FILE || (process.env.NODE_ENV === "production" ? ".env.production" : ".env") });

type AccountInput = {
  role: Role;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
};

function accountFromEnv(role: Role): AccountInput {
  const prefix = role === ROLE.ADMIN ? "SEED_ADMIN" : "SEED_EMPLOYEE";
  const email = process.env[`${prefix}_EMAIL`]?.trim().toLowerCase();
  const password = process.env[`${prefix}_PASSWORD`];
  if (!email || !password) {
    throw new Error(`Set ${prefix}_EMAIL and ${prefix}_PASSWORD in your environment before seeding.`);
  }
  if (password.length < 12) throw new Error(`${prefix}_PASSWORD must contain at least 12 characters.`);
  return {
    role,
    email,
    password,
    firstName: process.env[`${prefix}_FIRST_NAME`]?.trim() || (role === ROLE.ADMIN ? "Shop" : "Store"),
    lastName: process.env[`${prefix}_LAST_NAME`]?.trim() || (role === ROLE.ADMIN ? "Admin" : "Employee"),
    phone: process.env[`${prefix}_PHONE`]?.trim() || undefined,
  };
}

const accounts = [accountFromEnv(ROLE.ADMIN), accountFromEnv(ROLE.EMPLOYEE)];
if (accounts[0].email === accounts[1].email) throw new Error("Admin and employee must use different email addresses.");

const production = process.env.NODE_ENV === "production";
if (production && process.env.ALLOW_PRODUCTION_ACCOUNT_SEED !== "true") {
  throw new Error("Production account seeding is disabled. Set ALLOW_PRODUCTION_ACCOUNT_SEED=true for an intentional first seed.");
}

const prisma = new PrismaClient();

async function main() {
  const hashes = await Promise.all(accounts.map(({ password }) => hashPassword(password)));

  await prisma.$transaction(async (tx) => {
    for (const key of PERMISSIONS) await tx.permission.upsert({ where: { key }, create: { key }, update: {} });
    for (const role of ROLE_VALUES) {
      await tx.role.upsert({ where: { key: role }, create: { key: role, name: ROLE_LABELS[role] }, update: { name: ROLE_LABELS[role] } });
      await tx.rolePermission.deleteMany({ where: { roleKey: role } });
      for (const permissionKey of ROLE_PERMISSIONS[role]) {
        await tx.rolePermission.upsert({
          where: { roleKey_permissionKey: { roleKey: role as UserRole, permissionKey } },
          create: { roleKey: role as UserRole, permissionKey },
          update: {},
        });
      }
    }

    for (const [index, account] of accounts.entries()) {
      const existing = await tx.user.findUnique({ where: { email: account.email }, select: { id: true } });
      if (existing && production) {
        throw new Error(`Account ${account.email} already exists. Production seeding never changes an existing account.`);
      }
      await tx.user.upsert({
        where: { email: account.email },
        create: {
          firstName: account.firstName,
          lastName: account.lastName,
          email: account.email,
          phone: account.phone,
          role: account.role,
          status: "ACTIVE",
          passwordHash: hashes[index],
        },
        // Local seeding deliberately resets these two development accounts to the current .env credentials.
        update: production ? {} : {
          firstName: account.firstName,
          lastName: account.lastName,
          phone: account.phone,
          role: account.role,
          status: "ACTIVE",
          passwordHash: hashes[index],
        },
      });
    }
  });

  console.log(`Seeded ${accounts.length} account(s): ${accounts.map(({ role, email }) => `${role} ${email}`).join(", ")}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
