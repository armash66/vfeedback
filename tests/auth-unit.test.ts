import { describe, expect, it } from "vitest";
import { safeReturnPath } from "~/lib/auth-redirect";
import {
  CANONICAL_VOSS_DISCOVERY_URL,
  deriveNameFromEmail,
  isVossConfigured,
  mapProfileToUser,
} from "~/lib/auth.server";
import { devAuthEnabled, signPersonaCookie, verifyPersonaCookie } from "~/lib/dev-auth.server";
import { DEV_PERSONAS, findPersona } from "~/lib/dev-personas";

describe("safeReturnPath", () => {
  it("defaults to / when value is missing, empty, or not a string", () => {
    expect(safeReturnPath(undefined)).toBe("/");
    expect(safeReturnPath(null)).toBe("/");
    expect(safeReturnPath("")).toBe("/");
    expect(safeReturnPath(123)).toBe("/");
    expect(safeReturnPath({})).toBe("/");
  });

  it("defaults to / for external or protocol-relative URLs", () => {
    expect(safeReturnPath("https://external.example.com/foo")).toBe("/");
    expect(safeReturnPath("http://evil.test")).toBe("/");
    expect(safeReturnPath("//external.example.com")).toBe("/");
    expect(safeReturnPath("/\\external.example.com")).toBe("/");
    expect(safeReturnPath("javascript:alert(1)")).toBe("/");
  });

  it("defaults to / when string contains backslashes or control characters", () => {
    expect(safeReturnPath("/foo\\bar")).toBe("/");
    expect(safeReturnPath("/foo\u0000bar")).toBe("/");
    expect(safeReturnPath("/foo\nbar")).toBe("/");
    expect(safeReturnPath("/foo\u007F")).toBe("/");
  });

  it("preserves safe relative paths", () => {
    expect(safeReturnPath("/")).toBe("/");
    expect(safeReturnPath("/status?code=spicy-samosa-k7q4mz")).toBe("/status?code=spicy-samosa-k7q4mz");
    expect(safeReturnPath("/report/rate")).toBe("/report/rate");
  });
});

describe("isVossConfigured", () => {
  it("returns false when any of the three VOSS settings are missing", () => {
    expect(isVossConfigured({})).toBe(false);
    expect(
      isVossConfigured({
        VOSS_DISCOVERY_URL: CANONICAL_VOSS_DISCOVERY_URL,
      }),
    ).toBe(false);
    expect(
      isVossConfigured({
        VOSS_DISCOVERY_URL: CANONICAL_VOSS_DISCOVERY_URL,
        VOSS_CLIENT_ID: "client-id",
      }),
    ).toBe(false);
    expect(
      isVossConfigured({
        VOSS_CLIENT_ID: "client-id",
        VOSS_CLIENT_SECRET: "client-secret",
      }),
    ).toBe(false);
  });

  it("returns false when discovery URL is non-canonical", () => {
    expect(
      isVossConfigured({
        VOSS_DISCOVERY_URL: "https://evil.test/.well-known/openid-configuration",
        VOSS_CLIENT_ID: "client-id",
        VOSS_CLIENT_SECRET: "client-secret",
      }),
    ).toBe(false);
  });

  it("returns true only when canonical discovery URL and both client credentials are present", () => {
    expect(
      isVossConfigured({
        VOSS_DISCOVERY_URL: CANONICAL_VOSS_DISCOVERY_URL,
        VOSS_CLIENT_ID: "my-voss-client-id",
        VOSS_CLIENT_SECRET: "my-voss-client-secret",
      }),
    ).toBe(true);
  });
});

describe("deriveNameFromEmail", () => {
  it("converts dot, underscore, and dash separated local parts into title-cased names", () => {
    expect(deriveNameFromEmail("harshal.more@vit.edu.in")).toBe("Harshal More");
    expect(deriveNameFromEmail("priya_nair@vosslabs.org")).toBe("Priya Nair");
    expect(deriveNameFromEmail("john-smith@example.test")).toBe("John Smith");
    expect(deriveNameFromEmail("single@example.test")).toBe("Single");
  });
});

describe("mapProfileToUser", () => {
  it("rejects profile with missing email", () => {
    expect(() =>
      mapProfileToUser({
        name: "Anonymous",
        emailVerified: true,
      }),
    ).toThrow();
  });

  it("rejects profile with unverified email", () => {
    expect(() =>
      mapProfileToUser({
        email: "student@vit.edu.in",
        emailVerified: false,
      }),
    ).toThrow();

    expect(() =>
      mapProfileToUser({
        email: "student@vit.edu.in",
        email_verified: false,
      }),
    ).toThrow();

    expect(() =>
      mapProfileToUser({
        email: "student@vit.edu.in",
      }),
    ).toThrow();
  });

  it("uses trimmed profile name when present", () => {
    const result = mapProfileToUser({
      name: "  Ada Lovelace  ",
      email: "ada.lovelace@vit.edu.in",
      email_verified: true,
    });
    expect(result).toEqual({
      name: "Ada Lovelace",
      email: "ada.lovelace@vit.edu.in",
      emailVerified: true,
    });
  });

  it("derives name from email when profile name is missing or empty", () => {
    const result = mapProfileToUser({
      email: "alan.turing@vosslabs.org",
      emailVerified: true,
    });
    expect(result).toEqual({
      name: "Alan Turing",
      email: "alan.turing@vosslabs.org",
      emailVerified: true,
    });

    const emptyNameResult = mapProfileToUser({
      name: "   ",
      email: "grace_hopper@vit.edu.in",
      emailVerified: true,
    });
    expect(emptyNameResult).toEqual({
      name: "Grace Hopper",
      email: "grace_hopper@vit.edu.in",
      emailVerified: true,
    });
  });

  it("does not re-check email domain since VAuth enforces it", () => {
    const vit = mapProfileToUser({
      email: "student@vit.edu.in",
      emailVerified: true,
    });
    expect(vit.email).toBe("student@vit.edu.in");

    const vosslabs = mapProfileToUser({
      email: "staff@vosslabs.org",
      emailVerified: true,
    });
    expect(vosslabs.email).toBe("staff@vosslabs.org");
  });
});

describe("Dev Personas & Safeguards", () => {
  it("provides student-a and student-b personas on example.test addresses", () => {
    expect(DEV_PERSONAS).toHaveLength(2);
    const studentA = findPersona("student-a");
    const studentB = findPersona("student-b");

    expect(studentA).toBeDefined();
    expect(studentA?.email).toBe("student.a@example.test");

    expect(studentB).toBeDefined();
    expect(studentB?.email).toBe("student.b@example.test");
  });

  it("signs and verifies persona cookie with HMAC", () => {
    const cookie = signPersonaCookie("student-a");
    expect(cookie).toContain("student-a.");

    const verified = verifyPersonaCookie(cookie);
    expect(verified?.key).toBe("student-a");

    // Tampered cookie fails
    const tampered = cookie.replace("student-a", "student-b");
    expect(verifyPersonaCookie(tampered)).toBeNull();

    // Invalid signature fails
    expect(verifyPersonaCookie("student-a.deadbeef")).toBeNull();
  });

  it("refuses dev auth in production", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalDev = process.env.VFEEDBACK_DEV_AUTH;
    try {
      process.env.NODE_ENV = "production";
      process.env.VFEEDBACK_DEV_AUTH = "1";
      expect(() => devAuthEnabled()).toThrow("VFEEDBACK_DEV_AUTH cannot be enabled in production");
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.VFEEDBACK_DEV_AUTH = originalDev;
    }
  });
});

describe("mapAuthErrorCode", () => {
  it("returns null for missing, empty, or whitespace-only error codes", async () => {
    const { mapAuthErrorCode } = await import("~/lib/auth-errors");
    expect(mapAuthErrorCode(undefined)).toBeNull();
    expect(mapAuthErrorCode(null)).toBeNull();
    expect(mapAuthErrorCode("")).toBeNull();
    expect(mapAuthErrorCode("   ")).toBeNull();
  });

  it("maps known error codes to short, calm messages (case-insensitive)", async () => {
    const { mapAuthErrorCode } = await import("~/lib/auth-errors");

    expect(mapAuthErrorCode("INVALID_OAUTH_CONFIGURATION")).toBe(
      "Sign-in configuration is unavailable. Please notify an administrator.",
    );
    expect(mapAuthErrorCode("invalid_oauth_configuration")).toBe(
      "Sign-in configuration is unavailable. Please notify an administrator.",
    );
    expect(mapAuthErrorCode("account_not_linked")).toBe(
      "This email is already associated with another sign-in method.",
    );
    expect(mapAuthErrorCode("name_is_missing")).toBe("Your account profile did not provide a display name.");
    expect(mapAuthErrorCode("access_denied")).toBe("Sign-in was cancelled or access was denied.");
  });

  it("maps any state or issuer mismatch error to calm verification message", async () => {
    const { mapAuthErrorCode } = await import("~/lib/auth-errors");

    expect(mapAuthErrorCode("state_mismatch")).toBe("Sign-in could not be verified. Please try again.");
    expect(mapAuthErrorCode("invalid_state")).toBe("Sign-in could not be verified. Please try again.");
    expect(mapAuthErrorCode("state_not_found")).toBe("Sign-in could not be verified. Please try again.");
    expect(mapAuthErrorCode("issuer_mismatch")).toBe("Sign-in could not be verified. Please try again.");
    expect(mapAuthErrorCode("issuer_missing")).toBe("Sign-in could not be verified. Please try again.");
  });

  it("maps unknown or arbitrary codes to generic fallback without echoing raw value", async () => {
    const { mapAuthErrorCode } = await import("~/lib/auth-errors");

    const fallback = "Sign-in did not complete. Please try again.";
    expect(mapAuthErrorCode("UNKNOWN_CODE")).toBe(fallback);
    expect(mapAuthErrorCode("<script>alert('xss')</script>")).toBe(fallback);
    expect(mapAuthErrorCode("internal_server_error_500")).toBe(fallback);
  });
});

describe("getAuthOptions hardening", () => {
  it("configures cookieCache, onAPIError, disabled IP tracking, and session create hook", async () => {
    const { getAuthOptions } = await import("~/lib/auth.server");
    const options = getAuthOptions({
      APP_URL: "http://localhost:5173",
      BETTER_AUTH_SECRET: "test-secret-at-least-32-chars-long-123456",
    });

    expect(options.session?.cookieCache).toEqual({
      enabled: true,
      maxAge: 300,
    });
    expect(options.onAPIError?.errorURL).toBe("/login");
    expect(options.advanced?.ipAddress?.disableIpTracking).toBe(true);

    const hook = options.databaseHooks?.session?.create?.before;
    expect(hook).toBeDefined();

    const mockSession = {
      id: "session-1",
      userId: "user-1",
      token: "tok-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(),
      ipAddress: "198.51.100.1",
      userAgent: "Mozilla/5.0 Test",
    };

    const result = await hook!(mockSession, null);
    expect(result).toEqual({
      data: {
        ...mockSession,
        ipAddress: null,
        userAgent: null,
      },
    });
  });
});

describe("Cache-Control headers", () => {
  it("entry.server sets private, no-store Cache-Control header for document responses", async () => {
    const { default: handleRequest } = await import("~/entry.server");
    const request = new Request("http://localhost:5173/", { method: "HEAD" });
    const response = handleRequest(request, 200, new Headers(), {} as any, {} as any) as Response;

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("api.auth.$ route specifies private, no-store Cache-Control", async () => {
    const { headers: authHeaders } = await import("~/routes/api.auth.$");
    const headers = (authHeaders as () => HeadersInit)();
    const map = new Headers(headers);
    expect(map.get("Cache-Control")).toBe("private, no-store");
  });
});
