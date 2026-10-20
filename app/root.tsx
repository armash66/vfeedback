import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useRouteLoaderData,
} from "react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, FileQuestion, Menu, MessageSquarePlus, Moon, Search, Sun } from "lucide-react";
import type { Route } from "./+types/root";
import "./app.css";
import { Button } from "~/components/ui/button";
import { buttonVariants } from "~/components/ui/button-variants";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { EmptyState } from "~/components/empty-state";
import { cn } from "~/lib/utils";
import { getAppUrl } from "~/lib/app-url";

export const links: Route.LinksFunction = () => [];

export async function loader() {
  return {
    appUrl: getAppUrl(),
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const loaderData = useRouteLoaderData<typeof loader>("root");
  const appUrl = loaderData?.appUrl || "http://localhost:5173";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <meta property="og:site_name" content="vfeedback" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${appUrl}/og.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${appUrl}/og.png`} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('voss-theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (saved === 'dark' || (!saved && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
        <Meta />
        <Links />
      </head>
      <body className="bg-background text-foreground flex min-h-screen flex-col antialiased">
        <a
          href="#content"
          className="focus:bg-background focus:text-foreground focus:ring-ring focus:border-border sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:border focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:outline-none focus:ring-2"
        >
          Skip to content
        </a>
        <Header />
        <main id="content" className="container flex-1 py-8 md:py-10">
          {children}
        </main>
        <Footer />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

const navLinks = [
  { href: "/", label: "Report", icon: MessageSquarePlus },
  { href: "/status", label: "Check status", icon: Search },
] as const;

function isLinkActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/" || pathname.startsWith("/report") || pathname.startsWith("/done");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Header() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    let isDark = document.documentElement.classList.contains("dark");
    try {
      const saved = localStorage.getItem("voss-theme");
      if (saved) {
        isDark = saved === "dark";
      }
    } catch {}
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
      try {
        localStorage.setItem("voss-theme", "dark");
      } catch {}
    } else {
      document.documentElement.classList.remove("dark");
      try {
        localStorage.setItem("voss-theme", "light");
      } catch {}
    }
  };

  return (
    <header className="bg-background/95 sticky top-0 z-40 border-b backdrop-blur-sm">
      <div className="container flex h-16 items-center gap-8">
        <Link to="/" className="flex min-h-11 min-w-11 shrink-0 items-center gap-2" aria-label="vfeedback home">
          <span className="text-xl font-bold tracking-tight">vfeedback</span>
          <span className="bg-brand size-2 rounded-sm" aria-hidden />
        </Link>
        <nav aria-label="Main navigation" className="hidden h-full items-center gap-6 md:flex">
          {navLinks.map((link) => {
            const active = isLinkActive(location.pathname, link.href);
            return (
              <Link
                key={link.href}
                to={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "hover:text-foreground relative flex h-full min-h-11 min-w-11 items-center px-2 text-sm font-medium transition-colors",
                  active
                    ? "text-foreground after:bg-brand after:absolute after:inset-x-0 after:bottom-0 after:h-0.5"
                    : "text-muted-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="min-h-11 min-w-11"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            <Sun className="hidden size-4 dark:block" aria-hidden />
            <Moon className="size-4 dark:hidden" aria-hidden />
            <span className="sr-only">{theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}</span>
          </Button>
          <Button
            variant="outline"
            disabled
            className="hidden min-h-11 min-w-11 md:inline-flex"
            title="Staff sign in (coming soon)"
          >
            Staff sign in
          </Button>
          <div className="md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                render={
                  <Button variant="ghost" size="icon-lg" className="min-h-11 min-w-11" aria-label="Open navigation">
                    <Menu className="size-5" aria-hidden />
                  </Button>
                }
              />
              <SheetContent className="w-[min(90vw,360px)]! gap-0">
                <SheetHeader className="border-b p-5">
                  <SheetTitle>vfeedback</SheetTitle>
                  <SheetDescription>
                    Reports are anonymous. We do not store your name, roll number or IP address with your report.
                  </SheetDescription>
                </SheetHeader>
                <nav aria-label="Mobile navigation" className="grid gap-1 p-3">
                  {navLinks.map(({ href, label, icon: Icon }) => {
                    const active = isLinkActive(location.pathname, href);
                    return (
                      <Link
                        key={href}
                        to={href}
                        onClick={() => setMobileOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                          active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <Icon className="size-4" aria-hidden />
                        {label}
                      </Link>
                    );
                  })}
                </nav>
                <div className="mt-auto border-t p-5">
                  <Button variant="outline" disabled className="min-h-11 w-full">
                    Staff sign in
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-card mt-auto border-t">
      <div className="container flex flex-col gap-4 py-7 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <Link to="/" className="inline-flex min-h-8 items-center gap-2 text-base font-semibold tracking-tight">
            vfeedback
            <span className="bg-brand size-1.5 rounded-sm" aria-hidden />
          </Link>
          <p className="text-muted-foreground text-xs">Only staff for the place you reported about can read reports.</p>
        </div>
        <div className="text-muted-foreground text-xs">A VOSS Labs project</div>
      </div>
    </footer>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let isNotFound = false;
  let title = "Error";
  let description = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      isNotFound = true;
      title = "Page not found";
      description = "The requested page could not be found.";
    } else {
      title = `${error.status} ${error.statusText || "Error"}`;
      description = error.data?.message || "An unexpected error occurred.";
    }
  } else if (error instanceof Error) {
    title = "Application error";
    description = error.message;
    if (import.meta.env.DEV) {
      stack = error.stack;
    }
  }

  return (
    <div className="py-12 md:py-16">
      <EmptyState
        title={title}
        body={description}
        icon={
          isNotFound ? (
            <FileQuestion className="size-5" aria-hidden />
          ) : (
            <AlertTriangle className="size-5" aria-hidden />
          )
        }
        action={
          <Link to="/" className={buttonVariants({ variant: "default", size: "lg" })}>
            Back to home
          </Link>
        }
      />
      {import.meta.env.DEV && stack && (
        <pre className="bg-muted text-muted-foreground mx-auto mt-8 max-w-2xl overflow-x-auto rounded-lg p-4 font-mono text-xs leading-relaxed">
          <code>{stack}</code>
        </pre>
      )}
    </div>
  );
}
