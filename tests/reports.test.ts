import { describe, expect, it } from "vitest";
import { generateCode, getReportStatus, validateReportInput } from "../app/lib/reports.server.js";

describe("reports lib", () => {
  describe("generateCode", () => {
    it("matches /^[a-z]+-[a-z]+-\\d{2}$/", () => {
      const regex = /^[a-z]+-[a-z]+-\d{2}$/;
      for (let i = 0; i < 50; i++) {
        const code = generateCode();
        expect(code).toMatch(regex);
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

    it("accepts valid rate, issue, and suggest inputs", () => {
      const validRate = validateReportInput({
        type: "rate",
        placeId: "wifi",
        rating: 5,
        message: "Great speed",
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

  describe("getReportStatus", () => {
    const hasDatabase = Boolean(process.env.DATABASE_URL);

    it.runIf(hasDatabase)(
      "returns exactly the keys status and createdAt, or null for non-existent code",
      async (ctx) => {
        // Verify database is actually reachable before running integration tests
        try {
          const { pool } = await import("../app/db/client.server.js");
          await pool.query("SELECT 1");
        } catch (e: any) {
          ctx.skip();
          return;
        }

        const nonExistent = await getReportStatus("non-existent-code-99");
        expect(nonExistent).toBeNull();

        const { createReport } = await import("../app/lib/reports.server.js");
        const { code } = await createReport({
          type: "suggest",
          placeId: "canteen",
          message: "Add more vegan options please",
        });

        const status = await getReportStatus(code);
        expect(status).not.toBeNull();
        if (status) {
          expect(Object.keys(status).sort()).toEqual(["createdAt", "status"]);
          expect(typeof status.status).toBe("string");
          expect(status.createdAt).toBeInstanceOf(Date);
        }
      },
    );
  });
});
