import { isIP } from "node:net";

/** How many reverse proxies in front of the app append to X-Forwarded-For (Vercel/Cloudflare/nginx = 1). */
function trustedProxyHops(): number {
  const hops = Number(process.env.TRUSTED_PROXY_HOPS);
  return Number.isInteger(hops) && hops >= 1 ? hops : 1;
}

/**
 * Best-effort client IP behind a reverse proxy.
 *
 * X-Forwarded-For is client-controllable on the left, so we read it from the RIGHT, skipping only the
 * proxies we trust. A spoofed `X-Forwarded-For: 1.2.3.4` therefore can't be used to dodge rate limits.
 * Values that are not valid IPs are ignored.
 */
export function clientIpFromHeaders(headers: Pick<Headers, "get">): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    const candidate = parts[Math.max(0, parts.length - trustedProxyHops())];
    if (candidate && isIP(candidate)) return candidate;
  }
  const real = headers.get("x-real-ip")?.trim();
  if (real && isIP(real)) return real;
  return null;
}
