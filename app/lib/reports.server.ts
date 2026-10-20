import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.server.js";
import { places, reports } from "../db/schema.js";
import {
  CODE_REGEX,
  generateCode,
  validateReportInput,
  type ValidReportInput,
  type ValidateReportResult,
} from "./report-input.js";

export { generateCode, validateReportInput };
export type { ValidReportInput, ValidateReportResult };

export function isUniqueViolation(err: unknown): boolean {
  let current: any = err;
  while (current) {
    if (current.code === "23505") {
      return true;
    }
    current = current.cause;
  }
  return false;
}

export type CreateReportResult = { ok: true; code: string } | { ok: false; errors: string[] };

export async function createReport(input: unknown): Promise<CreateReportResult> {
  const validation = validateReportInput(input);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  const { type, placeId, rating, message, highlights, submissionId } = validation.data;

  try {
    const db = getDb();

    // Idempotency check: if report with this submissionId already exists, return existing code
    if (submissionId) {
      const existing = await db
        .select({ code: reports.code })
        .from(reports)
        .where(eq(reports.submissionId, submissionId))
        .limit(1);

      if (existing.length > 0) {
        return { ok: true, code: existing[0].code };
      }
    }

    // Check that placeId exists in places with active = true
    const activePlace = await db
      .select({ id: places.id })
      .from(places)
      .where(and(eq(places.id, placeId), eq(places.active, true)))
      .limit(1);

    if (activePlace.length === 0) {
      return { ok: false, errors: ["Choose a place from the list."] };
    }

    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const code = generateCode();
      try {
        await db.insert(reports).values({
          code,
          submissionId: submissionId || null,
          type,
          placeId,
          rating,
          message,
          highlights,
          status: "new",
        });
        return { ok: true, code };
      } catch (error: unknown) {
        // If concurrent duplicate insertion occurred on submission_id:
        if (submissionId && isUniqueViolation(error)) {
          const existing = await db
            .select({ code: reports.code })
            .from(reports)
            .where(eq(reports.submissionId, submissionId))
            .limit(1);

          if (existing.length > 0) {
            return { ok: true, code: existing[0].code };
          }
        }

        if (isUniqueViolation(error) && attempt < maxAttempts - 1) {
          continue;
        }
        console.error("createReport unexpected database error:", error);
        return {
          ok: false,
          errors: ["Something went wrong. Please try again."],
        };
      }
    }

    console.error("createReport collision retry exhausted after 5 attempts");
    return {
      ok: false,
      errors: ["Something went wrong. Please try again."],
    };
  } catch (error: unknown) {
    console.error("createReport unexpected server error:", error);
    return {
      ok: false,
      errors: ["Something went wrong. Please try again."],
    };
  }
}

export async function getReportStatus(code: string): Promise<{ status: string; createdAt: Date } | null> {
  if (!code) {
    return null;
  }

  const cleanCode = code.trim().toLowerCase();
  if (!CODE_REGEX.test(cleanCode)) {
    return null;
  }

  try {
    const db = getDb();
    const result = await db
      .select({
        status: reports.status,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .where(eq(reports.code, cleanCode))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return {
      status: result[0].status,
      createdAt: result[0].createdAt,
    };
  } catch (error) {
    console.error("getReportStatus error:", error);
    return null;
  }
}
