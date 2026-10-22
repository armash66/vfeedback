import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CODE_REGEX, generateCode, HIGHLIGHT_OPTIONS, validateReportInput } from "../app/lib/report-input.js";
import { isUniqueViolation } from "../app/lib/reports.server.js";

describe("reports lib - pure tests", () => {
  describe("generateCode", () => {
    it("matches CODE_REGEX format (adjective-noun-6char suffix)", () => {
      for (let i = 0; i < 50; i++) {
        const code = generateCode();
        expect(code).toMatch(CODE_REGEX);
      }
    });
  });

  describe("validateReportInput", () => {
    it("rejects a bad type", () => {
      const result = validateReportInput({
        type: "invalid_type",
        placeId: "lab-1",
        message: "Everything is fine",
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain("Type must be one of: rate, issue, suggest");
      }
    });

    it("rejects a rating of 0 or 6", () => {
      const res0 = validateReportInput({
        type: "rate",
        placeId: "canteen",
        rating: 0,
      });
      expect(res0.valid).toBe(false);
      if (!res0.valid) {
        expect(res0.errors).toContain("Rating must be an integer between 1 and 5");
      }

      const res6 = validateReportInput({
        type: "rate",
        placeId: "canteen",
        rating: 6,
      });
      expect(res6.valid).toBe(false);
      if (!res6.valid) {
        expect(res6.errors).toContain("Rating must be an integer between 1 and 5");
      }
    });

    it("rejects a non-integer rating", () => {
      const res = validateReportInput({
        type: "rate",
        placeId: "canteen",
        rating: 3.5,
      });
      expect(res.valid).toBe(false);
      if (!res.valid) {
        expect(res.errors).toContain("Rating must be an integer between 1 and 5");
      }
    });

    it("rejects a missing rating for type rate", () => {
      const result = validateReportInput({
        type: "rate",
        placeId: "canteen",
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain("Rating is required for type 'rate'");
      }
    });

    it("rejects a 1001-character message", () => {
      const longMessage = "a".repeat(1001);
      const result = validateReportInput({
        type: "issue",
        placeId: "lab-2",
        message: longMessage,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain("Message must be at most 1000 characters");
      }
    });

    it("rejects a too-short issue", () => {
      const result = validateReportInput({
        type: "issue",
        placeId: "lab-2",
        message: "bad", // 3 chars < 5
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain("Message must be at least 5 characters for type 'issue'");
      }
    });

    it("rejects more than 6 highlights", () => {
      const result = validateReportInput({
        type: "rate",
        placeId: "wifi",
        rating: 4,
        highlights: [
          HIGHLIGHT_OPTIONS[0],
          HIGHLIGHT_OPTIONS[1],
          HIGHLIGHT_OPTIONS[2],
          HIGHLIGHT_OPTIONS[3],
          HIGHLIGHT_OPTIONS[4],
          HIGHLIGHT_OPTIONS[5],
          "Extra Chip",
        ],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain("At most 6 highlights can be selected");
      }
    });

    it("rejects an invalid highlight chip not in the allowlist", () => {
      const result = validateReportInput({
        type: "rate",
        placeId: "wifi",
        rating: 4,
        highlights: ["Not In Allowlist"],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContain("Invalid highlight option: Not In Allowlist");
      }
    });

    it("accepts valid rate with highlights, issue, and suggest inputs", () => {
      const validRate = validateReportInput({
        type: "rate",
        placeId: "wifi",
        rating: 5,
        message: "Great speed",
        highlights: [HIGHLIGHT_OPTIONS[0], HIGHLIGHT_OPTIONS[1]],
      });
      expect(validRate.valid).toBe(true);

      const validIssue = validateReportInput({
        type: "issue",
        placeId: "wifi",
        message: "Wi-Fi is not connecting on 3rd floor",
      });
      expect(validIssue.valid).toBe(true);

      const validSuggest = validateReportInput({
        type: "suggest",
        placeId: "library",
        message: "More charging ports near silent area",
      });
      expect(validSuggest.valid).toBe(true);
    });
  });

  describe("isUniqueViolation", () => {
    it("returns true for direct code 23505", () => {
      expect(isUniqueViolation({ code: "23505" })).toBe(true);
    });

    it("returns true for cause chain with code 23505", () => {
      expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true);
      expect(isUniqueViolation({ cause: { cause: { code: "23505" } } })).toBe(true);
    });

    it("returns false for non-23505 errors", () => {
      expect(isUniqueViolation({ code: "42P01" })).toBe(false);
      expect(isUniqueViolation({ cause: { code: "ECONNREFUSED" } })).toBe(false);
      expect(isUniqueViolation(new Error("Generic"))).toBe(false);
      expect(isUniqueViolation(null)).toBe(false);
      expect(isUniqueViolation(undefined)).toBe(false);
    });
  });

  describe("collision retry with cause chain", () => {
    it("proves the retry runs when error has { cause: { code: '23505' } }", async () => {
      const fakeError = { cause: { code: "23505" } };
      let attempts = 0;

      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [{ id: "test-place" }],
            }),
          }),
        }),
        insert: () => ({
          values: async () => {
            attempts++;
            if (attempts === 1) {
              throw fakeError;
            }
            return {};
          },
        }),
      };

      const client = await import("../app/db/client.server.js");
      const spy = vi.spyOn(client, "getDb").mockReturnValue(mockDb as any);

      const { createReport } = await import("../app/lib/reports.server.js");
      const result = await createReport({
        type: "suggest",
        placeId: "test-place",
        message: "Testing collision retry with cause chain",
      });

      expect(attempts).toBe(2);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.code).toMatch(CODE_REGEX);
      }

      spy.mockRestore();
    });
  });
});

describe("reports lib - database integration tests", () => {
  let isDbAvailable = false;
  const testPlaceId = `test-${Math.random().toString(36).slice(2, 8)}`;
  let poolInstance: any = null;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      return;
    }
    try {
      const { getPool, getDb } = await import("../app/db/client.server.js");
      poolInstance = getPool();
      await poolInstance.query("SELECT 1");
      isDbAvailable = true;

      const { places } = await import("../app/db/schema.js");
      const db = getDb();
      await db.insert(places).values({
        id: testPlaceId,
        name: "Test Place " + testPlaceId,
        groupName: "Testing",
        active: true,
      });
    } catch {
      isDbAvailable = false;
    }
  });

  afterAll(async () => {
    if (isDbAvailable && poolInstance) {
      try {
        const { places, reports } = await import("../app/db/schema.js");
        const { getDb } = await import("../app/db/client.server.js");
        const { eq } = await import("drizzle-orm");
        const db = getDb();
        await db.delete(reports).where(eq(reports.placeId, testPlaceId));
        await db.delete(places).where(eq(places.id, testPlaceId));
      } catch (e) {
        console.error("Cleanup error in integration afterAll:", e);
      } finally {
        try {
          await poolInstance.end();
        } catch {}
      }
    }
  });

  it("creates a report against the test place and checks status", async (ctx) => {
    if (!isDbAvailable) {
      ctx.skip();
      return;
    }

    const { createReport, getReportStatus } = await import("../app/lib/reports.server.js");
    const result = await createReport({
      type: "suggest",
      placeId: testPlaceId,
      message: "Integration test message for dynamically created place",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const status = await getReportStatus(result.code);
      expect(status).not.toBeNull();
      if (status) {
        expect(Object.keys(status).sort()).toEqual(["createdAt", "status"]);
        expect(status.status).toBe("new");
        expect(status.createdAt).toBeInstanceOf(Date);
      }
    }
  });

  it("rejects non-existent or inactive place", async (ctx) => {
    if (!isDbAvailable) {
      ctx.skip();
      return;
    }

    const { createReport } = await import("../app/lib/reports.server.js");
    const result = await createReport({
      type: "suggest",
      placeId: "non-existent-place-id-9999",
      message: "Should be rejected because place is not in database",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContain("Choose a place from the list.");
    }
  });

  it("returns null for non-existent reference code", async (ctx) => {
    if (!isDbAvailable) {
      ctx.skip();
      return;
    }

    const { getReportStatus } = await import("../app/lib/reports.server.js");
    const status = await getReportStatus("spicy-samosa-zzzzzz");
    expect(status).toBeNull();
  });

  it("the same submission_id twice gives the same code and one row", async (ctx) => {
    if (!isDbAvailable) {
      ctx.skip();
      return;
    }

    const { createReport } = await import("../app/lib/reports.server.js");
    const { reports } = await import("../app/db/schema.js");
    const { getDb } = await import("../app/db/client.server.js");
    const { eq } = await import("drizzle-orm");

    const submissionId = crypto.randomUUID();
    const res1 = await createReport({
      type: "rate",
      placeId: testPlaceId,
      rating: 5,
      message: "Idempotency submission attempt 1",
      submissionId,
    });

    expect(res1.ok).toBe(true);
    if (!res1.ok) return;

    const res2 = await createReport({
      type: "rate",
      placeId: testPlaceId,
      rating: 5,
      message: "Idempotency submission attempt 2",
      submissionId,
    });

    expect(res2.ok).toBe(true);
    if (!res2.ok) return;

    expect(res1.code).toBe(res2.code);

    const db = getDb();
    const rows = await db.select().from(reports).where(eq(reports.submissionId, submissionId));
    expect(rows.length).toBe(1);
    expect(rows[0].code).toBe(res1.code);
  });
});
