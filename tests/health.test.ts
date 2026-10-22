import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQuery = vi.fn();

vi.mock("../app/db/client.server.js", () => ({
  getPool: () => ({
    query: mockQuery,
  }),
}));

import { loader } from "../app/routes/healthz.js";

describe("/healthz route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 and { ok: true } when database query resolves", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ 1: 1 }] });
    const res = await loader();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(mockQuery).toHaveBeenCalledWith("SELECT 1");
  });

  it("returns 503 and { ok: false } when database query rejects", async () => {
    mockQuery.mockRejectedValueOnce(new Error("Database connection failed"));
    const res = await loader();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ ok: false });
  });
});
