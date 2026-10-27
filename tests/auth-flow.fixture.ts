import { betterAuth } from "better-auth";
import { memoryAdapter, type MemoryDB } from "better-auth/adapters/memory";
import { vi } from "vitest";
import { CANONICAL_VOSS_DISCOVERY_URL, getAuthOptions, VOSS_ISSUER } from "~/lib/auth.server";

export const AUTH_ORIGIN = "http://localhost:5173";
const TOKEN_URL = `${VOSS_ISSUER}/oauth2/token`;
const USERINFO_URL = `${VOSS_ISSUER}/oauth2/userinfo`;

export type ProviderProfile = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
};

function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

export function authFlowFixture(
  options: {
    profile?: Partial<ProviderProfile>;
    existingVerified?: boolean;
    idToken?: boolean;
    unconfigured?: boolean;
  } = {},
) {
  const profile: ProviderProfile = {
    sub: "voss-subject",
    email: "staff.person@vit.edu.in",
    email_verified: true,
    name: "Staff Person",
    ...options.profile,
  };

  const store: MemoryDB = {
    user: [],
    account: [],
    session: [],
    verification: [],
  };

  if (options.existingVerified !== undefined) {
    store.user.push({
      id: "existing-local-user",
      email: profile.email,
      emailVerified: options.existingVerified,
      name: "Existing Staff",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const tokenRequests: URLSearchParams[] = [];

  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === CANONICAL_VOSS_DISCOVERY_URL) {
      return Response.json({
        issuer: VOSS_ISSUER,
        authorization_endpoint: `${VOSS_ISSUER}/oauth2/authorize`,
        token_endpoint: TOKEN_URL,
        userinfo_endpoint: USERINFO_URL,
      });
    }
    if (url === TOKEN_URL) {
      tokenRequests.push(new URLSearchParams(String(init?.body)));
      const idToken = options.idToken
        ? [
            Buffer.from(JSON.stringify({ alg: "EdDSA" })).toString("base64url"),
            Buffer.from(
              JSON.stringify({
                ...profile,
                iss: VOSS_ISSUER,
                aud: "fixture-client",
              }),
            ).toString("base64url"),
            "fixture-signature",
          ].join(".")
        : undefined;
      return Response.json({
        access_token: "fixture-access",
        token_type: "Bearer",
        expires_in: 3600,
        ...(idToken ? { id_token: idToken } : {}),
      });
    }
    if (url === USERINFO_URL) {
      return Response.json(profile);
    }
    throw new Error(`Unexpected provider fetch: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);

  const baseOptions = getAuthOptions({
    APP_URL: AUTH_ORIGIN,
    BETTER_AUTH_URL: AUTH_ORIGIN,
    BETTER_AUTH_SECRET: "fixture-auth-secret-with-at-least-32-characters",
    VOSS_DISCOVERY_URL: CANONICAL_VOSS_DISCOVERY_URL,
    VOSS_CLIENT_ID: options.unconfigured ? "" : "fixture-client",
    VOSS_CLIENT_SECRET: options.unconfigured ? "" : "fixture-client-secret",
  });

  const auth = betterAuth({
    ...baseOptions,
    database: memoryAdapter(store),
    logger: { disabled: true },
    advanced: {
      ...baseOptions.advanced,
      disableOriginCheck: false,
      disableCSRFCheck: false,
    },
  });

  async function start() {
    const response = await auth.handler(
      new Request(`${AUTH_ORIGIN}/api/auth/sign-in/oauth2`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: AUTH_ORIGIN },
        body: JSON.stringify({
          providerId: "voss",
          callbackURL: "/",
          errorCallbackURL: "/login",
        }),
      }),
    );
    if (response.status !== 200) {
      throw new Error(`Sign-in start failed: ${response.status} ${await response.text()}`);
    }
    const { url } = (await response.json()) as { url: string };
    return { authorization: new URL(url), cookie: cookies(response) };
  }

  async function callback(opts: { issuer?: string | null; wrongState?: boolean } = {}) {
    const started = await start();
    const url = new URL(`${AUTH_ORIGIN}/api/auth/oauth2/callback/voss`);
    url.searchParams.set("code", "fixture-code");
    url.searchParams.set("state", opts.wrongState ? "invalid-state" : started.authorization.searchParams.get("state")!);
    if (opts.issuer !== null) {
      url.searchParams.set("iss", opts.issuer ?? VOSS_ISSUER);
    }
    const response = await auth.handler(new Request(url, { headers: { cookie: started.cookie } }));
    return { ...started, response, sessionCookie: cookies(response) };
  }

  return { auth, store, profile, fetchMock, tokenRequests, start, callback };
}
