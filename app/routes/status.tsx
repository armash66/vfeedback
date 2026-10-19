import { Form, Link, useSearchParams } from "react-router";
import { getReportStatus } from "../lib/reports.server.js";
import type { Route } from "./+types/status";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code || !code.trim()) {
    return { searched: false, report: null, code: "" };
  }

  const cleanCode = code.trim().toLowerCase();
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
  };
}

const STATUS_LABELS: Record<string, { label: string; text: string }> = {
  new: { label: "NEW", text: "Received and awaiting review" },
  in_progress: { label: "IN PROGRESS", text: "Currently being looked into" },
  resolved: { label: "RESOLVED", text: "Addressed and resolved" },
  rejected: { label: "REJECTED", text: "Closed or not actionable" },
};

export default function StatusPage({ loaderData }: Route.ComponentProps) {
  const { searched, code, report } = loaderData;
  const [searchParams] = useSearchParams();

  return (
    <main>
      <div style={{ marginBottom: "28px" }}>
        <Link
          to="/"
          style={{
            fontSize: "0.88rem",
            color: "var(--text-dim)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            marginBottom: "12px",
          }}
        >
          ← Back to home
        </Link>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 600, letterSpacing: "-0.03em" }}>Check report status</h1>
        <p style={{ color: "var(--text-dim)", fontSize: "0.95rem" }}>
          Enter the reference code you received when submitting feedback.
        </p>
      </div>

      <Form method="get" style={{ marginBottom: "36px" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input
            type="text"
            name="code"
            defaultValue={code || searchParams.get("code") || ""}
            placeholder="e.g. spicy-samosa-42"
            className="voss-input"
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            style={{
              flex: "1 1 240px",
              fontFamily: "var(--font-mono)",
            }}
          />
          <button type="submit" className="voss-btn-primary" style={{ flex: "0 0 auto" }}>
            Check status
          </button>
        </div>
      </Form>

      {searched && (
        <section>
          {report ? (
            <div className="voss-panel">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.88rem", color: "var(--text-dim)" }}>
                  Report: <strong style={{ color: "var(--text)" }}>{code}</strong>
                </div>
                <div className="voss-badge-mono">
                  {STATUS_LABELS[report.status]?.label || report.status.toUpperCase()}
                </div>
              </div>

              <div style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "8px" }}>
                {STATUS_LABELS[report.status]?.text || report.status}
              </div>

              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.8rem",
                  color: "var(--text-dim)",
                }}
              >
                Submitted: {new Date(report.createdAt).toLocaleDateString()}
              </div>
            </div>
          ) : (
            <div className="voss-panel" style={{ textAlign: "center", padding: "32px 20px" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "8px" }}>Report not found</div>
              <p style={{ color: "var(--text-dim)", fontSize: "0.92rem", margin: 0 }}>
                We could not find any report with the code{" "}
                <code style={{ fontFamily: "var(--font-mono)" }}>{code}</code>. Please double-check the spelling and
                digits.
              </p>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
