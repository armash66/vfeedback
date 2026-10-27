import { beforeAll, describe, expect, it, vi } from "vitest";
import { getSession, requireUser } from "~/lib/session.server";
import { signPersonaCookie, DEV_PERSONA_COOKIE } from "~/lib/dev-auth.server";

describe("session.server", () => {
  beforeAll(() => {
    process.env.VFEEDBACK_DEV_AUTH = "1";
    process.env.NODE_ENV = "test";
    process.env.BETTER_AUTH_SECRET = "test-secret-at-least-32-chars-long-123456";
    process.env.APP_URL = "http://localhost:5173";
  });

  describe("requireUser outcomes", () => {
    it("redirects signed-out requests to /login with next parameter", async () => {
      const request = new Request("http://localhost:5173/report/rate");
      try {
        await requireUser(request);
        expect.fail("Should have thrown redirect");
      } catch (response: unknown) {
        expect(response).toBeInstanceOf(Response);
        const res = response as Response;
        expect(res.status).toBe(302);
        const location = res.headers.get("location");
        expect(location).toBe("/login?next=%2Freport%2Frate");
      }
    });

    it("defaults next parameter to / when request path is unsafe or external", async () => {
      const request = new Request("http://localhost:5173/\\evil.com");
      try {
        await requireUser(request);
        expect.fail("Should have thrown redirect");
      } catch (response: unknown) {
        expect(response).toBeInstanceOf(Response);
        const res = response as Response;
        expect(res.status).toBe(302);
        const location = res.headers.get("location");
        expect(location).toBe("/login?next=%2F");
      }
    });

    it("returns user identity when signed in via valid dev persona cookie", async () => {
      const cookie = signPersonaCookie("student-a");
      const request = new Request("http://localhost:5173/report/rate", {
        headers: {
          cookie: `${DEV_PERSONA_COOKIE}=${cookie}`,
        },
      });

      const user = await requireUser(request);
      expect(user).toEqual({
        userId: "dev-student-a",
        email: "student.a@example.test",
        name: "Student A",
      });
    });

    it("returns null session and redirects when dev persona cookie signature is tampered", async () => {
      const cookie = signPersonaCookie("student-a");
      const tamperedCookie = cookie.replace("student-a", "student-b");
      const request = new Request("http://localhost:5173/report/rate", {
        headers: {
          cookie: `${DEV_PERSONA_COOKIE}=${tamperedCookie}`,
        },
      });

      const session = await getSession(request);
      expect(session).toBeNull();

      await expect(requireUser(request)).rejects.toSatisfy((res: Response) => {
        return res.status === 302 && (res.headers.get("location")?.startsWith("/login") ?? false);
      });
    });

    it("returns student-b identity when signed in as student-b", async () => {
      const cookie = signPersonaCookie("student-b");
      const request = new Request("http://localhost:5173/report/rate", {
        headers: {
          cookie: `${DEV_PERSONA_COOKIE}=${cookie}`,
        },
      });

      const user = await requireUser(request);
      expect(user).toEqual({
        userId: "dev-student-b",
        email: "student.b@example.test",
        name: "Student B",
      });
    });
  });

  describe("zero database queries on missing session cookie", () => {
    it("makes zero database queries and returns null immediately when request has no cookie", async () => {
      const dbModule = await import("~/db/client.server.js");
      const getDbSpy = vi.spyOn(dbModule, "getDb");
      const getPoolSpy = vi.spyOn(dbModule, "getPool");

      getDbSpy.mockClear();
      getPoolSpy.mockClear();

      const request = new Request("http://localhost:5173/status");
      const session = await getSession(request);

      expect(session).toBeNull();
      expect(getDbSpy).toHaveBeenCalledTimes(0);
      expect(getPoolSpy).toHaveBeenCalledTimes(0);

      getDbSpy.mockRestore();
      getPoolSpy.mockRestore();
    });

    it("makes zero database queries when request has a tampered dev persona cookie and no session cookie", async () => {
      const dbModule = await import("~/db/client.server.js");
      const getDbSpy = vi.spyOn(dbModule, "getDb");
      const getPoolSpy = vi.spyOn(dbModule, "getPool");

      getDbSpy.mockClear();
      getPoolSpy.mockClear();

      const request = new Request("http://localhost:5173/status", {
        headers: {
          cookie: `${DEV_PERSONA_COOKIE}=tampered-invalid-cookie`,
        },
      });
      const session = await getSession(request);

      expect(session).toBeNull();
      expect(getDbSpy).toHaveBeenCalledTimes(0);
      expect(getPoolSpy).toHaveBeenCalledTimes(0);

      getDbSpy.mockRestore();
      getPoolSpy.mockRestore();
    });
  });
});
