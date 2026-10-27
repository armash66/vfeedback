import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { getAuth } from "~/lib/auth.server";

export const headers: HeadersFunction = () => {
  return {
    "Cache-Control": "private, no-store",
  };
};

async function handleAuth(request: Request) {
  const response = await getAuth().handler(request);
  try {
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "private, no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  return handleAuth(request);
}

export async function action({ request }: ActionFunctionArgs) {
  return handleAuth(request);
}
