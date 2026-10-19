import { Form, Link, redirect, useActionData, useNavigation, useSearchParams } from "react-router";
import { asc, eq } from "drizzle-orm";
import { useState } from "react";
import { db } from "../db/client.server.js";
import { places } from "../db/schema.js";
import { createReport, validateReportInput } from "../lib/reports.server.js";
import type { Route } from "./+types/report";

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
    return { errors: [error.message || "Failed to submit report. Please try again."] };
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
    <main>
      <div style={{ marginBottom: "24px" }}>
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
        <h1 style={{ fontSize: "1.75rem", fontWeight: 600, letterSpacing: "-0.03em" }}>{titleMap[type]}</h1>
        <p style={{ color: "var(--text-dim)", fontSize: "0.95rem" }}>
          Never collect your name or roll number. Completely anonymous.
        </p>
      </div>

      {actionData?.errors && actionData.errors.length > 0 && (
        <div
          role="alert"
          style={{
            background: "var(--bg-card)",
            border: "1px solid #b91c1c",
            borderRadius: "var(--radius-sm)",
            padding: "12px 16px",
            marginBottom: "24px",
          }}
        >
          <div style={{ color: "#b91c1c", fontWeight: 600, fontSize: "0.9rem", marginBottom: "4px" }}>
            Please fix the following:
          </div>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.88rem", color: "var(--text)" }}>
            {actionData.errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <Form method="post">
        {/* Hidden inputs */}
        <input type="hidden" name="placeId" value={selectedPlace} />
        {selectedRating && <input type="hidden" name="rating" value={selectedRating} />}
        {selectedHighlights.map((hl) => (
          <input key={hl} type="hidden" name="highlights" value={hl} />
        ))}

        {/* Step 1: Place selection */}
        <fieldset style={{ border: "none", padding: 0, margin: "0 0 28px 0" }}>
          <legend
            style={{
              fontSize: "0.92rem",
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: "10px",
            }}
          >
            Select place *
          </legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }} role="group" aria-label="Select place">
            {placeList.map((place) => {
              const isSelected = selectedPlace === place.id;
              return (
                <button
                  type="button"
                  key={place.id}
                  onClick={() => setSelectedPlace(place.id)}
                  className={`voss-chip ${isSelected ? "selected" : ""}`}
                  aria-pressed={isSelected}
                >
                  {isSelected && <span aria-hidden="true">✓ </span>}
                  <span>{place.name}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Step 2: Rating grid for type=rate */}
        {type === "rate" && (
          <fieldset style={{ border: "none", padding: 0, margin: "0 0 28px 0" }}>
            <legend
              style={{
                fontSize: "0.92rem",
                fontWeight: 600,
                color: "var(--text)",
                marginBottom: "10px",
              }}
            >
              Rating *
            </legend>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: "8px",
              }}
              role="radiogroup"
              aria-label="Rating"
            >
              {RATING_LABELS.map((item) => {
                const isSelected = selectedRating === item.value;
                return (
                  <button
                    type="button"
                    key={item.value}
                    onClick={() => setSelectedRating(item.value)}
                    className="voss-btn-ghost"
                    style={{
                      flexDirection: "column",
                      padding: "10px 4px",
                      minHeight: "64px",
                      border: isSelected ? "2px solid var(--brand)" : "1px solid var(--border)",
                      fontWeight: isSelected ? 600 : 400,
                    }}
                    role="radio"
                    aria-checked={isSelected}
                  >
                    <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>{item.value}</span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: isSelected ? "var(--text)" : "var(--text-dim)",
                        marginTop: "4px",
                      }}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Optional highlights */}
            <div style={{ marginTop: "20px" }}>
              <div
                style={{
                  fontSize: "0.88rem",
                  fontWeight: 500,
                  color: "var(--text-dim)",
                  marginBottom: "8px",
                }}
              >
                What stood out? (optional)
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {HIGHLIGHT_OPTIONS.map((opt) => {
                  const isSelected = selectedHighlights.includes(opt);
                  return (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => toggleHighlight(opt)}
                      className={`voss-chip ${isSelected ? "selected" : ""}`}
                      aria-pressed={isSelected}
                    >
                      {isSelected && <span aria-hidden="true">✓ </span>}
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </fieldset>
        )}

        {/* Note / Message */}
        <div style={{ marginBottom: "32px" }}>
          <label
            htmlFor="report-note"
            style={{
              display: "block",
              fontSize: "0.92rem",
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: "8px",
            }}
          >
            {type === "rate" ? "Add a note (optional)" : type === "issue" ? "Describe the issue *" : "Your idea *"}
          </label>
          <textarea
            id="report-note"
            name="note"
            className="voss-textarea"
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
            style={{ minHeight: "120px" }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.75rem",
              color: "var(--text-dim)",
              marginTop: "4px",
            }}
          >
            <span>{type !== "rate" ? "Minimum 5 characters" : ""}</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>{message.length} / 1000</span>
          </div>
        </div>

        {/* Submit button */}
        <button type="submit" disabled={isSubmitting} className="voss-btn-primary" style={{ width: "100%" }}>
          {isSubmitting ? "Submitting..." : "Submit feedback"}
        </button>
      </Form>
    </main>
  );
}
