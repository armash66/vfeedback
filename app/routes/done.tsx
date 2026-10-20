import { Link } from "react-router";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { Route } from "./+types/done";
import { Button } from "~/components/ui/button";
import { buttonVariants } from "~/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Feedback received | vfeedback" },
    {
      name: "description",
      content: "Your anonymous feedback reference code.",
    },
  ];
};

export async function loader({ params }: Route.LoaderArgs) {
  const code = params.code;
  if (!code) {
    throw new Response("Not Found", { status: 404 });
  }
  return { code };
}

export default function DonePage({ loaderData }: Route.ComponentProps) {
  const { code } = loaderData;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="grid grid-cols-1 items-start gap-8 min-[900px]:grid-cols-[1fr_360px] min-[900px]:gap-12">
      {/* Main Column */}
      <div className="w-full max-w-[640px] space-y-6">
        <div className="bg-muted text-foreground flex size-12 items-center justify-center rounded-full">
          <Check className="size-6" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Feedback received.</h1>
          <p className="text-muted-foreground text-base leading-relaxed">
            Reports are anonymous. We do not store your name, roll number or IP address with your report.
          </p>
        </div>

        {/* Reference code Card */}
        <Card>
          <CardHeader>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Your Reference Code</p>
            <CardTitle className="font-mono text-2xl font-semibold tracking-tight select-all md:text-3xl">
              {code}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" size="lg" onClick={handleCopy} className="w-full gap-2">
              {copied ? (
                <>
                  <Check className="text-success size-4" aria-hidden />
                  <span>Copied to clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="size-4" aria-hidden />
                  <span>Copy code</span>
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Link
            to={`/status?code=${encodeURIComponent(code)}`}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Check status now
          </Link>
          <Link to="/" className={buttonVariants({ variant: "default", size: "lg" })}>
            Send another report
          </Link>
        </div>
      </div>

      {/* Sidebar Help Card */}
      <aside className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Keep your code handy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            <p className="text-foreground">
              Reports are anonymous. We do not store your name, roll number or IP address with your report.
            </p>
            <p className="text-muted-foreground">
              Staff will update the status once they review or take action on the place you reported.
            </p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
