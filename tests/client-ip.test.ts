import { afterEach, describe, expect, it } from "vitest";
import { clientIpFromHeaders } from "@/lib/client-ip";

const h = (values: Record<string, string>) => new Headers(values);

afterEach(() => { delete process.env.TRUSTED_PROXY_HOPS; });

describe("clientIpFromHeaders", () => {
  it("returns the IP appended by the trusted proxy, not a value the client spoofed on the left", () => {
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("cannot be tricked by a fresh spoofed header on every request", () => {
    const a = clientIpFromHeaders(h({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" }));
    const b = clientIpFromHeaders(h({ "x-forwarded-for": "2.2.2.2, 203.0.113.9" }));
    expect(a).toBe(b);
  });

  it("honours TRUSTED_PROXY_HOPS for deployments with two proxies", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "198.51.100.7, 203.0.113.9" }))).toBe("198.51.100.7");
  });

  it("falls back to x-real-ip and ignores values that are not IP addresses", () => {
    expect(clientIpFromHeaders(h({ "x-real-ip": "203.0.113.5" }))).toBe("203.0.113.5");
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "not-an-ip", "x-real-ip": "also bad" }))).toBeNull();
    expect(clientIpFromHeaders(h({}))).toBeNull();
  });

  it("supports IPv6", () => {
    expect(clientIpFromHeaders(h({ "x-forwarded-for": "2001:db8::1" }))).toBe("2001:db8::1");
  });
});
