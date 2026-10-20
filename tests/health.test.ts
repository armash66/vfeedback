import { describe, expect, it } from "vitest";
import { loader } from "../app/routes/healthz.js";

describe("/healthz route", () => {
  it("returns 200 and { ok: true } when database is reachable", async () => {
    const res = await loader();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
