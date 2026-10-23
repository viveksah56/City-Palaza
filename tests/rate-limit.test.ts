import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
const executeRaw = vi.fn();
const getSessionClaims = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: queryRaw, $executeRaw: executeRaw } }));
vi.mock("@/lib/session", () => ({ getSessionClaims }));

const { consumeRateLimit, rateLimitResponse, rateLimitKey, refundRateLimit, resetRateLimit } = await import("@/lib/rate-limit");

const request = (headers: Record<string, string> = {}) => new Request("https://cityplaza.test/api/x", { headers });
/** The first interpolated value of the raw tagged-template call is always the hashed key. */
const keyUsed = (mock: typeof queryRaw) => mock.mock.calls.at(-1)?.[1] as string;

beforeEach(() => {
  vi.clearAllMocks();
  getSessionClaims.mockResolvedValue(null);
});

describe("consumeRateLimit", () => {
  it("allows requests up to the limit", async () => {
    queryRaw.mockResolvedValue([{ attempts: 3, windowEndsAt: new Date(Date.now() + 60_000) }]);
    await expect(consumeRateLimit("b", { limit: 3, windowSeconds: 60 })).resolves.toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it("blocks over the limit and reports a positive retry time", async () => {
    queryRaw.mockResolvedValue([{ attempts: 4, windowEndsAt: new Date(Date.now() + 120_000) }]);
    const result = await consumeRateLimit("b", { limit: 3, windowSeconds: 60 });
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(100);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(120);
  });

  it("hashes the bucket so raw emails/IPs are never stored", async () => {
    queryRaw.mockResolvedValue([{ attempts: 1, windowEndsAt: new Date(Date.now() + 1000) }]);
    await consumeRateLimit("auth:login:account:a@b.com:1.2.3.4", { limit: 5, windowSeconds: 60 });
    expect(keyUsed(queryRaw)).toBe(rateLimitKey("auth:login:account:a@b.com:1.2.3.4"));
    expect(keyUsed(queryRaw)).not.toContain("a@b.com");
  });

  it("extends the block with GREATEST so the cooldown can never shorten an existing window", async () => {
    queryRaw.mockResolvedValue([{ attempts: 1, windowEndsAt: new Date(Date.now() + 1000) }]);
    await consumeRateLimit("b", { limit: 5, windowSeconds: 60 });
    const sql = (queryRaw.mock.calls[0]?.[0] as string[]).join("?");
    expect(sql).toContain("GREATEST");
  });

  it("fails loudly when storage returns nothing", async () => {
    queryRaw.mockResolvedValue([]);
    await expect(consumeRateLimit("b", { limit: 1, windowSeconds: 1 })).rejects.toThrow();
  });
});

describe("refund / reset", () => {
  it("refund and reset target the hashed key", async () => {
    await refundRateLimit("bucket");
    expect(executeRaw.mock.calls[0]?.[1]).toBe(rateLimitKey("bucket"));
    await resetRateLimit("bucket");
    expect(executeRaw.mock.calls[1]?.[1]).toBe(rateLimitKey("bucket"));
  });
});

describe("rateLimitResponse identity", () => {
  beforeEach(() => queryRaw.mockResolvedValue([{ attempts: 1, windowEndsAt: new Date(Date.now() + 1000) }]));

  it("keys signed-in staff by user, so colleagues on the same shop IP don't share a budget", async () => {
    getSessionClaims.mockResolvedValue({ id: "user_1" });
    await rateLimitResponse(request({ "x-forwarded-for": "203.0.113.9" }), "products:search", { limit: 5, windowSeconds: 60 });
    expect(keyUsed(queryRaw)).toBe(rateLimitKey("products:search:user:user_1"));
  });

  it("keys anonymous callers by IP", async () => {
    await rateLimitResponse(request({ "x-forwarded-for": "203.0.113.9" }), "x", { limit: 5, windowSeconds: 60 });
    expect(keyUsed(queryRaw)).toBe(rateLimitKey("x:ip:203.0.113.9"));
  });

  it("scope 'ip' ignores any session cookie", async () => {
    getSessionClaims.mockResolvedValue({ id: "user_1" });
    await rateLimitResponse(request({ "x-forwarded-for": "203.0.113.9" }), "x", { limit: 5, windowSeconds: 60, scope: "ip" });
    expect(keyUsed(queryRaw)).toBe(rateLimitKey("x:ip:203.0.113.9"));
    expect(getSessionClaims).not.toHaveBeenCalled();
  });

  it("an explicit identity wins", async () => {
    await rateLimitResponse(request(), "auth:refresh", { limit: 5, windowSeconds: 60, identity: "sess_9" });
    expect(keyUsed(queryRaw)).toBe(rateLimitKey("auth:refresh:id:sess_9"));
  });
});

describe("rateLimitResponse results", () => {
  it("returns null when allowed", async () => {
    queryRaw.mockResolvedValue([{ attempts: 1, windowEndsAt: new Date(Date.now() + 1000) }]);
    await expect(rateLimitResponse(request(), "x", { limit: 5, windowSeconds: 60 })).resolves.toBeNull();
  });

  it("returns 429 with Retry-After when blocked", async () => {
    queryRaw.mockResolvedValue([{ attempts: 9, windowEndsAt: new Date(Date.now() + 30_000) }]);
    const response = await rateLimitResponse(request(), "x", { limit: 5, windowSeconds: 60 });
    expect(response?.status).toBe(429);
    expect(Number(response?.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("fails closed with 503 when storage is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    queryRaw.mockRejectedValue(new Error("db down"));
    const response = await rateLimitResponse(request(), "x", { limit: 5, windowSeconds: 60 });
    expect(response?.status).toBe(503);
  });
});
