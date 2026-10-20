import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { getPool } from "../db/client.server.js";
import { getSessionSecret } from "./session-secret.server.js";

export const TOO_MANY_REQUESTS_MESSAGE = "Too many requests. Please try again in a few minutes.";

let lastCleanupMs = 0;

export function getClientAddress(request: Request): string {
  const trustProxy = (process.env.TRUST_PROXY || "none").trim().toLowerCase();

  if (trustProxy === "cloudflare") {
    const cfConnectingIp = request.headers.get("cf-connecting-ip")?.trim();
    if (cfConnectingIp && isIP(cfConnectingIp) !== 0) {
      return cfConnectingIp;
    }
    return "unknown";
  }

  if (trustProxy === "proxy") {
    const xForwardedFor = request.headers.get("x-forwarded-for");
    if (xForwardedFor) {
      const parts = xForwardedFor.split(",");
      const rightmost = parts[parts.length - 1].trim();
      if (rightmost && isIP(rightmost) !== 0) {
        return rightmost;
      }
    }
    return "unknown";
  }

  return "unknown";
}

export function getRateLimitKey(prefix: string, clientAddress: string): string {
  const secret = getSessionSecret();
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

  // Prune rows older than at least 50 minutes or the active window duration at most once per minute per process asynchronously
  if (nowMs - lastCleanupMs >= 60_000) {
    lastCleanupMs = nowMs;
    const retentionSeconds = Math.max(3000, windowSeconds);
    pool
      .query(`DELETE FROM rate_limits WHERE window_start < NOW() - ($1 * INTERVAL '1 second')`, [retentionSeconds])
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Rate limit cleanup error:", msg);
      });
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
