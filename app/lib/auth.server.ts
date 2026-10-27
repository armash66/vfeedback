import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { genericOAuth } from "better-auth/plugins";
import type { GenericOAuthConfig } from "better-auth/plugins/generic-oauth";
import { getDb } from "~/db/client.server";
import * as schema from "~/db/schema";

export const CANONICAL_VOSS_DISCOVERY_URL = "https://accounts.vosslabs.org/api/auth/.well-known/openid-configuration";
export const VOSS_ISSUER = "https://accounts.vosslabs.org/api/auth";
export const VOSS_UNAVAILABLE = "VOSS sign-in is currently unavailable.";

export function isVossConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    process.loadEnvFile?.(".env");
  } catch {}
  const discovery = env.VOSS_DISCOVERY_URL?.trim();
  const clientId = env.VOSS_CLIENT_ID?.trim();
  const clientSecret = env.VOSS_CLIENT_SECRET?.trim();
  return discovery === CANONICAL_VOSS_DISCOVERY_URL && Boolean(clientId) && Boolean(clientSecret);
}

export function deriveNameFromEmail(email: string): string {
  const local = email?.split("@")[0] ?? "";
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ") || email
  );
}

export function mapProfileToUser(profile: Record<string, unknown>) {
  const email = typeof profile.email === "string" ? profile.email.trim().toLowerCase() : "";
  if (!email) {
    throw new APIError("FORBIDDEN", {
      code: "VOSS_IDENTITY_NOT_ALLOWED",
      message: "Sign in with a valid account.",
    });
  }

  const verifiedValues = [profile.emailVerified, profile.email_verified].filter((v) => v !== undefined);
  if (!verifiedValues.length || verifiedValues.some((v) => v !== true)) {
    throw new APIError("FORBIDDEN", {
      code: "VOSS_IDENTITY_NOT_ALLOWED",
      message: "Sign in with a verified account.",
    });
  }

  const name = (typeof profile.name === "string" && profile.name.trim()) || deriveNameFromEmail(email);

  return {
    email,
    emailVerified: true,
    name,
  };
}

export function vossOAuthConfig(env: NodeJS.ProcessEnv = process.env): GenericOAuthConfig | null {
  if (!isVossConfigured(env)) {
    return null;
  }
  return {
    providerId: "voss",
    discoveryUrl: env.VOSS_DISCOVERY_URL!.trim(),
    clientId: env.VOSS_CLIENT_ID!.trim(),
    clientSecret: env.VOSS_CLIENT_SECRET!.trim(),
    scopes: ["openid", "profile", "email"],
    pkce: true,
    authentication: "post",
    requireIssuerValidation: true,
    mapProfileToUser,
  };
}

export function getAuthOptions(env: NodeJS.ProcessEnv = process.env): BetterAuthOptions {
  const appUrl = env.APP_URL || "http://localhost:5173";
  const baseURL = env.BETTER_AUTH_URL || appUrl;
  const oauthConfig = vossOAuthConfig(env);

  return {
    baseURL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [appUrl],
    onAPIError: {
      errorURL: "/login",
    },
    advanced: {
      ipAddress: {
        disableIpTracking: true,
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            return {
              data: {
                ...session,
                ipAddress: null,
                userAgent: null,
              },
            };
          },
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
      cookieCache: {
        enabled: true,
        maxAge: 300, // 300 seconds
      },
    },
    emailAndPassword: {
      enabled: false,
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ["voss"],
        allowDifferentEmails: false,
        requireLocalEmailVerified: true,
      },
    },
    plugins: oauthConfig ? [genericOAuth({ config: [oauthConfig] })] : [],
  };
}

function createAuth() {
  return betterAuth({
    ...getAuthOptions(),
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema,
    }),
  });
}

export type AuthInstance = ReturnType<typeof createAuth>;
let authInstance: AuthInstance | null = null;

export function getAuth(): AuthInstance {
  if (!authInstance) {
    authInstance = createAuth();
  }
  return authInstance;
}

export function resetAuthForTesting() {
  authInstance = null;
}
