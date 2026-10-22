import { Form, Link, useSearchParams } from "react-router";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { StatusBadge, getStatusText } from "../components/StatusBadge.js";
import { getReportStatus } from "../lib/reports.server.js";
import type { Route } from "./+types/status";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { EmptyState } from "~/components/empty-state";
import { PageHeader } from "~/components/page-header";
import { formatDate } from "~/lib/format";

import {
  checkRateLimit,
  getClientAddress,
  getRateLimitKey,
  TOO_MANY_REQUESTS_MESSAGE,
} from "../lib/rate-limit.server.js";

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Check report status | vfeedback" },
    {
      name: "description",
      content: "Check the status of your anonymous campus feedback report.",
    },
  ];
};

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code || !code.trim()) {
    return { searched: false, report: null, code: "", error: null };
  }

  const cleanCode = code.trim().toLowerCase();

  // Check rate limit (600 requests per 10 minutes for shared networks)
  const clientAddress = getClientAddress(request);
  const rateLimitKey = getRateLimitKey("status", clientAddress);
  const rateLimit = await checkRateLimit(rateLimitKey, 600, 600);
  if (!rateLimit.allowed) {
    return {
      searched: true,
      code: cleanCode,
      report: null,
      error: TOO_MANY_REQUESTS_MESSAGE,
    };
  }

  const report = await getReportStatus(cleanCode);

  return {
    searched: true,
    code: cleanCode,
    report: report
      ? {
          status: report.status,
          createdAt: report.createdAt.toISOString(),
        }
      : null,
    error: null,
  };
}

export default function StatusPage({ loaderData }: Route.ComponentProps) {
  const { searched, code, report, error } = loaderData;
  const [searchParams] = useSearchParams();

  return (
    <div className="grid grid-cols-1 items-start gap-8 min-[900px]:grid-cols-[1fr_360px] min-[900px]:gap-12">
      {/* Main Column */}
      <div className="w-full max-w-[640px] space-y-6">
        <div>
          <Link
            to="/"
            className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to home
          </Link>
          <PageHeader
            title="Check report status"
            description="Enter the reference code you received when submitting feedback."
            eyebrow="Report status"
          />
        </div>

        <Form method="get" className="space-y-2">
          <Label htmlFor="status-code">Reference code</Label>
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <Input
              id="status-code"
              type="text"
              name="code"
              defaultValue={code || searchParams.get("code") || ""}
              placeholder="e.g. spicy-samosa-k7q4mz"
              className="font-mono flex-1 min-w-[240px]"
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
            />
            <Button type="submit" size="lg">
              Check status
            </Button>
          </div>
        </Form>

        {searched && (
          <section className="pt-2">
            {error ? (
              <div
                role="alert"
                className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm outline-none"
              >
                {error}
              </div>
            ) : report ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div className="text-muted-foreground text-sm">
                    Report: <strong className="text-foreground font-mono font-semibold">{code}</strong>
                  </div>
                  <StatusBadge status={report.status} />
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-base font-semibold">{getStatusText(report.status)}</p>
                  <p className="text-muted-foreground font-mono text-xs">Submitted: {formatDate(report.createdAt)}</p>
                </CardContent>
              </Card>
            ) : (
              <EmptyState
                icon={<FileQuestion className="size-5" aria-hidden />}
                title="Report not found"
                body={`We could not find any report with the code "${code}". Please double-check the spelling and digits.`}
              />
            )}
          </section>
        )}
      </div>

      {/* Sidebar Help Card */}
      <aside className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>About report statuses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <StatusBadge status="new" />
              </div>
              <p className="text-muted-foreground text-xs">Feedback was recorded and queued for staff review.</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <StatusBadge status="in_progress" />
              </div>
              <p className="text-muted-foreground text-xs">
                Staff are working on resolving the reported issue or suggestion.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <StatusBadge status="resolved" />
              </div>
              <p className="text-muted-foreground text-xs">The issue was fixed or the suggestion was implemented.</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <StatusBadge status="rejected" />
              </div>
              <p className="text-muted-foreground text-xs">Duplicate or cannot be acted upon.</p>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
