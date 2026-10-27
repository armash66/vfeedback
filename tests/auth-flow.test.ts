import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTH_ORIGIN, authFlowFixture } from "./auth-flow.fixture";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Better Auth VOSS callback integration with mocked provider", () => {
  it("exchanges authorization code with PKCE and post authentication and creates session", async () => {
    const fixture = authFlowFixture();
    const completed = await fixture.callback();

    expect(completed.response.status).toBe(302);
    expect(new URL(completed.response.headers.get("location")!, AUTH_ORIGIN).href).toBe(`${AUTH_ORIGIN}/`);

    expect(completed.authorization.searchParams.get("redirect_uri")).toBe(
      `${AUTH_ORIGIN}/api/auth/oauth2/callback/voss`,
    );
    expect(completed.authorization.searchParams.get("scope")).toBe("openid profile email");
    expect(completed.authorization.searchParams.get("code_challenge_method")).toBe("S256");

    const token = fixture.tokenRequests[0];
    expect(token.get("client_id")).toBe("fixture-client");
    expect(token.get("client_secret")).toBe("fixture-client-secret");
    expect(token.get("redirect_uri")).toBe(`${AUTH_ORIGIN}/api/auth/oauth2/callback/voss`);

    const challenge = createHash("sha256").update(token.get("code_verifier")!).digest("base64url");
    expect(challenge).toBe(completed.authorization.searchParams.get("code_challenge"));

    const session = await fixture.auth.api.getSession({
      headers: new Headers({ cookie: completed.sessionCookie }),
    });
    expect(session?.user).toMatchObject({
      email: "staff.person@vit.edu.in",
      emailVerified: true,
      name: "Staff Person",
    });

    expect(fixture.store.user).toHaveLength(1);
    expect(fixture.store.account[0]).toMatchObject({
      providerId: "voss",
      accountId: "voss-subject",
      userId: session?.user.id,
    });
    expect(fixture.store.session).toHaveLength(1);
    expect(fixture.store.session[0].ipAddress).toBeNull();
    expect(fixture.store.session[0].userAgent).toBeNull();
  });

  it("forces ipAddress and userAgent to null on created session", async () => {
    const fixture = authFlowFixture();
    const completed = await fixture.callback();

    expect(completed.response.status).toBe(302);
    expect(fixture.store.session).toHaveLength(1);
    const createdSession = fixture.store.session[0];
    expect(createdSession.ipAddress).toBeNull();
    expect(createdSession.userAgent).toBeNull();
  });

  it("retains the same local user across repeat callbacks", async () => {
    const fixture = authFlowFixture({ idToken: true });
    const first = await fixture.callback();
    const id = fixture.store.user[0]?.id;

    expect(first.response.status).toBe(302);
    const second = await fixture.callback();
    expect(second.response.status).toBe(302);

    expect(fixture.store.user).toHaveLength(1);
    expect(fixture.store.user[0].id).toBe(id);
    expect(fixture.store.account).toHaveLength(1);
  });

  it("links a matching verified local account without duplicate user rows", async () => {
    const fixture = authFlowFixture({ existingVerified: true });
    expect((await fixture.callback()).response.status).toBe(302);
    expect(fixture.store.user).toHaveLength(1);
    expect(fixture.store.account[0].userId).toBe("existing-local-user");
  });

  it("retains the verified-local-account requirement", async () => {
    const fixture = authFlowFixture({ existingVerified: false });
    const { response } = await fixture.callback();
    expect(response.headers.get("location")).toContain("account_not_linked");
    expect(fixture.store.account).toHaveLength(0);
    expect(fixture.store.session).toHaveLength(0);
  });

  it("denies unverified provider identity", async () => {
    const fixture = authFlowFixture({ profile: { email_verified: false } });
    const { response } = await fixture.callback();
    expect(response.status).toBe(403);
    expect(fixture.store.account).toHaveLength(0);
    expect(fixture.store.session).toHaveLength(0);
  });

  it.each([null, "https://other.example/api/auth"])(
    "rejects missing or mismatched issuer response before code exchange",
    async (issuer) => {
      const fixture = authFlowFixture();
      const { response } = await fixture.callback({ issuer });
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toContain(issuer ? "issuer_mismatch" : "issuer_missing");
      expect(fixture.tokenRequests).toHaveLength(0);
      expect(fixture.store.session).toHaveLength(0);
    },
  );

  it("rejects invalid state before token exchange", async () => {
    const fixture = authFlowFixture();
    const { response } = await fixture.callback({ wrongState: true });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toMatch(/state/);
    expect(fixture.tokenRequests).toHaveLength(0);
    expect(fixture.store.session).toHaveLength(0);
  });

  it("does not expose password sign-in as another authentication path", async () => {
    const fixture = authFlowFixture();
    for (const path of ["sign-up/email", "sign-in/email"]) {
      const response = await fixture.auth.handler(
        new Request(`${AUTH_ORIGIN}/api/auth/${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: AUTH_ORIGIN },
          body: JSON.stringify({
            email: "staff@vit.edu.in",
            name: "Staff",
            password: "fixture-password",
          }),
        }),
      );
      expect(response.status).not.toBe(200);
    }
    expect(fixture.store.user).toHaveLength(0);
    expect(fixture.store.session).toHaveLength(0);
    expect(fixture.fetchMock).not.toHaveBeenCalled();
  });

  it("retains ordinary session reads when the VOSS provider is unconfigured", async () => {
    const fixture = authFlowFixture({ unconfigured: true });
    expect(await fixture.auth.api.getSession({ headers: new Headers() })).toBeNull();
    expect(fixture.fetchMock).not.toHaveBeenCalled();
    expect(fixture.store.user).toHaveLength(0);
  });

  it.each(["//external.example", "/\\external.example", "https://external.example"])(
    "rejects a crafted offsite callback at the library boundary",
    async (callbackURL) => {
      const fixture = authFlowFixture();
      const response = await fixture.auth.handler(
        new Request(`${AUTH_ORIGIN}/api/auth/sign-in/oauth2`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: AUTH_ORIGIN },
          body: JSON.stringify({ providerId: "voss", callbackURL }),
        }),
      );
      expect(response.status).toBe(403);
      expect(fixture.fetchMock).not.toHaveBeenCalled();
      expect(fixture.store.session).toHaveLength(0);
    },
  );
});
