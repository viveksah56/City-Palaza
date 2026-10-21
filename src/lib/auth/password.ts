import bcrypt from "bcryptjs";

const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

let dummy: Promise<string> | null = null;
/** Compared against when the email is unknown, so timing doesn't reveal which emails exist. */
export function getDummyHash(): Promise<string> {
  dummy ??= bcrypt.hash("citypalaza-dummy-password", COST);
  return dummy;
}
