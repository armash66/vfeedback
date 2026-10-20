import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  createDeviceCookieHeader,
  getClientAddress,
  getDeviceCookie,
  getRateLimitKey,
} from "../app/lib/rate-limit.server.js";
import { generateFormToken, isHoneypotTriggered, verifyFormToken } from "../app/lib/form-security.server.js";
import { isTurnstileEnabled, verifyTurnstileToken } from "../app/lib/turnstile.server.js";

describe("security - rate limiting and bot protection", () => {
  describe("pure security tests", () => {
    it("the rate-limit key is not the raw address", () => {
      const rawAddress = "192.168.1.100";
      const key = getRateLimitKey("report", rawAddress);

      // Key must not contain raw IP address
      expect(key).not.toContain(rawAddress);
      expect(key).toMatch(/^report:[0-9a-f]{64}$/);

      // Same address on same day gives consistent key
      const key2 = getRateLimitKey("report", rawAddress);
      expect(key).toBe(key2);

      // Different address gives different key
      const keyDifferent = getRateLimitKey("report", "10.0.0.1");
      expect(key).not.toBe(keyDifferent);

      // Different prefix gives different key
      const keyStatus = getRateLimitKey("status", rawAddress);
      expect(key).not.toBe(keyStatus);
    });

    it("getClientAddress extracts cf-connecting-ip, else x-forwarded-for, else unknown", () => {
      const req1 = new Request("http://localhost", {
        headers: { "cf-connecting-ip": "203.0.113.195" },
      });
      expect(getClientAddress(req1)).toBe("203.0.113.195");

      const req2 = new Request("http://localhost", {
        headers: { "x-forwarded-for": "198.51.100.1, 192.0.2.1" },
      });
      expect(getClientAddress(req2)).toBe("198.51.100.1");

      const req3 = new Request("http://localhost");
      expect(getClientAddress(req3)).toBe("unknown");
    });

    it("honeypot rejection: detects when website field is filled", () => {
      const emptyForm = new FormData();
      expect(isHoneypotTriggered(emptyForm)).toBe(false);

      emptyForm.append("website", "");
      expect(isHoneypotTriggered(emptyForm)).toBe(false);

      const botForm = new FormData();
      botForm.append("website", "https://spam-bot.example.com");
      expect(isHoneypotTriggered(botForm)).toBe(true);

      const whitespaceForm = new FormData();
      whitespaceForm.append("website", "   ");
      expect(isHoneypotTriggered(whitespaceForm)).toBe(false);
    });

    it("fill-time rejection: too fast (<3s), bad signature, and expired (>24h)", () => {
      // 1. Valid token generated and verified after 4 seconds
      const token = generateFormToken();
      const [tsStr] = token.split(".");
      const ts = Number(tsStr);

      // Submitted too fast (1.5 seconds later)
      expect(verifyFormToken(token, ts + 1500)).toBe(false);

      // Submitted just under 3 seconds (2.9 seconds later)
      expect(verifyFormToken(token, ts + 2900)).toBe(false);

      // Submitted at 4 seconds: valid
      expect(verifyFormToken(token, ts + 4000)).toBe(true);

      // Expired: submitted 25 hours later
      expect(verifyFormToken(token, ts + 25 * 60 * 60 * 1000)).toBe(false);

      // Bad signature: tampered token
      const tampered = `${ts}.abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789`;
      expect(verifyFormToken(tampered, ts + 5000)).toBe(false);

      // Corrupt format
      expect(verifyFormToken("invalid-token", ts + 5000)).toBe(false);
      expect(verifyFormToken("", ts + 5000)).toBe(false);
      expect(verifyFormToken(null, ts + 5000)).toBe(false);
    });

    it("Turnstile is skipped when keys are empty", async () => {
      const origSite = process.env.TURNSTILE_SITE_KEY;
      const origSecret = process.env.TURNSTILE_SECRET_KEY;

      try {
        process.env.TURNSTILE_SITE_KEY = "";
        process.env.TURNSTILE_SECRET_KEY = "";

        expect(isTurnstileEnabled()).toBe(false);

        // Even with empty token, verification succeeds because Turnstile is disabled
        const res = await verifyTurnstileToken("");
        expect(res.success).toBe(true);
      } finally {
        process.env.TURNSTILE_SITE_KEY = origSite;
        process.env.TURNSTILE_SECRET_KEY = origSecret;
      }
    });

    it("Turnstile rejection when enabled with invalid token", async () => {
      const origSite = process.env.TURNSTILE_SITE_KEY;
      const origSecret = process.env.TURNSTILE_SECRET_KEY;

      try {
        process.env.TURNSTILE_SITE_KEY = "1x00000000000000000000AA";
        process.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";

        expect(isTurnstileEnabled()).toBe(true);

        // Missing token is rejected
        const emptyRes = await verifyTurnstileToken("");
        expect(emptyRes.success).toBe(false);

        // Mock failed verification response from Cloudflare
        const originalFetch = globalThis.fetch;
        try {
          globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ success: false, "error-codes": ["invalid-input-response"] }),
          } as Response);

          const failRes = await verifyTurnstileToken("bad-test-token");
          expect(failRes.success).toBe(false);
          expect(failRes.error).toBe("Verification failed. Please try again.");
        } finally {
          globalThis.fetch = originalFetch;
        }
      } finally {
        process.env.TURNSTILE_SITE_KEY = origSite;
        process.env.TURNSTILE_SECRET_KEY = origSecret;
      }
    });

    it("device cookie extraction and header formatting", () => {
      const deviceId = "c8b4f17a-2450-482a-a92c-623114d51a66";
      const req = new Request("http://localhost", {
        headers: { Cookie: `foo=bar; vf_device=${deviceId}; other=1` },
      });
      expect(getDeviceCookie(req)).toBe(deviceId);

      const header = createDeviceCookieHeader(deviceId);
      expect(header).toContain(`vf_device=${deviceId}`);
      expect(header).toContain("HttpOnly");
      expect(header).toContain("SameSite=Lax");
      expect(header).toContain("Max-Age=86400");

      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = "production";
        const prodHeader = createDeviceCookieHeader(deviceId);
        expect(prodHeader).toContain("Secure");
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });

  describe("database rate limit integration tests", () => {
    let isDbAvailable = false;
    let poolInstance: any = null;
    const testPrefix = `test-limit-${Math.random().toString(36).slice(2, 10)}`;

    beforeAll(async () => {
      if (!process.env.DATABASE_URL) return;
      try {
        const { getPool } = await import("../app/db/client.server.js");
        poolInstance = getPool();
        await poolInstance.query("SELECT 1");
        isDbAvailable = true;
      } catch {
        isDbAvailable = false;
      }
    });

    afterAll(async () => {
      if (isDbAvailable && poolInstance) {
        try {
          await poolInstance.query("DELETE FROM rate_limits WHERE key LIKE 'test-limit-%'");
        } catch (e) {
          console.error("Cleanup error in rate limit afterAll:", e);
        } finally {
          try {
            await poolInstance.end();
          } catch {}
        }
      }
    });

    it("the 6th report in the window is blocked and allowed after it", async (ctx) => {
      if (!isDbAvailable) {
        ctx.skip();
        return;
      }

      const key = `${testPrefix}-window`;
      const windowSeconds = 600;
      const limit = 5;
      const baseTime = new Date("2026-10-20T12:00:00Z");

      // 1 to 5 should be allowed
      for (let i = 1; i <= limit; i++) {
        const res = await checkRateLimit(key, limit, windowSeconds, baseTime);
        expect(res.allowed).toBe(true);
        expect(res.count).toBe(i);
      }

      // 6th call in same window must be blocked
      const blocked = await checkRateLimit(key, limit, windowSeconds, baseTime);
      expect(blocked.allowed).toBe(false);
      expect(blocked.count).toBe(6);

      // Advance time past window (10 minutes later)
      const afterWindowTime = new Date(baseTime.getTime() + (windowSeconds + 1) * 1000);

      // 7th call in the new window is allowed again
      const afterWindow = await checkRateLimit(key, limit, windowSeconds, afterWindowTime);
      expect(afterWindow.allowed).toBe(true);
      expect(afterWindow.count).toBe(1);
    });

    it("per-device limit blocks the 6th report while a second device is allowed", async (ctx) => {
      if (!isDbAvailable) {
        ctx.skip();
        return;
      }

      const deviceAKey = `${testPrefix}-deviceA`;
      const deviceBKey = `${testPrefix}-deviceB`;
      const windowSeconds = 600;
      const limit = 5;
      const now = new Date("2026-10-20T12:00:00Z");

      // Device A submits 5 times
      for (let i = 1; i <= limit; i++) {
        const resA = await checkRateLimit(deviceAKey, limit, windowSeconds, now);
        expect(resA.allowed).toBe(true);
        expect(resA.count).toBe(i);
      }

      // Device A's 6th submission is blocked
      const blockedA = await checkRateLimit(deviceAKey, limit, windowSeconds, now);
      expect(blockedA.allowed).toBe(false);
      expect(blockedA.count).toBe(6);

      // Device B is on the same network/time, but has its own device limit: allowed!
      const resB = await checkRateLimit(deviceBKey, limit, windowSeconds, now);
      expect(resB.allowed).toBe(true);
      expect(resB.count).toBe(1);
    });
  });
});
