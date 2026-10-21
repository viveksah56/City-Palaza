import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signSessionToken, verifySessionToken } from "@/lib/auth/token";
import { loginSchema, employeeCreateSchema } from "@/validations/employee";

describe("authentication primitives", () => {
  it("hashes passwords and verifies them", async () => {
    const h = await hashPassword("Correct-Horse-9");
    expect(h).not.toContain("Correct-Horse-9");
    expect(await verifyPassword("Correct-Horse-9", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });

  it("signs and verifies a session token", async () => {
    const t = await signSessionToken("sess_1", new Date(Date.now() + 60_000));
    expect(await verifySessionToken(t)).toBe("sess_1");
  });

  it("rejects tampered and expired tokens", async () => {
    const t = await signSessionToken("sess_1", new Date(Date.now() + 60_000));
    expect(await verifySessionToken(t.slice(0, -2) + "xx")).toBeNull();
    const expired = await signSessionToken("sess_1", new Date(Date.now() - 10_000));
    expect(await verifySessionToken(expired)).toBeNull();
    expect(await verifySessionToken("garbage")).toBeNull();
  });

  it("validates login input", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(loginSchema.parse({ email: " A@B.com ", password: "x" }).email).toBe("a@b.com");
  });

  it("enforces password strength for new accounts", () => {
    const base = { firstName: "A", lastName: "B", email: "a@b.com", role: "EMPLOYEE" as const };
    expect(employeeCreateSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(employeeCreateSchema.safeParse({ ...base, password: "alllowercase123" }).success).toBe(false);
    expect(employeeCreateSchema.safeParse({ ...base, password: "GoodPassw0rd!" }).success).toBe(true);
  });
});
