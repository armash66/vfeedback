import { useState } from "react";
import { Form, redirect, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { ArrowRight, ShieldCheck, User } from "lucide-react";
import { authClient } from "~/lib/auth-client";
import { mapAuthErrorCode } from "~/lib/auth-errors";
import { isVossConfigured } from "~/lib/auth.server";
import { safeReturnPath } from "~/lib/auth-redirect";
import { getSession } from "~/lib/session.server";
import { createPersonaCookieHeader, devAuthEnabled } from "~/lib/dev-auth.server";
import { DEV_PERSONAS, findPersona } from "~/lib/dev-personas";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getSession(request);
  const url = new URL(request.url);
  const next = safeReturnPath(url.searchParams.get("next"));

  if (user) {
    throw redirect(next);
  }

  const rawErrorCode = url.searchParams.get("error");
  if (rawErrorCode) {
    console.warn(`[auth] sign-in error code: ${rawErrorCode}`);
  }
  const authError = mapAuthErrorCode(rawErrorCode);

  const vossConfigured = isVossConfigured();
  const devAuth = devAuthEnabled();

  return {
    vossConfigured,
    devAuth,
    personas: devAuth ? DEV_PERSONAS : [],
    next,
    authError,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  if (!devAuthEnabled()) {
    throw new Response("Dev sign-in is disabled", { status: 400 });
  }

  const formData = await request.formData();
  const personaKey = formData.get("persona");
  const next = safeReturnPath(formData.get("next"));

  const persona = findPersona(typeof personaKey === "string" ? personaKey : null);
  if (!persona) {
    throw new Response("Unknown persona", { status: 400 });
  }

  const cookieHeader = createPersonaCookieHeader(persona.key);
  return redirect(next, {
    headers: {
      "Set-Cookie": cookieHeader,
    },
  });
}

export default function LoginPage() {
  const { vossConfigured, devAuth, personas, next, authError } = useLoaderData<typeof loader>();
  const [loading, setLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const displayedError = authError || clientError;

  const handleVossSignIn = async () => {
    setClientError(null);
    setLoading(true);
    try {
      const { error: signInError } = await authClient.signIn.oauth2({
        providerId: "voss",
        callbackURL: next,
      });
      if (signInError) {
        setClientError(signInError.message || "Could not reach VOSS. Try again in a moment.");
      }
    } catch {
      setClientError("Could not reach VOSS. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-12">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Sign in to VFeedback</CardTitle>
          <CardDescription>Sign in with your Vidyalankar college account through VOSS.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {displayedError && (
            <div
              className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {displayedError}
            </div>
          )}

          {!vossConfigured && (
            <div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
              Sign-in is not configured. VOSS OAuth keys are not set in the environment.
            </div>
          )}

          <Button
            type="button"
            className="w-full h-11"
            disabled={!vossConfigured || loading}
            onClick={handleVossSignIn}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            {loading ? "Connecting to VOSS..." : "Sign in with VOSS"}
          </Button>
        </CardContent>
      </Card>

      {devAuth && (
        <Card className="border-dashed">
          <CardHeader>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <User className="h-4 w-4" />
              Development Personas
            </div>
            <CardDescription>Select a seeded test persona for local development.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {personas.map((persona) => (
              <Form key={persona.key} method="post" className="w-full">
                <input type="hidden" name="persona" value={persona.key} />
                <input type="hidden" name="next" value={next} />
                <button
                  type="submit"
                  className="flex w-full items-center justify-between rounded-md border border-border bg-card p-3 text-left transition hover:bg-accent"
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{persona.name}</div>
                    <div className="text-xs text-muted-foreground">{persona.email}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{persona.description}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </Form>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
