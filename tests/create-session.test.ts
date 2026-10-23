import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(async () => 1),
  session: { deleteMany: vi.fn(async () => ({ count: 1 })), create: vi.fn(async () => ({ id: "sess_1" })) },
};
const cookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };

vi.mock("@/lib/db", () => ({ prisma: { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));

const { createSession } = await import("@/lib/auth/session");

beforeEach(() => vi.clearAllMocks());

describe("createSession", () => {
  it("takes the per-user advisory lock with $executeRaw, because Prisma 7 can't read its `void` result via $queryRaw", async () => {
    await createSession({ userId: "u1", firstName: "A", lastName: "B", email: "a@b.com", role: "EMPLOYEE" }, { ip: "203.0.113.9", userAgent: "test" });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect((tx.$executeRaw.mock.calls[0] as unknown as [string[]])[0].join("?")).toContain("pg_advisory_xact_lock");
    expect(tx.$queryRaw).not.toHaveBeenCalled();
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(cookieStore.set).toHaveBeenCalledWith("cp_session", expect.any(String), expect.anything());
    expect(cookieStore.set).toHaveBeenCalledWith("cp_refresh", expect.any(String), expect.anything());
  });
});
