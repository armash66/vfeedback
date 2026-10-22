import { data, Form, Link, redirect, useActionData, useNavigation, useSearchParams } from "react-router";
import { asc, eq } from "drizzle-orm";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Lock } from "lucide-react";
import { getDb } from "../db/client.server.js";
import { places } from "../db/schema.js";
import {
  checkRateLimit,
  createDeviceCookieHeader,
  getClientAddress,
  getDeviceCookie,
  getRateLimitKey,
  TOO_MANY_REQUESTS_MESSAGE,
} from "../lib/rate-limit.server.js";
import {
  GENERIC_ERROR_MESSAGE,
  generateFormToken,
  isHoneypotTriggered,
  verifyFormToken,
} from "../lib/form-security.server.js";
import { HIGHLIGHT_OPTIONS, validateReportInput } from "../lib/report-input.js";
import { createReport } from "../lib/reports.server.js";
import { isTurnstileEnabled, verifyTurnstileToken } from "../lib/turnstile.server.js";
import type { Route } from "./+types/report";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { PageHeader } from "~/components/page-header";
import { cn } from "~/lib/utils";

export const meta: Route.MetaFunction = ({ params }) => {
  const type = params.type;
  const titles: Record<string, string> = {
    rate: "Rate your experience | vfeedback",
    issue: "Report a problem | vfeedback",
    suggest: "Make a suggestion | vfeedback",
  };
  const title = (type && titles[type]) || "Submit feedback | vfeedback";
  return [
    { title },
    {
      name: "description",
      content: "Submit anonymous campus feedback for Vidyalankar Institute of Technology.",
    },
  ];
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const type = params.type;
  if (type !== "rate" && type !== "issue" && type !== "suggest") {
    throw new Response("Not Found", { status: 404 });
  }

  const existingDevice = getDeviceCookie(request);
  const deviceId = existingDevice || crypto.randomUUID();
  const submissionId = crypto.randomUUID();
  const formToken = generateFormToken();
  const turnstileSiteKey = isTurnstileEnabled() ? process.env.TURNSTILE_SITE_KEY!.trim() : null;

  const headers = new Headers();
  if (!existingDevice) {
    headers.append("Set-Cookie", createDeviceCookieHeader(deviceId));
  }

  try {
    const list = await getDb()
      .select({
        id: places.id,
        name: places.name,
        groupName: places.groupName,
      })
      .from(places)
      .where(eq(places.active, true))
      .orderBy(asc(places.name));

    return data(
      {
        type,
        places: list,
        submissionId,
        turnstileSiteKey,
        formToken,
      },
      { headers },
    );
  } catch (err) {
    console.warn("Could not load places from db, using fallback", err);
    return data(
      {
        type,
        places: [
          { id: "canteen", name: "Canteen", groupName: "Services" },
          { id: "library", name: "Library", groupName: "Services" },
          { id: "wifi", name: "Wi-Fi", groupName: "Services" },
          { id: "classroom", name: "Classroom", groupName: "Academics" },
          { id: "lab-1", name: "Lab 1", groupName: "Labs" },
          { id: "lab-2", name: "Lab 2", groupName: "Labs" },
          { id: "other", name: "Something else", groupName: "Other" },
        ],
        submissionId,
        turnstileSiteKey,
        formToken,
      },
      { headers },
    );
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const type = params.type;
  const formData = await request.formData();

  // 1. Honeypot check: reject bots silently with generic error
  if (isHoneypotTriggered(formData)) {
    return { errors: [GENERIC_ERROR_MESSAGE] };
  }

  // 2. Fill-time signed token check: reject too fast (<3s), bad signature, or expired (>24h)
  const formToken = formData.get("formToken");
  if (!verifyFormToken(formToken)) {
    return { errors: [GENERIC_ERROR_MESSAGE] };
  }

  // 3. Validate form input FIRST so validation errors do not consume the Turnstile token
  const placeId = formData.get("placeId");
  const rawRating = formData.get("rating");
  const note = (formData.get("note") as string) || "";
  const highlights = formData.getAll("highlights").map(String);
  const submissionId = (formData.get("submissionId") as string) || null;

  const payload = {
    type: String(type || ""),
    placeId: typeof placeId === "string" ? placeId : "",
    rating: rawRating ? Number(rawRating) : null,
    message: note.trim(),
    highlights: type === "rate" ? highlights : [],
    submissionId,
  };

  const validation = validateReportInput(payload);
  if (!validation.valid) {
    return { errors: validation.errors };
  }

  // 4. Verify Turnstile ONLY after form input validation passes
  if (isTurnstileEnabled()) {
    const turnstileToken =
      (formData.get("cf-turnstile-response") as string) || (formData.get("turnstileToken") as string) || "";
    const turnstileResult = await verifyTurnstileToken(turnstileToken);
    if (!turnstileResult.success) {
      return { errors: [turnstileResult.error || "Verification failed. Please try again."] };
    }
  }

  // 5. Rate limiting & idempotent report creation
  try {
    // (a) Per network: 120 reports per 10 minutes
    const clientAddress = getClientAddress(request);
    const networkKey = getRateLimitKey("network", clientAddress);
    const networkLimit = await checkRateLimit(networkKey, 120, 600);
    if (!networkLimit.allowed) {
      return { errors: [TOO_MANY_REQUESTS_MESSAGE] };
    }

    // (b) Per device: 5 reports per 10 minutes using HMAC of device cookie (if present)
    const deviceId = getDeviceCookie(request);
    if (deviceId) {
      const deviceKey = getRateLimitKey("device", deviceId);
      const deviceLimit = await checkRateLimit(deviceKey, 5, 600);
      if (!deviceLimit.allowed) {
        return { errors: [TOO_MANY_REQUESTS_MESSAGE] };
      }
    }

    // 6. Idempotent report creation
    const result = await createReport(payload);
    if (!result.ok) {
      return { errors: result.errors };
    }
    return redirect(`/done/${result.code}`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Action error:", msg);
    return {
      errors: [GENERIC_ERROR_MESSAGE],
    };
  }
}

const RATING_LABELS = [
  { value: 1, label: "Awful" },
  { value: 2, label: "Mid" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Peak" },
];

export default function ReportPage({ loaderData }: Route.ComponentProps) {
  const { type, places: placeList, submissionId, turnstileSiteKey, formToken } = loaderData;
  const [searchParams] = useSearchParams();
  const initialPlace = searchParams.get("place") || "";

  const [selectedPlace, setSelectedPlace] = useState(initialPlace);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedHighlights, setSelectedHighlights] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  // Turnstile client state
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const alertRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (actionData?.errors && actionData.errors.length > 0) {
      const errs = actionData.errors.map((e) => e.toLowerCase());
      if (errs.some((e) => e.includes("place"))) {
        const el = document.querySelector<HTMLButtonElement>('[data-slot="place-chip"]');
        el?.focus();
      } else if (errs.some((e) => e.includes("rating"))) {
        const el = document.querySelector<HTMLButtonElement>('[role="radio"]');
        el?.focus();
      } else if (errs.some((e) => e.includes("message") || e.includes("character") || e.includes("note"))) {
        textareaRef.current?.focus();
      } else {
        alertRef.current?.focus();
      }

      // Reset Turnstile widget on failed submission so a fresh token is issued
      if (turnstileSiteKey && (window as any).turnstile && widgetIdRef.current) {
        try {
          (window as any).turnstile.reset(widgetIdRef.current);
          setTurnstileToken(null);
        } catch {}
      }
    }
  }, [actionData, turnstileSiteKey]);

  // Turnstile script & explicit widget rendering
  useEffect(() => {
    if (!turnstileSiteKey) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const renderWidget = () => {
      const turnstile = (window as any).turnstile;
      if (!turnstile || !turnstileContainerRef.current) return;
      if (widgetIdRef.current) return;

      try {
        const id = turnstile.render(turnstileContainerRef.current, {
          sitekey: turnstileSiteKey,
          appearance: "interaction-only",
          callback: (token: string) => {
            setTurnstileToken(token);
            setTurnstileError(null);
          },
          "expired-callback": () => {
            setTurnstileToken(null);
          },
          "error-callback": () => {
            setTurnstileToken(null);
            setTurnstileError("Verification failed. Reload the page and try again.");
          },
        });
        widgetIdRef.current = id;
      } catch (err) {
        console.error("Turnstile render error:", err);
      }
    };

    if ((window as any).turnstile) {
      renderWidget();
    } else {
      const existingScript = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
      if (!existingScript) {
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      // 8 second timeout for script loading
      timeoutId = setTimeout(() => {
        if (!(window as any).turnstile || !widgetIdRef.current) {
          if (!turnstileToken) {
            setTurnstileError("Verification could not load. Check your connection and reload.");
          }
        }
      }, 8000);

      pollInterval = setInterval(() => {
        if ((window as any).turnstile) {
          renderWidget();
          if (widgetIdRef.current && pollInterval) {
            clearInterval(pollInterval);
          }
        }
      }, 100);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [turnstileSiteKey]);

  const toggleHighlight = (option: string) => {
    setSelectedHighlights((prev) =>
      prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option],
    );
  };

  const titleMap: Record<string, string> = {
    rate: "Rate your experience",
    issue: "Report a problem",
    suggest: "Make a suggestion",
  };

  // Submit button disabled when submitting OR when Turnstile is enabled but token is not yet ready
  const isSubmitDisabled = isSubmitting || Boolean(turnstileSiteKey && !turnstileToken);

  return (
    <div className="grid grid-cols-1 items-start gap-8 min-[900px]:grid-cols-[1fr_360px] min-[900px]:gap-12">
      {/* Main Form Column (640px max) */}
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
            title={titleMap[type]}
            description="Reports are anonymous. We do not store your name, roll number or IP address with your report."
            eyebrow="Campus feedback"
          />
        </div>

        {actionData?.errors && actionData.errors.length > 0 && (
          <div
            role="alert"
            ref={alertRef}
            tabIndex={-1}
            className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm outline-none"
          >
            <div className="mb-1 font-semibold">Please fix the following:</div>
            <ul className="text-foreground list-inside list-disc space-y-1">
              {actionData.errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <Form method="post" className="space-y-6">
          {/* Hidden metadata & security fields */}
          <input type="hidden" name="placeId" value={selectedPlace} />
          <input type="hidden" name="submissionId" value={submissionId} />
          <input type="hidden" name="formToken" value={formToken} />
          {turnstileSiteKey && <input type="hidden" name="cf-turnstile-response" value={turnstileToken || ""} />}
          {selectedRating && <input type="hidden" name="rating" value={selectedRating} />}
          {selectedHighlights.map((hl) => (
            <input key={hl} type="hidden" name="highlights" value={hl} />
          ))}

          {/* Honeypot field for bot protection (visually hidden) */}
          <div className="absolute -left-[9999px] size-0 opacity-0 pointer-events-none" aria-hidden="true">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </div>

          {/* Step 1: Place selection */}
          <fieldset className="space-y-3">
            <legend className="text-foreground text-sm font-medium">Select place *</legend>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Select place">
              {placeList.map((place) => {
                const isSelected = selectedPlace === place.id;
                return (
                  <Button
                    key={place.id}
                    type="button"
                    variant="outline"
                    data-slot="place-chip"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedPlace(place.id)}
                    className={cn(
                      "min-h-11 gap-1.5 rounded-full px-4 text-xs font-normal transition-all",
                      isSelected && "border-brand ring-brand ring-1 font-medium",
                    )}
                  >
                    {isSelected && <Check className="text-brand size-3" aria-hidden />}
                    <span>{place.name}</span>
                  </Button>
                );
              })}
            </div>
          </fieldset>

          {/* Step 2: Rating grid for type=rate */}
          {type === "rate" && (
            <fieldset className="space-y-4">
              <legend className="text-foreground text-sm font-medium">Rating *</legend>
              <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Rating">
                {RATING_LABELS.map((item) => {
                  const isSelected = selectedRating === item.value;
                  return (
                    <Button
                      key={item.value}
                      type="button"
                      variant="outline"
                      role="radio"
                      aria-checked={isSelected}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedRating(item.value)}
                      className={cn(
                        "flex h-16 flex-col justify-center px-1 py-2 text-center transition-all",
                        isSelected && "border-brand ring-brand ring-1 font-medium",
                      )}
                    >
                      <span className="font-mono text-base font-semibold leading-none">{item.value}</span>
                      <span className="text-muted-foreground flex items-center justify-center gap-1 text-[11px]">
                        {isSelected && <Check className="text-brand size-2.5" aria-hidden />}
                        {item.label}
                      </span>
                    </Button>
                  );
                })}
              </div>

              {/* Optional highlights */}
              <div className="space-y-2 pt-2">
                <Label className="text-muted-foreground text-sm font-medium">What stood out? (optional)</Label>
                <div className="flex flex-wrap gap-2">
                  {HIGHLIGHT_OPTIONS.map((opt) => {
                    const isSelected = selectedHighlights.includes(opt);
                    return (
                      <Button
                        key={opt}
                        type="button"
                        variant="outline"
                        aria-pressed={isSelected}
                        onClick={() => toggleHighlight(opt)}
                        className={cn(
                          "min-h-11 gap-1.5 rounded-full px-3.5 text-xs font-normal transition-all",
                          isSelected && "border-brand ring-brand ring-1 font-medium",
                        )}
                      >
                        {isSelected && <Check className="text-brand size-3" aria-hidden />}
                        <span>{opt}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            </fieldset>
          )}

          {/* Note / Message */}
          <div className="space-y-2">
            <Label htmlFor="report-note">
              {type === "rate" ? "Add a note (optional)" : type === "issue" ? "Describe the issue *" : "Your idea *"}
            </Label>
            <Textarea
              id="report-note"
              ref={textareaRef}
              name="note"
              rows={4}
              maxLength={1000}
              placeholder={
                type === "rate"
                  ? "Anything specific you would like to share..."
                  : type === "issue"
                    ? "Explain what is broken, missing, or needs attention (min 5 chars)..."
                    : "Tell us your idea and how it improves things (min 5 chars)..."
              }
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px]"
            />
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>{type !== "rate" ? "Minimum 5 characters" : ""}</span>
              <span className="font-mono">{message.length} / 1000</span>
            </div>
          </div>

          {/* Cloudflare Turnstile explicit widget */}
          {turnstileSiteKey && (
            <div className="space-y-1.5 pt-1">
              <div ref={turnstileContainerRef} />
              {!turnstileToken && !turnstileError && (
                <p className="text-muted-foreground font-mono text-xs">Checking...</p>
              )}
              {turnstileError && <p className="text-destructive text-xs">{turnstileError}</p>}
            </div>
          )}

          {/* Submit button */}
          <Button type="submit" size="lg" disabled={isSubmitDisabled} className="w-full min-h-11">
            {isSubmitting ? "Sending..." : "Submit feedback"}
          </Button>
        </Form>
      </div>

      {/* Sidebar Column */}
      <aside className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>What happens next</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-muted-foreground list-inside list-disc space-y-2.5 text-sm leading-relaxed">
              <li>
                Your report gets a word-based reference code like{" "}
                <code className="text-foreground font-mono font-medium">spicy-samosa-k7q4mz</code>.
              </li>
              <li>Department and facility staff for that place review the report and update progress.</li>
              <li>You can check back on the status anytime using your reference code.</li>
            </ul>
            <div className="border-border text-muted-foreground flex items-center gap-2 border-t pt-3 text-xs">
              <Lock className="size-3.5 shrink-0" aria-hidden />
              <span>Reports are anonymous. We do not store your name, roll number or IP address with your report.</span>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
