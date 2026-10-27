import { redirect } from "react-router";
import { getSessionCookie } from "better-auth/cookies";
import { getAuth } from "./auth.server.js";
import { getDevIdentityFromRequest } from "./dev-auth.server.js";
import { safeReturnPath } from "./auth-redirect.js";

export type SessionUser = {
  userId: string;
  email: string;
  name: string;
};

export async function getSession(request: Request): Promise<SessionUser | null> {
  const devIdentity = getDevIdentityFromRequest(request);
  if (devIdentity) {
    return devIdentity;
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return null;
  }

  const auth = getAuth();
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return null;
  }

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
}

export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await getSession(request);
  if (!user) {
    const url = new URL(request.url);
    const returnPath = safeReturnPath(url.pathname + url.search);
    throw redirect(`/login?next=${encodeURIComponent(returnPath)}`);
  }
  return user;
}
