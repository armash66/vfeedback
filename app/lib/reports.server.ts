import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client.server.js";
import { reports } from "../db/schema.js";

const ADJECTIVES = [
  "spicy",
  "crispy",
  "golden",
  "sweet",
  "salty",
  "tangy",
  "fresh",
  "clever",
  "bright",
  "swift",
  "calm",
  "bold",
  "gentle",
  "brave",
  "quick",
  "happy",
  "eager",
  "silent",
  "warm",
  "cool",
  "quiet",
  "vibrant",
  "smooth",
  "sunny",
  "sharp",
  "keen",
  "mighty",
  "noble",
  "proud",
  "stellar",
  "grand",
  "lively",
];

const NOUNS = [
  "samosa",
  "chai",
  "vada",
  "dosa",
  "idli",
  "pav",
  "puri",
  "bhelpuri",
  "kachori",
  "pakora",
  "paratha",
  "biryani",
  "pulao",
  "paneer",
  "jalebi",
  "laddu",
  "halwa",
  "gulab",
  "mango",
  "kulfi",
  "falooda",
  "chutney",
  "rasam",
  "naan",
  "kulcha",
  "thali",
  "upma",
  "poha",
  "lassi",
  "sharbat",
  "khichdi",
  "modak",
];

export interface ValidReportInput {
  type: "rate" | "issue" | "suggest";
  placeId: string;
  rating: number | null;
  message: string;
}

export type ValidateReportResult = { valid: true; data: ValidReportInput } | { valid: false; errors: string[] };

export function validateReportInput(input: unknown): ValidateReportResult {
  const errors: string[] = [];

  if (!input || typeof input !== "object") {
    return { valid: false, errors: ["Invalid input: expected an object"] };
  }

  const raw = input as Record<string, unknown>;

  // Type validation
  const validTypes = ["rate", "issue", "suggest"] as const;
  const type = raw.type;
  if (typeof type !== "string" || !validTypes.includes(type as (typeof validTypes)[number])) {
    errors.push("Type must be one of: rate, issue, suggest");
  }

  // Place ID validation
  const placeId = raw.placeId;
  if (typeof placeId !== "string" || placeId.trim().length === 0) {
    errors.push("Place ID must be a non-empty string");
  }

  // Rating validation
  let rating: number | null = null;
  if (raw.rating !== undefined && raw.rating !== null && raw.rating !== "") {
    const parsedRating = Number(raw.rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      errors.push("Rating must be an integer between 1 and 5");
    } else {
      rating = parsedRating;
    }
  }

  if (type === "rate" && rating === null) {
    errors.push("Rating is required for type 'rate'");
  }

  // Message validation
  let message = "";
  if (typeof raw.message === "string") {
    message = raw.message.trim();
  } else if (raw.message !== undefined && raw.message !== null) {
    errors.push("Message must be a string");
  }

  if (message.length > 1000) {
    errors.push("Message must be at most 1000 characters");
  }

  if ((type === "issue" || type === "suggest") && message.length < 5) {
    errors.push(`Message must be at least 5 characters for type '${type}'`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    data: {
      type: type as "rate" | "issue" | "suggest",
      placeId: (placeId as string).trim(),
      rating,
      message,
    },
  };
}

export function generateCode(): string {
  const adjIndex = randomInt(0, ADJECTIVES.length);
  const nounIndex = randomInt(0, NOUNS.length);
  const digits = randomInt(10, 100); // 10 to 99 (two digits)

  const adj = ADJECTIVES[adjIndex].toLowerCase();
  const noun = NOUNS[nounIndex].toLowerCase();

  return `${adj}-${noun}-${digits}`;
}

export async function createReport(input: unknown): Promise<{ code: string }> {
  const validation = validateReportInput(input);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
  }

  const { type, placeId, rating, message } = validation.data;

  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateCode();
    try {
      await db.insert(reports).values({
        code,
        type,
        placeId,
        rating,
        message,
        status: "new",
      });
      return { code };
    } catch (error: unknown) {
      // Postgres unique constraint violation error code is 23505
      const pgError = error as { code?: string };
      if (pgError && pgError.code === "23505" && attempt < maxAttempts - 1) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Failed to generate unique report code after 5 attempts");
}

export async function getReportStatus(code: string): Promise<{ status: string; createdAt: Date } | null> {
  const cleanCode = code.trim().toLowerCase();
  if (!cleanCode) {
    return null;
  }

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
}
