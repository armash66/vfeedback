export const ADJECTIVES = [
  "amber",
  "autumn",
  "azure",
  "bold",
  "brave",
  "breezy",
  "bright",
  "brisk",
  "bronze",
  "calm",
  "cedar",
  "chill",
  "clever",
  "cloudy",
  "clover",
  "coastal",
  "copper",
  "coral",
  "cozy",
  "crisp",
  "crispy",
  "crystal",
  "daring",
  "dawn",
  "dazzling",
  "dewy",
  "dusk",
  "eager",
  "early",
  "earthy",
  "electric",
  "emerald",
  "faint",
  "fair",
  "fast",
  "festive",
  "fierce",
  "fiery",
  "fine",
  "flash",
  "fleet",
  "floral",
  "fluffy",
  "flying",
  "forest",
  "fresh",
  "frosty",
  "gentle",
  "ginger",
  "glad",
  "gleaming",
  "glimmer",
  "glowing",
  "golden",
  "graceful",
  "grand",
  "green",
  "happy",
  "hardy",
  "hasty",
  "hazel",
  "hearty",
  "honest",
  "humble",
  "indigo",
  "jolly",
  "keen",
  "kind",
  "lively",
  "loyal",
  "lucid",
  "lucky",
  "lunar",
  "magic",
  "mellow",
  "merry",
  "mighty",
  "minty",
  "misty",
  "modern",
  "modest",
  "morning",
  "mossy",
  "neat",
  "nimble",
  "noble",
  "ocean",
  "olive",
  "orange",
  "peaceful",
  "peppy",
  "pleasant",
  "plucky",
  "polite",
  "proud",
  "pure",
  "quick",
  "quiet",
  "radiant",
  "rapid",
  "rosy",
  "ruby",
  "rustic",
  "saffron",
  "sage",
  "salty",
  "serene",
  "sharp",
  "shining",
  "silent",
  "silver",
  "simple",
  "sleek",
  "smart",
  "smooth",
  "snappy",
  "solar",
  "spark",
  "speedy",
  "spicy",
  "spring",
  "starry",
  "steady",
  "stellar",
  "stormy",
  "subtle",
  "sunny",
  "sweet",
  "swift",
  "tangy",
  "tender",
  "tidy",
  "timely",
  "topaz",
  "tranquil",
  "true",
  "urban",
  "valiant",
  "velvet",
  "vibrant",
  "vivid",
  "warm",
  "wild",
  "wise",
  "witty",
  "worthy",
  "zealous",
  "zesty",
];

export const NOUNS = [
  "almond",
  "apple",
  "apricot",
  "badam",
  "bamboo",
  "banana",
  "basil",
  "berry",
  "bhelpuri",
  "biryani",
  "biscuit",
  "burfi",
  "cardamom",
  "cashew",
  "chai",
  "chapati",
  "chili",
  "chutney",
  "cinnamon",
  "clove",
  "coconut",
  "coffee",
  "cookie",
  "coriander",
  "cumin",
  "curry",
  "dahlia",
  "dal",
  "date",
  "dhokla",
  "dosa",
  "falooda",
  "fennel",
  "fig",
  "garlic",
  "ginger",
  "gulab",
  "halwa",
  "idli",
  "jalebi",
  "jasmine",
  "kachori",
  "kaju",
  "karela",
  "kebab",
  "khichdi",
  "kheer",
  "kofta",
  "kulfi",
  "kulcha",
  "laddu",
  "lassi",
  "lemon",
  "lentil",
  "lime",
  "lotus",
  "malai",
  "mango",
  "masala",
  "methi",
  "mint",
  "modak",
  "momo",
  "muffin",
  "mustard",
  "naan",
  "nutmeg",
  "olive",
  "orange",
  "pakora",
  "paneer",
  "panipuri",
  "papaya",
  "papad",
  "paratha",
  "pastry",
  "pav",
  "peanut",
  "pepper",
  "pista",
  "poha",
  "pulao",
  "puri",
  "raisin",
  "rajma",
  "rasam",
  "rasgulla",
  "roti",
  "saffron",
  "samosa",
  "sandesh",
  "saunf",
  "sev",
  "shahi",
  "sharbat",
  "sheera",
  "starfruit",
  "sugar",
  "tamarind",
  "thali",
  "thepla",
  "tulsi",
  "turmeric",
  "upma",
  "uttapam",
  "vada",
  "vadapav",
  "vanilla",
  "walnut",
];

export const SUFFIX_CHARS = "23456789abcdefghjkmnpqrstuvwxyz";

export const CODE_REGEX = /^[a-z]+-[a-z]+-[23456789abcdefghjkmnpqrstuvwxyz]{6}$/;

export const HIGHLIGHT_OPTIONS = [
  "Cleanliness",
  "Speed / Performance",
  "Staff Helpful",
  "Quiet & Calm",
  "Spacious",
  "Lighting / AC",
] as const;

export type HighlightOption = (typeof HIGHLIGHT_OPTIONS)[number];

export interface ValidReportInput {
  type: "rate" | "issue" | "suggest";
  placeId: string;
  rating: number | null;
  message: string;
  highlights: string[];
  submissionId?: string | null;
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

  // Highlights validation
  let highlights: string[] = [];
  if (raw.highlights !== undefined && raw.highlights !== null) {
    if (!Array.isArray(raw.highlights)) {
      errors.push("Highlights must be an array of strings");
    } else {
      const unique = [...new Set(raw.highlights.map((h) => (typeof h === "string" ? h.trim() : "")))].filter(Boolean);

      if (unique.length > 6) {
        errors.push("At most 6 highlights can be selected");
      }

      for (const h of unique) {
        if (!HIGHLIGHT_OPTIONS.includes(h as HighlightOption)) {
          errors.push(`Invalid highlight option: ${h}`);
        }
      }
      highlights = unique;
    }
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

  // Submission ID validation (optional UUID)
  let submissionId: string | null = null;
  if (raw.submissionId !== undefined && raw.submissionId !== null && raw.submissionId !== "") {
    if (
      typeof raw.submissionId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.submissionId.trim())
    ) {
      errors.push("Invalid submission ID format");
    } else {
      submissionId = raw.submissionId.trim().toLowerCase();
    }
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
      highlights,
      submissionId,
    },
  };
}

function getRandomInt(max: number): number {
  const arr = new Uint32Array(1);
  const maxValid = 0xffffffff - (0xffffffff % max);
  let val = 0;
  do {
    crypto.getRandomValues(arr);
    val = arr[0];
  } while (val >= maxValid);
  return val % max;
}

export function generateCode(): string {
  const adjIndex = getRandomInt(ADJECTIVES.length);
  const nounIndex = getRandomInt(NOUNS.length);

  let suffix = "";
  for (let i = 0; i < 6; i++) {
    const idx = getRandomInt(SUFFIX_CHARS.length);
    suffix += SUFFIX_CHARS[idx];
  }

  const adj = ADJECTIVES[adjIndex].toLowerCase();
  const noun = NOUNS[nounIndex].toLowerCase();

  return `${adj}-${noun}-${suffix}`;
}
