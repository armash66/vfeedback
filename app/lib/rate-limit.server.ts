import { createHmac } from "node:crypto";
import { getPool } from "../db/client.server.js";

export const TOO_MANY_REQUESTS_MESSAGE = "Too many requests. Please try again in a few minutes.";

export function getClientAddress(request: Request): string {
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp && cfConnectingIp.trim()) {
    return cfConnectingIp.trim();
  }
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor && xForwardedFor.trim()) {
    return xForwardedFor.split(",")[0].trim();
  }
  return "unknown";
}

export function getRateLimitKey(prefix: string, clientAddress: string): string {
  const secret = process.env.SESSION_SECRET || "fallback-secret";
  const dateStr = new Date().toISOString().slice(0, 10);
  const hmac = createHmac("sha256", secret).update(`${clientAddress}:${dateStr}`).digest("hex");
  return `${prefix}:${hmac}`;
}

export function getDeviceCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/\bvf_device=([0-9a-fA-F-]{36})\b/);
  return match ? match[1].toLowerCase() : null;
}

export function createDeviceCookieHeader(deviceId: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `vf_device=${deviceId}; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax${secure}`;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  now: Date = new Date(),
): Promise<{ allowed: boolean; count: number }> {
  const nowMs = now.getTime();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(nowMs / windowMs) * windowMs);

  const pool = getPool();

  // Opportunistic cleanup: ~1 in 100 requests (3/256 ≈ 1.17%)
  // Uses crypto.getRandomValues without Math.random
  const rand = new Uint8Array(1);
  crypto.getRandomValues(rand);
  if (rand[0] < 3) {
    pool
      .query(`DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 hour'`)
      .catch((err) => console.error("Rate limit cleanup error:", err));
  }

  const result = await pool.query<{ count: number }>(
    `INSERT INTO rate_limits ("key", "window_start", "count")
     VALUES ($1, $2, 1)
     ON CONFLICT ("key", "window_start")
     DO UPDATE SET "count" = rate_limits.count + 1
     RETURNING "count"`,
    [key, windowStart],
  );

  const count = result.rows[0]?.count ?? 1;
  return {
    allowed: count <= limit,
    count,
  };
}
