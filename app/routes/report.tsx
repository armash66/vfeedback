import { Form, Link, redirect, useActionData, useNavigation, useSearchParams } from "react-router";
import { asc, eq } from "drizzle-orm";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Lock } from "lucide-react";
import { db } from "../db/client.server.js";
import { places } from "../db/schema.js";
import { createReport, validateReportInput } from "../lib/reports.server.js";
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

export async function loader({ params }: Route.LoaderArgs) {
  const type = params.type;
  if (type !== "rate" && type !== "issue" && type !== "suggest") {
    throw new Response("Not Found", { status: 404 });
  }

  try {
    const list = await db
      .select({
        id: places.id,
        name: places.name,
        groupName: places.groupName,
      })
      .from(places)
      .where(eq(places.active, true))
      .orderBy(asc(places.name));
    return { type, places: list };
  } catch (err) {
    console.warn("Could not load places from db, using fallback", err);
    return {
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
    };
  }
}

export async function action({ request, params }: Route.ActionArgs) {
  const type = params.type;
  const formData = await request.formData();

  const placeId = formData.get("placeId");
  const rawRating = formData.get("rating");
  const note = (formData.get("note") as string) || "";
  const highlights = formData.getAll("highlights") as string[];

  let finalMessage = note.trim();
  if (type === "rate" && highlights.length > 0) {
    const highlightsText = `Highlights: ${highlights.join(", ")}`;
    finalMessage = finalMessage ? `${highlightsText}\n\n${finalMessage}` : highlightsText;
  }

  const payload = {
    type,
    placeId,
    rating: rawRating ? Number(rawRating) : null,
    message: finalMessage,
  };

  const validation = validateReportInput(payload);
  if (!validation.valid) {
    return { errors: validation.errors };
  }

  try {
    const result = await createReport(payload);
    return redirect(`/done/${result.code}`);
  } catch (error: any) {
    return {
      errors: [error.message || "Failed to submit report. Please try again."],
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

const HIGHLIGHT_OPTIONS = [
  "Cleanliness",
  "Speed / Performance",
  "Staff Helpful",
  "Quiet & Calm",
  "Spacious",
  "Lighting / AC",
];

export default function ReportPage({ loaderData }: Route.ComponentProps) {
  const { type, places: placeList } = loaderData;
  const [searchParams] = useSearchParams();
  const initialPlace = searchParams.get("place") || "";

  const [selectedPlace, setSelectedPlace] = useState(initialPlace);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedHighlights, setSelectedHighlights] = useState<string[]>([]);
  const [message, setMessage] = useState("");

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
    }
  }, [actionData]);

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
            description="Help campus staff improve facilities and services. Completely anonymous."
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
          {/* Hidden inputs */}
          <input type="hidden" name="placeId" value={selectedPlace} />
          {selectedRating && <input type="hidden" name="rating" value={selectedRating} />}
          {selectedHighlights.map((hl) => (
            <input key={hl} type="hidden" name="highlights" value={hl} />
          ))}

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
                      "h-9 gap-1.5 rounded-full px-3.5 text-xs font-normal transition-all",
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
                          "h-8 gap-1 rounded-full px-3 text-xs font-normal transition-all",
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

          {/* Submit button */}
          <Button type="submit" disabled={isSubmitting} className="w-full">
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
                <code className="text-foreground font-mono font-medium">spicy-samosa-42</code>.
              </li>
              <li>Department and facility staff for that place review the report and update progress.</li>
              <li>You can check back on the status anytime using your reference code.</li>
            </ul>
            <div className="border-border text-muted-foreground flex items-center gap-2 border-t pt-3 text-xs">
              <Lock className="size-3.5 shrink-0" aria-hidden />
              <span>No name or roll number is collected.</span>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
