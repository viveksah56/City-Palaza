import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

describe("authentication proxy boundaries", () => {
  it.each([
    "/api/auth/login",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/refresh",
  ])("allows the public auth endpoint %s to reach its route handler", async (pathname) => {
    const response = await proxy(new NextRequest(`https://cityplaza.test${pathname}`, { method: "POST" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("returns 401 for a protected API request without a session", async () => {
    const response = await proxy(new NextRequest("https://cityplaza.test/api/products/search"));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "UNAUTHENTICATED" });
  });

  it("sends an expired API page request with a refresh cookie through refresh", async () => {
    const response = await proxy(new NextRequest("https://cityplaza.test/sales?range=week", {
      headers: { cookie: "cp_refresh=present" },
    }));
    expect(response.status).toBe(307);
    const destination = new URL(response.headers.get("location") ?? "");
    expect(destination.pathname).toBe("/api/auth/refresh");
    expect(destination.searchParams.get("next")).toBe("/sales?range=week");
  });

  it("refreshes safe GET API requests before returning an unauthorized response", async () => {
    const response = await proxy(new NextRequest("https://cityplaza.test/api/products/pixel-10/serials", {
      headers: { cookie: "cp_refresh=present" },
    }));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/api/auth/refresh");
  });
});
