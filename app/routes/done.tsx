import { Link } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/done";

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
    <main style={{ textAlign: "center", paddingTop: "32px" }}>
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          background: "var(--hover-bg)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "16px",
          fontSize: "1.5rem",
        }}
      >
        ✓
      </div>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 600, letterSpacing: "-0.03em", marginBottom: "8px" }}>
        Feedback received.
      </h1>
      <p style={{ color: "var(--text-dim)", fontSize: "1rem", marginBottom: "28px" }}>
        Your report has been submitted anonymously.
      </p>

      {/* Code card */}
      <div
        className="voss-panel"
        style={{
          margin: "0 auto 28px auto",
          maxWidth: "420px",
          padding: "24px",
        }}
      >
        <div
          style={{
            fontSize: "0.82rem",
            color: "var(--text-dim)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "8px",
            fontFamily: "var(--font-mono)",
          }}
        >
          Your Reference Code
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "1.75rem",
            fontWeight: 600,
            color: "var(--text)",
            letterSpacing: "-0.02em",
            marginBottom: "16px",
            userSelect: "all",
          }}
        >
          {code}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="voss-btn-ghost"
          style={{ width: "100%", minHeight: "44px" }}
        >
          {copied ? "✓ Copied to clipboard" : "Copy code"}
        </button>
      </div>

      <p
        style={{
          color: "var(--text-dim)",
          fontSize: "0.92rem",
          maxWidth: "440px",
          margin: "0 auto 32px auto",
          lineHeight: 1.5,
        }}
      >
        Save this code. You can use it anytime on the status page to see if your feedback has been reviewed or resolved.
      </p>

      <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
        <Link to={`/status?code=${encodeURIComponent(code)}`} className="voss-btn-ghost">
          Check status now
        </Link>
        <Link to="/" className="voss-btn-primary">
          Send another
        </Link>
      </div>
    </main>
  );
}
