import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = process.cwd();
const envPath = resolve(rootDir, ".env");
const envExamplePath = resolve(rootDir, ".env.example");

const isCheck = process.argv.includes("--check");

function parseEnv(content) {
  const result = new Map();
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      result.set(key, val);
    }
  }
  return result;
}

if (!existsSync(envExamplePath)) {
  console.error("Missing .env.example");
  process.exit(1);
}

if (isCheck) {
  if (!existsSync(envPath)) {
    console.error("Check failed: .env file does not exist. Run 'npm run setup' first.");
    process.exit(1);
  }

  const env = parseEnv(readFileSync(envPath, "utf-8"));
  const requiredKeys = [
    "APP_ENV",
    "POSTGRES_USER",
    "POSTGRES_DB",
    "POSTGRES_PORT",
    "POSTGRES_PASSWORD",
    "DATABASE_URL",
    "SESSION_SECRET",
  ];
  const missingKeys = [];
  const unconfiguredKeys = [];

  for (const key of requiredKeys) {
    if (!env.has(key)) {
      missingKeys.push(key);
    } else {
      const val = env.get(key);
      if (!val || val === "change-me") {
        unconfiguredKeys.push(key);
      }
    }
  }

  if (missingKeys.length > 0 || unconfiguredKeys.length > 0) {
    if (missingKeys.length > 0) {
      console.error(`Check failed: missing environment variables: ${missingKeys.join(", ")}`);
    }
    if (unconfiguredKeys.length > 0) {
      console.error(`Check failed: unconfigured environment variables: ${unconfiguredKeys.join(", ")}`);
    }
    process.exit(1);
  }

  console.log(".env check passed.");
  process.exit(0);
}

// Setup mode
let baseContent = "";
if (existsSync(envPath)) {
  baseContent = readFileSync(envPath, "utf-8");
} else {
  baseContent = readFileSync(envExamplePath, "utf-8");
}

const currentEnv = parseEnv(baseContent);

// Determine password
let postgresPassword = currentEnv.get("POSTGRES_PASSWORD");
if (!postgresPassword || postgresPassword === "change-me") {
  postgresPassword = randomBytes(16).toString("hex");
}

// Determine session secret
let sessionSecret = currentEnv.get("SESSION_SECRET");
if (!sessionSecret || sessionSecret === "change-me") {
  sessionSecret = randomBytes(32).toString("hex");
}

const user = currentEnv.get("POSTGRES_USER") || "vfeedback";
const db = currentEnv.get("POSTGRES_DB") || "vfeedback";
const port = currentEnv.get("POSTGRES_PORT") || "5432";

let databaseUrl = currentEnv.get("DATABASE_URL");
if (!databaseUrl) {
  databaseUrl = `postgresql://${user}:${postgresPassword}@127.0.0.1:${port}/${db}`;
}

const lines = baseContent.split(/\r?\n/);
const updatedLines = [];
const seenKeys = new Set();

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    updatedLines.push(line);
    continue;
  }

  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) {
    updatedLines.push(line);
    continue;
  }

  const key = trimmed.slice(0, eqIdx).trim();
  seenKeys.add(key);

  if (key === "POSTGRES_PASSWORD") {
    updatedLines.push(`${key}=${postgresPassword}`);
  } else if (key === "SESSION_SECRET") {
    updatedLines.push(`${key}=${sessionSecret}`);
  } else if (key === "DATABASE_URL") {
    updatedLines.push(`${key}=${databaseUrl}`);
  } else {
    updatedLines.push(line);
  }
}

if (!seenKeys.has("POSTGRES_PASSWORD")) {
  updatedLines.push(`POSTGRES_PASSWORD=${postgresPassword}`);
}
if (!seenKeys.has("SESSION_SECRET")) {
  updatedLines.push(`SESSION_SECRET=${sessionSecret}`);
}
if (!seenKeys.has("DATABASE_URL")) {
  updatedLines.push(`DATABASE_URL=${databaseUrl}`);
}

writeFileSync(envPath, updatedLines.join("\n") + "\n", "utf-8");
console.log("Configuration setup complete: .env is up to date.");
