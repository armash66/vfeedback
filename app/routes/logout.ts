import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { getAuth } from "~/lib/auth.server";
import { clearPersonaCookieHeader } from "~/lib/dev-auth.server";

function isOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const appUrl = process.env.APP_URL || "http://localhost:5173";
  try {
    const originUrl = new URL(origin);
    const configuredUrl = new URL(appUrl);
    return originUrl.host === configuredUrl.host;
  } catch {
    return false;
  }
}

export async function loader() {
  throw redirect("/");
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    throw new Response("Method Not Allowed", { status: 405 });
  }

  if (!isOriginAllowed(request)) {
    throw new Response("Forbidden: Invalid Origin", { status: 403 });
  }

  const auth = getAuth();
  try {
    await auth.api.signOut({
      headers: request.headers,
    });
  } catch {
    // Non-fatal if session was not found or already invalid
  }

  return redirect("/", {
    headers: {
      "Set-Cookie": clearPersonaCookieHeader(),
    },
  });
}
