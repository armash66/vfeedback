import { Form, Link, useSearchParams } from "react-router";
import { asc, eq } from "drizzle-orm";
import { db } from "../db/client.server.js";
import { places } from "../db/schema.js";
import type { Route } from "./+types/home";

export async function loader() {
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
    return { places: list };
  } catch (err) {
    console.warn("Could not load places from db, using fallback", err);
    return {
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

export default function Home({ loaderData }: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") || "";
  const selectedPlace = searchParams.get("place") || "";

  const allPlaces = loaderData.places;
  const filteredPlaces = allPlaces.filter((p) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return p.name.toLowerCase().includes(term) || p.groupName.toLowerCase().includes(term);
  });

  const handleSelectPlace = (id: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (selectedPlace === id) {
      nextParams.delete("place");
    } else {
      nextParams.set("place", id);
    }
    setSearchParams(nextParams);
  };

  const buildReportUrl = (type: string) => {
    const params = new URLSearchParams();
    if (selectedPlace) {
      params.set("place", selectedPlace);
    }
    const query = params.toString();
    return `/report/${type}${query ? `?${query}` : ""}`;
  };

  return (
    <main>
      <section style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontSize: "clamp(1.8rem, 4vw, 2.4rem)",
            fontWeight: 600,
            letterSpacing: "-0.03em",
            lineHeight: 1.15,
            marginBottom: "12px",
          }}
        >
          One place to speak up about your campus.
        </h1>
        <p style={{ color: "var(--text-dim)", fontSize: "1rem" }}>
          Pick a place, answer 2–4 quick questions, and receive a private reference code. No account required.
        </p>
      </section>

      {/* Search box & Places */}
      <section style={{ marginBottom: "40px" }}>
        <div style={{ marginBottom: "16px" }}>
          <label
            htmlFor="place-search"
            style={{
              display: "block",
              fontSize: "0.88rem",
              fontWeight: 500,
              color: "var(--text-dim)",
              marginBottom: "8px",
            }}
          >
            Find a place
          </label>
          <input
            id="place-search"
            type="search"
            className="voss-input"
            placeholder="Search lab, canteen, Wi-Fi..."
            value={search}
            onChange={(e) => {
              const next = new URLSearchParams(searchParams);
              if (e.target.value) {
                next.set("q", e.target.value);
              } else {
                next.delete("q");
              }
              setSearchParams(next);
            }}
          />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }} role="group" aria-label="Select a place">
          {filteredPlaces.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", padding: "8px 0" }}>
              No places matching &quot;{search}&quot;.
            </p>
          ) : (
            filteredPlaces.map((place) => {
              const isSelected = selectedPlace === place.id;
              return (
                <button
                  type="button"
                  key={place.id}
                  onClick={() => handleSelectPlace(place.id)}
                  className={`voss-chip ${isSelected ? "selected" : ""}`}
                  aria-pressed={isSelected}
                >
                  {isSelected && <span aria-hidden="true">✓ </span>}
                  <span>{place.name}</span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.72rem",
                      color: "var(--text-dim)",
                    }}
                  >
                    ({place.groupName})
                  </span>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* Flat rows */}
      <section>
        <div className="voss-row-list">
          <Link to={buildReportUrl("rate")} className="voss-row">
            <div>
              <div style={{ fontWeight: 600, fontSize: "1.1rem", marginBottom: "4px" }}>Rate something</div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.92rem" }}>
                Leave a quick 1 to 5 rating with what stood out.
              </div>
            </div>
            <span style={{ fontSize: "1.2rem", color: "var(--text-dim)" }} aria-hidden="true">
              →
            </span>
          </Link>

          <Link to={buildReportUrl("issue")} className="voss-row">
            <div>
              <div style={{ fontWeight: 600, fontSize: "1.1rem", marginBottom: "4px" }}>Report a problem</div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.92rem" }}>
                Broken AC, bad Wi-Fi, lab equipment issues or hygiene reports.
              </div>
            </div>
            <span style={{ fontSize: "1.2rem", color: "var(--text-dim)" }} aria-hidden="true">
              →
            </span>
          </Link>

          <Link to={buildReportUrl("suggest")} className="voss-row">
            <div>
              <div style={{ fontWeight: 600, fontSize: "1.1rem", marginBottom: "4px" }}>Make a suggestion</div>
              <div style={{ color: "var(--text-dim)", fontSize: "0.92rem" }}>
                Share an idea to make campus or facilities better.
              </div>
            </div>
            <span style={{ fontSize: "1.2rem", color: "var(--text-dim)" }} aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
