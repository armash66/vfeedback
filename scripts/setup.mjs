import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = process.cwd();
const envPath = resolve(rootDir, ".env");
const envExamplePath = resolve(rootDir, ".env.example");

export function stripQuotes(val) {
  if (!val) return val;
  const trimmed = val.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function serializeEnvValue(val) {
  if (val === undefined || val === null) return "";
  const str = String(val);
  const needsQuotes =
    /\s/.test(str) ||
    str.includes("#") ||
    str.includes('"') ||
    str.includes("'") ||
    str.includes("\\") ||
    str.startsWith(" ") ||
    str.endsWith(" ");

  if (needsQuotes) {
    const escaped = str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  return str;
}

export function parseEnv(content) {
  const result = new Map();
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const rawVal = trimmed.slice(eqIdx + 1).trim();
      let val = stripQuotes(rawVal);
      if (rawVal.startsWith('"') && rawVal.endsWith('"') && rawVal.length >= 2) {
        val = val.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      }
      result.set(key, val);
    }
  }
  return result;
}

function isLocalHost(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    return host === "127.0.0.1" || host === "localhost";
  } catch {
    return urlStr.includes("127.0.0.1") || urlStr.includes("localhost");
  }
}

function dockerVolumeExists(volumeName) {
  try {
    const output = execSync(`docker volume ls -q --filter name=^${volumeName}$`, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return output.split(/\r?\n/).some((vol) => vol.trim() === volumeName);
  } catch (err) {
    if (err.code === "ENOENT") {
      // Docker is not installed: skip check
      return false;
    }
    // Docker is installed, but command failed (e.g. daemon not running)
    console.warn(
      "Could not check for an existing database volume (the container runtime may not be running). If db:up later fails with a password error, restore your old .env, or remove the old volume with `docker compose down -v` and run setup again.",
    );
    return false;
  }
}

function writeEnvSafely(filePath, content) {
  try {
    writeFileSync(filePath, content, { encoding: "utf-8", mode: 0o600 });
  } catch {
    writeFileSync(filePath, content, "utf-8");
  }
  try {
    chmodSync(filePath, 0o600);
  } catch {
    // Best effort on Windows
  }
}

const requiredKeys = [
  "APP_ENV",
  "POSTGRES_USER",
  "POSTGRES_DB",
  "POSTGRES_PORT",
  "POSTGRES_PASSWORD",
  "DATABASE_URL",
  "SESSION_SECRET",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
];

function validateEnv(envMap) {
  const missingKeys = [];
  const unconfiguredKeys = [];

  for (const key of requiredKeys) {
    if (!envMap.has(key)) {
      missingKeys.push(key);
    } else {
      const val = envMap.get(key);
      if (!val || val === "change-me") {
        unconfiguredKeys.push(key);
      }
    }
  }

  return { missingKeys, unconfiguredKeys };
}

export function runSetup() {
  const isCheck = process.argv.includes("--check");

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
    const { missingKeys, unconfiguredKeys } = validateEnv(env);

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
  const envExampleContent = readFileSync(envExamplePath, "utf-8");
  const exampleEnv = parseEnv(envExampleContent);

  let baseContent = "";
  const envExists = existsSync(envPath);
  if (envExists) {
    baseContent = readFileSync(envPath, "utf-8");
  } else {
    baseContent = envExampleContent;
  }

  const currentEnv = parseEnv(baseContent);

  // Check if Docker volume exists when password is missing or change-me
  let postgresPassword = currentEnv.get("POSTGRES_PASSWORD");
  const hasNoRealPassword = !postgresPassword || postgresPassword === "change-me";

  if (hasNoRealPassword) {
    if (dockerVolumeExists("vfeedback_postgres_data")) {
      console.error(
        "Error: The Docker volume 'vfeedback_postgres_data' already exists, but .env has no configured password.\n" +
          "PostgreSQL only initializes its password on volume creation. You have two options:\n" +
          "  1) Restore your previous .env file containing the original password, OR\n" +
          "  2) Run 'docker compose down -v' to wipe local data and start fresh.",
      );
      process.exit(1);
    }
    postgresPassword = randomBytes(16).toString("hex");
  }

  // Determine session secret
  let sessionSecret = currentEnv.get("SESSION_SECRET");
  if (!sessionSecret || sessionSecret === "change-me") {
    sessionSecret = randomBytes(32).toString("hex");
  }

  // Determine better auth secret (independent of SESSION_SECRET)
  let betterAuthSecret = currentEnv.get("BETTER_AUTH_SECRET");
  if (!betterAuthSecret || betterAuthSecret === "change-me") {
    betterAuthSecret = randomBytes(32).toString("hex");
  }

  let betterAuthUrl = currentEnv.get("BETTER_AUTH_URL");
  if (!betterAuthUrl) {
    betterAuthUrl = currentEnv.get("APP_URL") || "http://localhost:5173";
  }

  const user = currentEnv.get("POSTGRES_USER") || "vfeedback";
  const db = currentEnv.get("POSTGRES_DB") || "vfeedback";
  const port = currentEnv.get("POSTGRES_PORT") || "5432";

  let databaseUrl = currentEnv.get("DATABASE_URL") || "";

  // Rebuild DATABASE_URL if empty OR points at 127.0.0.1 or localhost, or if it had change-me password
  if (!databaseUrl || isLocalHost(databaseUrl)) {
    const encodedUser = encodeURIComponent(user);
    const encodedPassword = encodeURIComponent(postgresPassword);
    databaseUrl = `postgresql://${encodedUser}:${encodedPassword}@127.0.0.1:${port}/${db}`;
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

    let valToSerialize;
    if (key === "POSTGRES_PASSWORD") {
      valToSerialize = postgresPassword;
    } else if (key === "SESSION_SECRET") {
      valToSerialize = sessionSecret;
    } else if (key === "BETTER_AUTH_SECRET") {
      valToSerialize = betterAuthSecret;
    } else if (key === "BETTER_AUTH_URL") {
      valToSerialize = betterAuthUrl;
    } else if (key === "DATABASE_URL") {
      valToSerialize = databaseUrl;
    } else {
      valToSerialize = currentEnv.get(key);
    }
    updatedLines.push(`${key}=${serializeEnvValue(valToSerialize)}`);
  }

  // When .env already exists, append any keys that exist in .env.example but are missing from .env
  for (const [key, val] of exampleEnv.entries()) {
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      let valToSerialize;
      if (key === "POSTGRES_PASSWORD") {
        valToSerialize = postgresPassword;
      } else if (key === "SESSION_SECRET") {
        valToSerialize = sessionSecret;
      } else if (key === "BETTER_AUTH_SECRET") {
        valToSerialize = betterAuthSecret;
      } else if (key === "BETTER_AUTH_URL") {
        valToSerialize = betterAuthUrl;
      } else if (key === "DATABASE_URL") {
        valToSerialize = databaseUrl;
      } else {
        valToSerialize = val;
      }
      updatedLines.push(`${key}=${serializeEnvValue(valToSerialize)}`);
    }
  }

  const newEnvContent = updatedLines.join("\n") + "\n";
  writeEnvSafely(envPath, newEnvContent);

  // Run the same validation as --check. Report success only if that validation passes.
  const finalEnv = parseEnv(newEnvContent);
  const { missingKeys, unconfiguredKeys } = validateEnv(finalEnv);

  if (missingKeys.length > 0 || unconfiguredKeys.length > 0) {
    if (missingKeys.length > 0) {
      console.error(`Check failed: missing environment variables: ${missingKeys.join(", ")}`);
    }
    if (unconfiguredKeys.length > 0) {
      console.error(`Check failed: unconfigured environment variables: ${unconfiguredKeys.join(", ")}`);
    }
    process.exit(1);
  }

  console.log("Configuration setup complete: .env is up to date.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runSetup();
}
