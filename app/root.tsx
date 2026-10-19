import { isRouteErrorResponse, Link, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { useEffect, useState } from "react";
import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>VFeedback — Vidyalankar Institute of Technology</title>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('voss-theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (saved === 'dark' || (!saved && prefersDark)) {
                    document.documentElement.setAttribute('data-theme', 'dark');
                  } else {
                    document.documentElement.removeAttribute('data-theme');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Header />
        <div className="voss-container" style={{ paddingTop: "24px", paddingBottom: "64px" }}>
          {children}
        </div>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function Header() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("voss-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("voss-theme", "light");
    }
  };

  return (
    <header
      style={{
        height: "64px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        className="voss-container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            textDecoration: "none",
            color: "var(--text)",
            fontWeight: 700,
            fontSize: "1.25rem",
            letterSpacing: "-0.04em",
          }}
        >
          <span
            style={{
              width: "10px",
              height: "10px",
              background: "var(--brand-pure)",
              display: "inline-block",
            }}
            aria-hidden="true"
          />
          VFeedback
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link
            to="/status"
            className="voss-btn-ghost"
            style={{
              minHeight: "36px",
              padding: "6px 14px",
              fontSize: "0.88rem",
            }}
          >
            Check status
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            className="voss-btn-ghost"
            style={{
              minHeight: "36px",
              minWidth: "36px",
              padding: "6px 10px",
              fontSize: "0.88rem",
            }}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main style={{ padding: "32px 0" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "8px" }}>{message}</h1>
      <p style={{ color: "var(--text-dim)", marginBottom: "16px" }}>{details}</p>
      {stack && (
        <pre
          style={{
            background: "var(--code-bg)",
            padding: "16px",
            borderRadius: "var(--radius-sm)",
            overflowX: "auto",
            fontFamily: "var(--font-mono)",
            fontSize: "0.85rem",
          }}
        >
          <code>{stack}</code>
        </pre>
      )}
      <Link to="/" className="voss-btn-primary" style={{ marginTop: "16px" }}>
        Back to home
      </Link>
    </main>
  );
}
