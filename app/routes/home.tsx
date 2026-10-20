import { Form, Link, useSearchParams } from "react-router";
import { asc, eq } from "drizzle-orm";
import { useState } from "react";
import { ArrowRight, Check, MapPinOff } from "lucide-react";
import { getDb } from "../db/client.server.js";
import { places } from "../db/schema.js";
import type { Route } from "./+types/home";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { EmptyState } from "~/components/empty-state";
import { cn } from "~/lib/utils";

export const meta: Route.MetaFunction = () => {
  return [
    { title: "vfeedback — Vidyalankar Institute of Technology" },
    {
      name: "description",
      content: "One place to speak up about your campus. Anonymous student feedback for VIT.",
    },
  ];
};

export async function loader() {
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

export function shouldRevalidate() {
  return false;
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
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
    setSearchParams(nextParams, { replace: true, preventScrollReset: true });
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
    <div className="grid grid-cols-1 items-start gap-8 min-[900px]:grid-cols-[1fr_360px] min-[900px]:gap-12">
      {/* Main Column */}
      <div className="w-full max-w-[640px] space-y-8">
        <section className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            One place to speak up about your campus.
          </h1>
          <p className="text-muted-foreground max-w-[65ch] text-base leading-relaxed">
            Reports are anonymous. We do not store your name, roll number or IP address with your report.
          </p>
        </section>

        {/* Search box & Places */}
        <section className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="place-search">Find a place</Label>
            <Input
              id="place-search"
              type="search"
              placeholder="Search lab, canteen, Wi-Fi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Select a place">
            {filteredPlaces.length === 0 ? (
              <EmptyState
                icon={<MapPinOff className="size-5" aria-hidden />}
                title="No matching places"
                body={`We couldn't find any places matching "${search}".`}
                action={
                  <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                }
                className="w-full"
              />
            ) : (
              filteredPlaces.map((place) => {
                const isSelected = selectedPlace === place.id;
                return (
                  <Button
                    key={place.id}
                    type="button"
                    variant="outline"
                    data-slot="place-chip"
                    aria-pressed={isSelected}
                    onClick={() => handleSelectPlace(place.id)}
                    className={cn(
                      "min-h-11 gap-1.5 rounded-full px-4 text-xs font-normal transition-all",
                      isSelected && "border-brand ring-brand ring-1 font-medium",
                    )}
                  >
                    {isSelected && <Check className="text-brand size-3" aria-hidden />}
                    <span>{place.name}</span>
                    <span className="text-muted-foreground text-[11px]">({place.groupName})</span>
                  </Button>
                );
              })
            )}
          </div>
        </section>

        {/* Three actions as card-style links */}
        <section className="space-y-3">
          <Card className="hover:ring-foreground/25 transition-all">
            <Link to={buildReportUrl("rate")} className="group flex items-center justify-between gap-4 p-5">
              <div>
                <h2 className="group-hover:text-brand text-base font-semibold transition-colors">Rate something</h2>
                <p className="text-muted-foreground mt-1 text-sm">Leave a quick 1 to 5 rating with what stood out.</p>
              </div>
              <ArrowRight
                className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 size-4 shrink-0 transition-all"
                aria-hidden
              />
            </Link>
          </Card>

          <Card className="hover:ring-foreground/25 transition-all">
            <Link to={buildReportUrl("issue")} className="group flex items-center justify-between gap-4 p-5">
              <div>
                <h2 className="group-hover:text-brand text-base font-semibold transition-colors">Report a problem</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Broken AC, bad Wi-Fi, lab equipment issues or hygiene reports.
                </p>
              </div>
              <ArrowRight
                className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 size-4 shrink-0 transition-all"
                aria-hidden
              />
            </Link>
          </Card>

          <Card className="hover:ring-foreground/25 transition-all">
            <Link to={buildReportUrl("suggest")} className="group flex items-center justify-between gap-4 p-5">
              <div>
                <h2 className="group-hover:text-brand text-base font-semibold transition-colors">Make a suggestion</h2>
                <p className="text-muted-foreground mt-1 text-sm">Share an idea to make campus or facilities better.</p>
              </div>
              <ArrowRight
                className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 size-4 shrink-0 transition-all"
                aria-hidden
              />
            </Link>
          </Card>
        </section>
      </div>

      {/* Sidebar Column */}
      <aside className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Check your report</CardTitle>
            <CardDescription>Already submitted feedback? Look up its status with your code.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form method="get" action="/status" className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sidebar-code">Reference code</Label>
                <Input
                  id="sidebar-code"
                  type="text"
                  name="code"
                  placeholder="e.g. spicy-samosa-k7q4mz"
                  className="font-mono text-sm"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>
              <Button type="submit" size="lg" className="w-full">
                Check status
              </Button>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="text-muted-foreground list-decimal list-inside space-y-3 text-sm leading-relaxed">
              <li>
                <strong className="text-foreground font-medium">Pick a place</strong>: Choose the lab, canteen, Wi-Fi or
                classroom you visited.
              </li>
              <li>
                <strong className="text-foreground font-medium">Tell us</strong>: Rate your visit, flag a defect, or
                suggest an improvement.
              </li>
              <li>
                <strong className="text-foreground font-medium">Track it with your code</strong>: Save your anonymous
                reference code to track resolution.
              </li>
            </ol>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
