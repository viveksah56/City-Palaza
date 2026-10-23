import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

type Row = Record<string, unknown> | null;
const db = {
  session: { findUnique: vi.fn<() => Promise<Row>>(), updateMany: vi.fn(), deleteMany: vi.fn() },
};
const jar = new Map<string, string>();
const cookieStore = {
  get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  set: vi.fn((name: string, value: string) => { jar.set(name, value); }),
  delete: vi.fn((name: string) => { jar.delete(name); }),
};

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitResponse: vi.fn(async () => null) }));

const { signAccessToken, signRefreshToken } = await import("@/lib/auth/token");
const refreshRoute = await import("@/app/api/auth/refresh/route");
const logoutRoute = await import("@/app/api/auth/logout/route");
const { rejectCrossOrigin } = await import("@/lib/auth/origin");

const user = { id: "u1", firstName: "Sita", lastName: "Rai", email: "sita@example.com", role: "EMPLOYEE", status: "ACTIVE" };
const future = () => new Date(Date.now() + 3_600_000);
const post = (path = "/api/auth/refresh", headers: Record<string, string> = {}) => new Request(`https://cityplaza.test${path}`, { method: "POST", headers });

async function withRefreshCookie(tokenId: string) {
  jar.set("cp_refresh", await signRefreshToken("sess_1", tokenId, future()));
}
const session = (over: Record<string, unknown> = {}) => ({ id: "sess_1", refreshTokenId: "tok_current", refreshRotatedAt: null, expiresAt: future(), user, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  jar.clear();
  db.session.updateMany.mockResolvedValue({ count: 1 });
  db.session.deleteMany.mockResolvedValue({ count: 1 });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("POST /api/auth/refresh", () => {
  it("rotates the token, remembers the previous one and sets fresh cookies", async () => {
    await withRefreshCookie("tok_current");
    db.session.findUnique.mockResolvedValue(session());
    const response = await refreshRoute.POST(post());
    expect(response.status).toBe(200);
    const update = db.session.updateMany.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(update.data.previousRefreshTokenId).toBe("tok_current");
    expect(update.data.refreshRotatedAt).toBeInstanceOf(Date);
    expect(update.data.refreshTokenId).not.toBe("tok_current");
    expect(cookieStore.set).toHaveBeenCalledWith("cp_session", expect.any(String), expect.objectContaining({ httpOnly: true }));
    expect(cookieStore.set).toHaveBeenCalledWith("cp_refresh", expect.any(String), expect.objectContaining({ httpOnly: true }));
  });

  it("treats a just-rotated token as a harmless concurrent refresh (409), not theft", async () => {
    await withRefreshCookie("tok_old");
    db.session.findUnique.mockResolvedValue(session({ refreshRotatedAt: new Date(Date.now() - 2000) }));
    const response = await refreshRoute.POST(post());
    expect(response.status).toBe(409);
    expect(db.session.deleteMany).not.toHaveBeenCalled();
  });

  it("revokes the whole session when a rotated-out token is replayed after the grace window", async () => {
    await withRefreshCookie("tok_old");
    db.session.findUnique.mockResolvedValue(session({ refreshRotatedAt: new Date(Date.now() - 120_000) }));
    const response = await refreshRoute.POST(post());
    expect(response.status).toBe(401);
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { id: "sess_1" } });
    expect(cookieStore.delete).toHaveBeenCalledWith("cp_session");
    expect(cookieStore.delete).toHaveBeenCalledWith("cp_refresh");
    expect((await response.json()).message).toMatch(/security/i);
  });

  it("signs out (401, cookies cleared) when the session row is gone", async () => {
    await withRefreshCookie("tok_current");
    db.session.findUnique.mockResolvedValue(null);
    const response = await refreshRoute.POST(post());
    expect(response.status).toBe(401);
    expect(cookieStore.delete).toHaveBeenCalledWith("cp_refresh");
  });

  it("signs out when the account has been disabled", async () => {
    await withRefreshCookie("tok_current");
    db.session.findUnique.mockResolvedValue(session({ user: { ...user, status: "DISABLED" } }));
    expect((await refreshRoute.POST(post())).status).toBe(401);
  });

  it("rejects a missing or forged refresh cookie", async () => {
    expect((await refreshRoute.POST(post())).status).toBe(401);
    jar.set("cp_refresh", "forged");
    expect((await refreshRoute.POST(post())).status).toBe(401);
  });

  it("rejects cross-site browser POSTs", async () => {
    await withRefreshCookie("tok_current");
    const response = await refreshRoute.POST(post("/api/auth/refresh", { origin: "https://evil.example", host: "cityplaza.test" }));
    expect(response.status).toBe(403);
    expect(db.session.findUnique).not.toHaveBeenCalled();
  });
});

describe("GET /api/auth/refresh (page navigation)", () => {
  it("sends a replayed token to /login with the security notice and clears cookies", async () => {
    await withRefreshCookie("tok_old");
    db.session.findUnique.mockResolvedValue(session({ refreshRotatedAt: new Date(Date.now() - 120_000) }));
    const response = await refreshRoute.GET(new NextRequest("https://cityplaza.test/api/auth/refresh?next=/sales"));
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("reason")).toBe("security");
    expect(location.searchParams.get("next")).toBe("/sales");
    expect(cookieStore.delete).toHaveBeenCalledWith("cp_session");
  });
});

describe("/api/auth/logout", () => {
  it("GET revokes the session, clears both cookies and lands on /login with the expired notice", async () => {
    jar.set("cp_session", await signAccessToken({ userId: "u1", firstName: "S", lastName: "R", email: "s@e.com", role: "EMPLOYEE" }, "sess_1", future()));
    jar.set("cp_refresh", "whatever");
    const response = await logoutRoute.GET(new Request("https://cityplaza.test/api/auth/logout?reason=expired"));
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("reason")).toBe("expired");
    expect(db.session.deleteMany).toHaveBeenCalledWith({ where: { id: "sess_1" } });
    expect(jar.has("cp_session")).toBe(false);
    expect(jar.has("cp_refresh")).toBe(false);
  });

  it("still clears cookies when the database is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    jar.set("cp_session", await signAccessToken({ userId: "u1", firstName: "S", lastName: "R", email: "s@e.com", role: "EMPLOYEE" }, "sess_1", future()));
    db.session.deleteMany.mockRejectedValue(new Error("db down"));
    const response = await logoutRoute.POST(post("/api/auth/logout"));
    expect(response.status).toBe(200);
    expect((await response.json()).revoked).toBe(false);
    expect(jar.has("cp_session")).toBe(false);
  });

  it("ignores unknown reasons and unsafe next targets", async () => {
    const response = await logoutRoute.GET(new Request("https://cityplaza.test/api/auth/logout?reason=<script>&next=//evil.example"));
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.searchParams.get("reason")).toBe("expired");
    expect(location.searchParams.get("next")).toBe("/dashboard");
  });
});

describe("rejectCrossOrigin", () => {
  const check = (headers: Record<string, string>) => rejectCrossOrigin(new Request("https://cityplaza.test/api/auth/login", { method: "POST", headers }));

  it("allows same-origin, header-less and APP_URL origins; blocks everything else", () => {
    expect(check({ origin: "https://cityplaza.test", host: "cityplaza.test" })).toBeNull();
    expect(check({})).toBeNull();
    expect(check({ origin: "https://evil.example", host: "cityplaza.test" })?.status).toBe(403);
    expect(check({ origin: "null", host: "cityplaza.test" })?.status).toBe(403);
    process.env.APP_URL = "https://app.cityplaza.test";
    expect(check({ origin: "https://app.cityplaza.test", host: "internal:3000" })).toBeNull();
    delete process.env.APP_URL;
  });
});
